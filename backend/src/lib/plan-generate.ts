import * as planDay from "../ai/prompts/plan-day.js";
import { llm } from "../ai/llm.js";
import { db } from "../db/index.js";
import { HttpError } from "../http/problem.js";
import type { Profile } from "../routes/profile.js";
import { CUISINE_STYLES } from "./curated-foods.js";
import { allergyConflicts } from "./food-tags.js";
import { syncLibrary, type LibraryRow } from "./library.js";
import { ensurePlan, getPlanRow, insertItem, MEALS, toleranceFor, weekDates, type ItemRow, type Meal, type PlanRow } from "./plan.js";

// Drafting a plan: the AI (or, when it's unavailable, simple rules) picks library foods and
// servings for each day. The model never supplies numbers, and whatever it returns is checked
// here: only safe library foods, quarter servings, and each day brought within the calorie
// tolerance by adjusting portions. A draft keeps the plan it replaced until it's kept or discarded.

export type Mode = "usual" | "mix";
interface Planned {
  meal: Meal;
  food: LibraryRow;
  quantity: number;
}

/* ---------------- Candidates ---------------- */

const libraryRows = db.prepare<[string], LibraryRow>("SELECT * FROM library_foods WHERE user_id = ? ORDER BY use_count DESC, last_used DESC, name COLLATE NOCASE");

const DIETS_FOR: Record<Profile["dietType"], (LibraryRow["diet"])[]> = {
  veg: ["veg"],
  eggetarian: ["veg", "eggetarian"],
  // Only here is a food with an unknown diet allowed.
  "non-veg": ["veg", "eggetarian", "non-veg", null],
};
const ingredientNames = (r: LibraryRow) => (r.ingredients ? (JSON.parse(r.ingredients) as { name: string }[]).map((i) => i.name) : []);

/** Library foods the user can safely eat: within their diet type and free of their allergies. */
export function isSafe(r: LibraryRow, p: Pick<Profile, "dietType" | "allergies">) {
  if (!DIETS_FOR[p.dietType].includes(r.diet)) return false;
  return allergyConflicts({ name: r.name, allergens: JSON.parse(r.allergens) as string[], ingredients: ingredientNames(r) }, p.allergies).length === 0;
}

const isYours = (r: LibraryRow) => r.use_count > 0 || r.source === "logged" || r.source === "favorite";
const PER_MEAL = { yours: 10, others: 6, topUp: 4 };

/**
 * The foods the planner may use. "usual" is the user's own foods, topped up with curated dishes in
 * their food style for any meal where they have fewer than two; "mix" adds those dishes (and
 * reviewed new foods) to every meal.
 */
export function candidates(userId: string, p: Profile, mode: Mode): LibraryRow[] {
  syncLibrary(userId);
  const safe = libraryRows.all(userId).filter((r) => isSafe(r, p));
  const styles = CUISINE_STYLES[p.cuisine];
  const others = safe.filter((r) => !isYours(r) && (r.source === "ai" || (r.source === "curated" && styles.includes(r.cuisine as never))));
  return MEALS.flatMap((meal) => {
    const yours = safe.filter((r) => isYours(r) && r.meal === meal).slice(0, PER_MEAL.yours);
    const extra = others.filter((r) => r.meal === meal);
    if (mode === "mix") return [...yours, ...extra.slice(0, PER_MEAL.others)];
    return yours.length >= 2 ? yours : [...yours, ...extra.slice(0, PER_MEAL.topUp)];
  });
}

/* ---------------- Portions ---------------- */

const snap = (q: number, min = 0.25, max = 10) => Math.min(max, Math.max(min, Math.round(q * 4) / 4));
const total = (items: Planned[]) => items.reduce((s, i) => s + i.food.calories * i.quantity, 0);

/**
 * Brings a day close to the goal: scales every portion, then nudges one food a quarter serving at
 * a time until the day is well inside the tolerance or no step helps.
 */
export function fitToGoal(items: Planned[], goal: number): Planned[] {
  let out = items.map((i) => ({ ...i, quantity: snap(i.quantity) }));
  const now = total(out);
  if (now === 0) return out;
  const tolerance = toleranceFor(goal);
  if (Math.abs(now - goal) > tolerance) out = out.map((i) => ({ ...i, quantity: snap((i.quantity * goal) / now) }));
  for (let step = 0; step < 80; step++) {
    const diff = goal - total(out);
    if (Math.abs(diff) <= tolerance / 2) break;
    const dir = diff > 0 ? 0.25 : -0.25;
    let best = -1;
    let bestGap = Math.abs(diff);
    out.forEach((i, n) => {
      const q = i.quantity + dir;
      if (q < 0.25 || q > 10) return;
      const gap = Math.abs(diff - i.food.calories * dir);
      // Ties go to the smallest portion when adding and the largest when cutting, keeping portions even.
      const evener = best >= 0 && gap === bestGap && (dir > 0 ? i.quantity < out[best].quantity : i.quantity > out[best].quantity);
      if (gap < bestGap || evener) [best, bestGap] = [n, gap];
    });
    if (best < 0) break;
    out[best] = { ...out[best], quantity: out[best].quantity + dir };
  }
  return out;
}

