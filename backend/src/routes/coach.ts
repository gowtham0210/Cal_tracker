import { createHash, randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { coachFacts, unitsFor, weekStats } from "../ai/facts.js";
import { AiUnavailable, llm } from "../ai/llm.js";
import * as chat from "../ai/prompts/coach-chat.js";
import * as mealIdeas from "../ai/prompts/meal-ideas.js";
import * as weekly from "../ai/prompts/weekly-summary.js";
import { db } from "../db/index.js";
import { addDays, iso, todayIn } from "../lib/dates.js";
import { rankIdeas, type Meal } from "../lib/meal-ideas.js";
import { dayTotals } from "../lib/stats.js";
import { TtlCache } from "../lib/ttl-cache.js";
import { decodeCursor, page } from "../http/pagination.js";
import { HttpError, type Problem } from "../http/problem.js";
import { rateLimit } from "../http/rate-limit.js";
import { body, date, mealType, parse } from "../http/validate.js";
import { requireProfile, type Profile } from "./profile.js";

/** Caps each user's AI calls, which cost money and time. */
export const aiRateLimit = rateLimit({
  windowMs: 10 * 60_000,
  max: 40,
  key: (req) => `ai:${req.res?.locals.userId}`,
  title: "You've used the AI features a lot in the last few minutes. Try again shortly.",
});

const hash = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("base64url").slice(0, 16);
const round = (n: number) => Math.round(n);

export const coach = Router();

/* ---------------- Chat ---------------- */

interface MessageRow {
  id: string;
  role: "user" | "assistant";
  text: string;
  created_at: number;
}
const toMessage = (m: MessageRow) => ({ id: m.id, role: m.role, text: m.text, createdAt: iso(m.created_at) });

const insertMessage = db.prepare("INSERT INTO coach_messages (id, user_id, role, text, created_at) VALUES (?, ?, ?, ?, ?)");
const saveExchange = db.transaction((userId: string, question: string, answer: string, askedAt: number) => {
  const q = { id: randomUUID(), role: "user" as const, text: question, created_at: askedAt };
  const a = { id: randomUUID(), role: "assistant" as const, text: answer, created_at: Math.max(Date.now(), askedAt + 1) };
  insertMessage.run(q.id, userId, q.role, q.text, q.created_at);
  insertMessage.run(a.id, userId, a.role, a.text, a.created_at);
  return { question: toMessage(q), answer: toMessage(a) };
});
const recentHistory = db.prepare<[string], MessageRow>(
  "SELECT * FROM (SELECT * FROM coach_messages WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 12) ORDER BY created_at, id",
);

coach.get("/messages", (req, res) => {
  const q = parse(z.object({ limit: z.coerce.number().int().min(1).max(500).default(100), cursor: z.string().optional() }), req.query);
  const after = decodeCursor(q.cursor, 2);
  const rows = db
    .prepare(
      `SELECT * FROM coach_messages WHERE user_id = @userId ${after ? "AND (created_at, id) > (@a0, @a1)" : ""}
       ORDER BY created_at, id LIMIT @limit`,
    )
    .all({ userId: res.locals.userId, limit: q.limit + 1, ...(after ? { a0: after[0], a1: after[1] } : {}) }) as MessageRow[];
  const p = page(rows, q.limit, (r) => [r.created_at, r.id]);
  res.json({ data: p.data.map(toMessage), nextCursor: p.nextCursor });
});

coach.delete("/messages", (_req, res) => {
  db.prepare("DELETE FROM coach_messages WHERE user_id = ?").run(res.locals.userId);
  res.status(204).end();
});

const questionInput = body({ text: z.string("Text is required.").trim().min(1, "Ask a question.").max(2000, "Keep it under 2000 characters.") });

coach.post("/messages", aiRateLimit, async (req, res) => {
  const { text } = parse(questionInput, req.body);
  const userId = res.locals.userId;
  const profile = requireProfile(userId);
  const askedAt = Date.now();
  const history = recentHistory.all(userId).map((m) => ({ role: m.role, text: m.text }));
  const messages = chat.messages(coachFacts(userId, profile, todayIn(profile.timeZone)), history, text);

  const abort = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) abort.abort();
  });
  const chunks = llm().stream({ messages, maxTokens: 600, signal: abort.signal }, { prompt: chat.PROMPT, userId });
  const wantsStream = req.accepts(["application/json", "text/event-stream"]) === "text/event-stream";

  if (!wantsStream) {
    let answer = "";
    for await (const c of chunks) answer += c;
    if (!answer.trim()) throw new AiUnavailable("The model returned an empty answer.");
    res.status(201).json(saveExchange(userId, text, answer.trim(), askedAt));
    return;
  }

  // Stream only once the model has produced something, so early failures are normal problem responses.
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  let answer = "";
  try {
    for await (const c of chunks) {
      if (!res.headersSent) {
        res.status(201).set({ "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
        res.flushHeaders();
      }
      answer += c;
      send("delta", { text: c });
    }
    if (!answer.trim()) throw new AiUnavailable("The model returned an empty answer.");
  } catch (err) {
    if (!res.headersSent) throw err;
    const e = err instanceof HttpError ? err : new AiUnavailable("The answer was interrupted.");
    send("error", { type: `https://lighter.app/problems/${e.slug}`, title: e.title, status: e.status, detail: e.detail } satisfies Problem);
    res.end();
    return;
  }
  if (abort.signal.aborted) return;
  send("done", saveExchange(userId, text, answer.trim(), askedAt));
  res.end();
});