const withinTolerance = (items: Planned[], goal: number) => items.length > 0 && Math.abs(total(items) - goal) <= toleranceFor(goal);

/* ---------------- Rules ---------------- */

const MEAL_SHARE: Record<Meal, number> = { breakfast: 0.25, lunch: 0.35, snack: 0.1, dinner: 0.3 };

/**
 * For each meal, a food rotating through the candidates (the user's own first) so days differ,
 * starting at up to 1½ servings, with a second food for a big meal rather than a huge portion.
 * The day is then fitted to the goal.
 */
export function rulesDay(pool: LibraryRow[], goal: number, dayIndex: number): Planned[] {
  const items = MEALS.flatMap((meal) => {
    const forMeal = pool.filter((r) => r.meal === meal && r.calories > 0);
    if (!forMeal.length) return [];
    const target = goal * MEAL_SHARE[meal];
    const first = forMeal[dayIndex % forMeal.length];
    const picked: Planned[] = [{ meal, food: first, quantity: snap(target / first.calories, 0.5, 1.5) }];
    const left = target - first.calories * picked[0].quantity;
    const second = forMeal[(dayIndex + 1) % forMeal.length];
    if (meal !== "snack" && second !== first && left > target * 0.3) picked.push({ meal, food: second, quantity: snap(left / second.calories, 0.5, 1.5) });
    return picked;
  });
  return fitToGoal(items, goal);
}

/* ---------------- AI ---------------- */

/** Keeps only candidate foods, merges repeats and limits each meal to four foods. */
function checkPicks(picks: { meal: Meal; foodId: string; quantity: number }[], pool: Map<string, LibraryRow>): Planned[] {
  const out: Planned[] = [];
  for (const p of picks) {
    const food = pool.get(p.foodId);
    if (!food || !Number.isFinite(p.quantity) || p.quantity <= 0) continue;
    const same = out.find((i) => i.meal === p.meal && i.food.id === food.id);
    if (same) same.quantity += p.quantity;
    else if (out.filter((i) => i.meal === p.meal).length < 4) out.push({ meal: p.meal, food, quantity: p.quantity });
  }
  return out;
}

/** What the model is told about one day. */
export function dayFacts(p: Profile, mode: Mode, date: string, pool: LibraryRow[], avoid: string[]): planDay.DayFacts {
  return {
    date,
    weekday: new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" }),
    calorieGoal: p.calorieGoal,
    toleranceKcal: toleranceFor(p.calorieGoal),
    ...(p.trackMacros ? { macroGoals: p.macroGoals } : {}),
    dietType: p.dietType,
    allergies: p.allergies,
    cuisine: p.cuisine,
    budget: p.budget,
    dailyBudget: p.dailyBudget,
    mode,
    avoid: [...new Set(avoid)].slice(-30),
    candidates: pool.map((r) => ({ id: r.id, name: r.name, meal: r.meal, calories: r.calories, protein: r.protein, yours: isYours(r) })),
  };
}

async function aiDay(userId: string, p: Profile, mode: Mode, date: string, pool: LibraryRow[], avoid: string[]): Promise<Planned[] | null> {
  const byId = new Map(pool.map((r) => [r.id, r]));
  const facts = dayFacts(p, mode, date, pool, avoid);
  // A day the model gets badly wrong is asked for once more before rules take over. The token
  // budget is generous because reasoning models spend most of it thinking.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const out = await llm().json(
      { messages: planDay.messages(facts), name: "plan_day", jsonSchema: planDay.jsonSchema([...byId.keys()]), schema: planDay.schema, maxTokens: 4000, timeoutMs: 45_000 },
      { prompt: planDay.PROMPT, userId },
    );
    const fitted = fitToGoal(checkPicks(out.items, byId), p.calorieGoal);
    if (withinTolerance(fitted, p.calorieGoal)) return fitted;
  }
  return null;
}

/* ---------------- Drafts ---------------- */

interface Snapshot {
  source: PlanRow["source"];
  items: Pick<ItemRow, "date" | "meal" | "food_id" | "quantity" | "position">[];
}

const allItems = db.prepare<[string], ItemRow>("SELECT * FROM plan_items WHERE plan_id = ? ORDER BY date, meal, position");

/** Marks the plan as a draft, remembering what it held so Discard can put it back. */
const startDraft = db.transaction((userId: string, weekStart: string) => {
  const plan = ensurePlan(userId, weekStart, null);
  if (plan.status === "draft") return plan;
  const snapshot: Snapshot = { source: plan.source, items: allItems.all(plan.id).map(({ date, meal, food_id, quantity, position }) => ({ date, meal, food_id, quantity, position })) };
  db.prepare("UPDATE meal_plans SET status = 'draft', previous_items = ? WHERE id = ?").run(JSON.stringify(snapshot), plan.id);
  return getPlanRow(userId, weekStart)!;
});

const writeDay = db.transaction((planId: string, date: string, items: Planned[]) => {
  db.prepare("DELETE FROM plan_items WHERE plan_id = ? AND date = ?").run(planId, date);
  for (const i of items) insertItem(planId, { date, meal: i.meal, foodId: i.food.id, quantity: i.quantity });
});

export interface DraftRun {
  userId: string;
  profile: Profile;
  weekStart: string;
  mode: Mode;
  planId: string;
  pool: LibraryRow[];
}

/** Opens (or reuses) the week's draft and picks the candidate foods. Synchronous, so it fails before anything is streamed. */
export function prepareDraft(userId: string, profile: Profile, weekStart: string, mode: Mode): DraftRun {
  const pool = candidates(userId, profile, mode);
  return { userId, profile, weekStart, mode, pool, planId: startDraft(userId, weekStart).id };
}

const isDraft = (planId: string) => db.prepare<[string], { status: string }>("SELECT status FROM meal_plans WHERE id = ?").get(planId)?.status === "draft";

/**
 * Fills the given days of a draft. AI days are tried first; once the AI is unavailable the rest
 * are built by rules. `onDay` is called after each day is saved, so the caller can stream progress.
 * Stops early if the client goes away or the draft is kept or discarded meanwhile.
 */
export async function fillDraft(run: DraftRun, dates: string[], opts: { onDay?: (date: string) => void; signal?: AbortSignal } = {}) {
  const { userId, profile: p, mode, pool, planId } = run;
  const week = weekDates(run.weekStart);
  let aiUp = pool.length > 0;
  let ruleDays = 0;
  const avoid: string[] = [];
  for (const date of dates) {
    if (opts.signal?.aborted) break;
    let items: Planned[] | null = null;
    if (aiUp) {
      try {
        items = await aiDay(userId, p, mode, date, pool, avoid);
      } catch (err) {
        // Unavailable, busy or filtered: carry on without the AI.
        if (!(err instanceof HttpError)) throw err;
        aiUp = false;
      }
    }
    if (!items) {
      items = rulesDay(pool, p.calorieGoal, week.indexOf(date));
      ruleDays++;
    }
    if (!isDraft(planId)) return;
    // With no safe foods at all, the day is left as it was rather than emptied.
    if (items.length) writeDay(planId, date, items);
    avoid.push(...items.map((i) => i.food.name));
    opts.onDay?.(date);
  }
  // "rules" whenever any day was built without the AI, so the draft is never passed off as the AI's.
  const current = getPlanRow(userId, run.weekStart)?.source;
  const source = ruleDays > 0 || (current === "rules" && dates.length < 7) ? "rules" : "ai";
  db.prepare("UPDATE meal_plans SET source = ? WHERE id = ? AND status = 'draft'").run(source, planId);
}

const noDraft = () => new HttpError(409, "no-draft", "There's no draft plan for this week.", "Generate a plan first.");

export const keepDraft = db.transaction((userId: string, weekStart: string) => {
  const plan = getPlanRow(userId, weekStart);
  if (plan?.status !== "draft") throw noDraft();
  db.prepare("UPDATE meal_plans SET status = 'active', previous_items = NULL WHERE id = ?").run(plan.id);
});

/** Puts back exactly what the week held before the draft. */
export const discardDraft = db.transaction((userId: string, weekStart: string) => {
  const plan = getPlanRow(userId, weekStart);
  if (plan?.status !== "draft") throw noDraft();
  const snapshot = JSON.parse(plan.previous_items ?? '{"source":null,"items":[]}') as Snapshot;
  db.prepare("DELETE FROM plan_items WHERE plan_id = ?").run(plan.id);
  // Foods deleted from the library since can't come back.
  const exists = db.prepare<[string], { id: string }>("SELECT id FROM library_foods WHERE id = ?");
  for (const i of snapshot.items) if (exists.get(i.food_id)) insertItem(plan.id, { date: i.date, meal: i.meal, foodId: i.food_id, quantity: i.quantity, position: i.position });
  db.prepare("UPDATE meal_plans SET status = 'active', source = ?, previous_items = NULL WHERE id = ?").run(snapshot.source, plan.id);
});