/* ---------------- Weekly summary ---------------- */

const weightOn = db.prepare<[string, string], { weight: number }>("SELECT weight FROM weight_entries WHERE user_id = ? AND date <= ? ORDER BY date DESC LIMIT 1");
const summaries = new TtlCache<{ headline: string; tip: string }>(6 * 60 * 60_000);

function weeklyFacts(userId: string, p: Profile, asOf: string) {
  const { w } = unitsFor(p);
  const a = weekStats(userId, asOf);
  const b = weekStats(userId, addDays(asOf, -7));
  const wNow = weightOn.get(userId, asOf)?.weight ?? p.startWeight;
  const wPrev = weightOn.get(userId, addDays(asOf, -7))?.weight ?? wNow;
  const delta = wNow - wPrev;
  const sign = (n: number) => (n <= 0 ? "−" : "+");

  const bullets = [
    { label: "Weight change", value: `${sign(delta)}${w(Math.abs(delta))}`, trend: delta < -0.05 ? "down" : delta > 0.05 ? "up" : "flat", good: delta <= 0.05 },
    {
      label: "Avg calories",
      value: `${a.avgIntake.toLocaleString("en-US")} kcal`,
      trend: a.avgIntake < b.avgIntake - 20 ? "down" : a.avgIntake > b.avgIntake + 20 ? "up" : "flat",
      good: a.avgIntake <= p.calorieGoal + 100,
    },
    { label: "Avg protein", value: `${a.avgProtein} g`, trend: a.avgProtein > b.avgProtein + 5 ? "up" : a.avgProtein < b.avgProtein - 5 ? "down" : "flat", good: a.avgProtein >= p.macroGoals.protein * 0.85 },
    {
      label: "Workouts",
      value: `${a.workouts} (${a.workouts - b.workouts >= 0 ? "+" : ""}${a.workouts - b.workouts})`,
      trend: a.workouts > b.workouts ? "up" : a.workouts < b.workouts ? "down" : "flat",
      good: a.workouts >= 3,
    },
    { label: "Water", value: `${a.avgWaterGlasses.toFixed(1)} glasses/day`, trend: "flat", good: a.avgWaterGlasses >= p.waterGoal * 0.8 },
  ] as const;

  // The rules pick what to focus on; the model only phrases it.
  const focus = [
    { cond: a.avgProtein < p.macroGoals.protein * 0.85, area: "protein", fact: `Protein averaged ${a.avgProtein} g vs a ${p.macroGoals.protein} g goal.`, tip: `Protein averaged ${a.avgProtein} g vs your ${p.macroGoals.protein} g goal. Add one protein-first snack, like Greek yogurt or a shake, each afternoon.` },
    { cond: a.avgWaterGlasses < p.waterGoal * 0.8, area: "water", fact: `Water averaged ${a.avgWaterGlasses.toFixed(1)} of ${p.waterGoal} glasses a day.`, tip: `You averaged ${a.avgWaterGlasses.toFixed(1)} of ${p.waterGoal} glasses. Try a glass of water before each meal — it also takes the edge off hunger.` },
    { cond: a.avgNet > p.calorieGoal + 100, area: "calories", fact: `Net calories averaged ${a.avgNet} kcal vs a ${p.calorieGoal} kcal goal.`, tip: `Net calories ran about ${round(a.avgNet - p.calorieGoal)} kcal above goal. Pre-log dinner in the morning so evening choices are already made.` },
    { cond: a.workouts < 3, area: "exercise", fact: `${a.workouts} workouts this week.`, tip: `Only ${a.workouts} workouts this week. A 20-minute walk after dinner is the easiest one to add.` },
    { cond: true, area: "consistency", fact: "Goals were broadly met this week.", tip: "You're consistent — great. Plan tomorrow's meals the night before to protect your streak on busy days." },
  ].find((f) => f.cond)!;

  const headline =
    delta < -0.1
      ? `Solid week — you're down ${w(Math.abs(delta))} and your trend keeps heading the right way.`
      : delta > 0.3
        ? `Scale's up ${w(delta)} this week — likely water or salt. The long-term trend is what counts.`
        : "A steady week. Weight held roughly flat, which is normal between drops.";

  return {
    weekStart: a.from,
    weekEnd: asOf,
    bullets: bullets.map((x) => ({ ...x })),
    fallback: { headline, tip: focus.tip },
    modelFacts: {
      weightChange: bullets[0].value,
      currentWeight: w(wNow),
      avgCaloriesThisWeek: a.avgIntake,
      avgCaloriesLastWeek: b.avgIntake,
      calorieGoal: p.calorieGoal,
      avgProtein_g: a.avgProtein,
      proteinGoal_g: p.macroGoals.protein,
      workoutsThisWeek: a.workouts,
      workoutsLastWeek: b.workouts,
      avgWaterGlasses: a.avgWaterGlasses,
      waterGoalGlasses: p.waterGoal,
      daysLogged: a.daysLogged,
      focus: { area: focus.area, fact: focus.fact },
    },
  };
}

coach.get("/weekly-summary", aiRateLimit, async (req, res) => {
  const userId = res.locals.userId;
  const p = requireProfile(userId);
  const { asOf = todayIn(p.timeZone) } = parse(z.object({ asOf: date.optional() }), req.query);
  const f = weeklyFacts(userId, p, asOf);

  const key = `${userId}:${weekly.PROMPT}:${hash(f.modelFacts)}`;
  let text = summaries.get(key);
  if (!text) {
    try {
      text = await llm().json({ messages: weekly.messages(f.modelFacts), name: "weekly_summary", jsonSchema: weekly.jsonSchema, schema: weekly.schema, maxTokens: 400 }, { prompt: weekly.PROMPT, userId });
      summaries.set(key, text);
    } catch (err) {
      // The rule-based text is still correct, so degrade to it rather than failing.
      console.log(JSON.stringify({ event: "ai_fallback", prompt: weekly.PROMPT, reason: err instanceof HttpError ? err.slug : "error" }));
      text = f.fallback;
    }
  }
  res.json({ weekStart: f.weekStart, weekEnd: f.weekEnd, headline: text.headline, bullets: f.bullets, tip: text.tip });
});

/* ---------------- Meal suggestions ---------------- */

const ideasCache = new TtlCache<z.output<typeof mealIdeas.schema>["ideas"]>(30 * 60_000);
const usualFoods = db.prepare<[string, string, string], { name: string }>(
  `SELECT name FROM (
     SELECT name, count(*) AS n FROM food_entries WHERE user_id = ? AND date >= ? GROUP BY name COLLATE NOCASE
     UNION ALL SELECT name, 1000 AS n FROM favorite_foods WHERE user_id = ?
   ) GROUP BY name COLLATE NOCASE ORDER BY max(n) DESC LIMIT 10`,
);

coach.get("/meal-suggestions", aiRateLimit, async (req, res) => {
  const userId = res.locals.userId;
  const p = requireProfile(userId);
  const q = parse(z.object({ asOf: date.optional(), meal: mealType.optional(), limit: z.coerce.number().int().min(1).max(10).default(4) }), req.query);
  const asOf = q.asOf ?? todayIn(p.timeZone);
  const today = dayTotals(userId, asOf, asOf)[0];
  const budget = Math.max(round(p.calorieGoal - today.net), 120);
  const proteinLeft = Math.max(0, round(p.macroGoals.protein - today.protein));

  const facts = {
    count: q.limit,
    cuisine: p.cuisine,
    maxCalories: budget,
    proteinLeft_g: proteinLeft,
    meal: q.meal ?? null,
    usualFoods: usualFoods.all(userId, addDays(asOf, -30), userId).map((r) => r.name),
  };
  const key = `${userId}:${mealIdeas.PROMPT}:${hash(facts)}`;
  let ideas = ideasCache.get(key);
  if (!ideas) {
    try {
      const out = await llm().json({ messages: mealIdeas.messages(facts), name: "meal_ideas", jsonSchema: mealIdeas.jsonSchema, schema: mealIdeas.schema, maxTokens: 900 }, { prompt: mealIdeas.PROMPT, userId });
      // Enforce the constraints the model was given, instead of trusting it followed them.
      const seen = new Set<string>();
      ideas = out.ideas
        .filter((i) => i.calories <= budget * 1.1 && (!q.meal || i.meal === q.meal))
        .filter((i) => !seen.has(i.name.toLowerCase()) && seen.add(i.name.toLowerCase()))
        .map((i) => ({ ...i, calories: round(i.calories), protein: round(i.protein), carbs: round(i.carbs), fat: round(i.fat) }))
        .slice(0, q.limit);
      if (ideas.length) ideasCache.set(key, ideas);
    } catch (err) {
      console.log(JSON.stringify({ event: "ai_fallback", prompt: mealIdeas.PROMPT, reason: err instanceof HttpError ? err.slug : "error" }));
    }
  }
  if (!ideas?.length) ideas = rankIdeas(budget, proteinLeft, q.meal as Meal | undefined, q.limit, p.cuisine);
  res.json({ data: ideas });
});
