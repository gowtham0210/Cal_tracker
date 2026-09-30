import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { addItem, buildPlan, checkInWeek, copyDay, copyItem, logMeal, removeItem, setDay, updateItem, weekDates } from "../lib/plan.js";
import { toFood, type FoodRow } from "./food.js";
import { discardDraft, fillDraft, keepDraft, prepareDraft } from "../lib/plan-generate.js";
import { swapOptions } from "../lib/plan-swap.js";
import { applyTemplate } from "../lib/templates.js";
import { planPdf } from "../lib/plan-pdf.js";
import { ensureIngredients, groceryList } from "../lib/grocery.js";
import { db } from "../db/index.js";
import { body, date, mealType, parse, uuid } from "../http/validate.js";
import { HttpError, type Problem } from "../http/problem.js";
import { aiRateLimit } from "./coach.js";
import { requireProfile } from "./profile.js";

export const monday = date.refine((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 1, "Must be a Monday.");
export const quantity = z
  .number("Must be a number.")
  .min(0.25, "Must be at least 0.25.")
  .max(10, "Must be at most 10.")
  .refine((q) => Number.isInteger(q * 4), "Use quarter servings (0.25 steps).");

export const weekParam = (req: Request) => parse(z.object({ weekStart: monday }), { weekStart: req.params.weekStart }).weekStart;
const itemParam = (req: Request) => parse(z.object({ itemId: uuid }), { itemId: req.params.itemId }).itemId;

/** The plan response for the current user and week. */
export const planResponse = (userId: string, weekStart: string) => {
  const p = requireProfile(userId);
  return buildPlan(userId, weekStart, p.calorieGoal, p.allergies);
};

const itemInput = body({ date, meal: mealType, foodId: uuid, quantity: quantity.default(1) });
const itemPatch = body({ date: date.optional(), meal: mealType.optional(), foodId: uuid.optional(), quantity: quantity.optional(), position: z.int().min(0).optional() }).refine(
  (v) => Object.keys(v).length > 0,
  "Send at least one field.",
);

export const plans = Router();

plans.get("/:weekStart", (req, res) => {
  res.json(planResponse(res.locals.userId, weekParam(req)));
});

plans.post("/:weekStart/items", (req, res) => {
  const weekStart = weekParam(req);
  requireProfile(res.locals.userId);
  addItem(res.locals.userId, weekStart, parse(itemInput, req.body));
  res.status(201).json(planResponse(res.locals.userId, weekStart));
});

plans.patch("/:weekStart/items/:itemId", (req, res) => {
  const weekStart = weekParam(req);
  updateItem(res.locals.userId, weekStart, itemParam(req), parse(itemPatch, req.body));
  res.json(planResponse(res.locals.userId, weekStart));
});

plans.delete("/:weekStart/items/:itemId", (req, res) => {
  const weekStart = weekParam(req);
  removeItem(res.locals.userId, weekStart, itemParam(req));
  res.json(planResponse(res.locals.userId, weekStart));
});

const slotRef = body({ date, meal: mealType });
const dayParam = (req: Request) => parse(z.object({ date }), { date: req.params.date }).date;
const dayItemsInput = body({
  items: z.array(z.strictObject({ meal: mealType, foodId: uuid, quantity }), "Send a list of items.").max(60, "At most 60 foods a day."),
});
const copyDayInput = body({
  to: z
    .array(date)
    .min(1, "Choose at least one day.")
    .max(6)
    .refine((d) => new Set(d).size === d.length, "Each day once."),
  mode: z.enum(["replace", "add"], "Must be replace or add."),
});

/** Counts an AI call against the user's limit; over the limit, the caller carries on without the AI. */
function aiAllowed(req: Request, res: Response) {
  try {
    aiRateLimit(req, res, () => {});
    return true;
  } catch {
    res.removeHeader("Retry-After");
    return false;
  }
}

// The ranking alone never costs an AI call, so going over the AI limit only turns the AI off.
plans.get("/:weekStart/items/:itemId/swaps", async (req, res) => {
  const weekStart = weekParam(req);
  res.json(await swapOptions(res.locals.userId, requireProfile(res.locals.userId), weekStart, itemParam(req), () => aiAllowed(req, res)));
});

plans.post("/:weekStart/items/:itemId/copy", (req, res) => {
  const weekStart = weekParam(req);
  copyItem(res.locals.userId, weekStart, itemParam(req), parse(slotRef, req.body));
  res.status(201).json(planResponse(res.locals.userId, weekStart));
});

plans.put("/:weekStart/days/:date", (req, res) => {
  const weekStart = weekParam(req);
  requireProfile(res.locals.userId);
  setDay(res.locals.userId, weekStart, dayParam(req), parse(dayItemsInput, req.body).items);
  res.json(planResponse(res.locals.userId, weekStart));
});

// Logs a planned meal to the food log, with the plan's numbers.
plans.post("/:weekStart/days/:date/meals/:meal/log", (req, res) => {
  const weekStart = weekParam(req);
  requireProfile(res.locals.userId);
  const { meal } = parse(z.object({ meal: mealType }), { meal: req.params.meal });
  const rows = logMeal(res.locals.userId, weekStart, dayParam(req), meal) as FoodRow[];
  res.status(201).json({ entries: rows.map(toFood), plan: planResponse(res.locals.userId, weekStart) });
});

plans.post("/:weekStart/apply-template", (req, res) => {
  const weekStart = weekParam(req);
  requireProfile(res.locals.userId);
  const { templateId, mode } = parse(body({ templateId: uuid, mode: z.enum(["replace", "fill"], "Must be replace or fill.") }), req.body);
  applyTemplate(res.locals.userId, weekStart, templateId, mode);
  res.json(planResponse(res.locals.userId, weekStart));
});

plans.post("/:weekStart/days/:date/copy", (req, res) => {
  const weekStart = weekParam(req);
  requireProfile(res.locals.userId);
  const { to, mode } = parse(copyDayInput, req.body);
  copyDay(res.locals.userId, weekStart, dayParam(req), to, mode);
  res.json(planResponse(res.locals.userId, weekStart));
});

/* ---------------- Drafts ---------------- */

const generateInput = body({
  scope: z.enum(["week", "day"], "Must be week or day."),
  date: date.optional(),
  mode: z.enum(["usual", "mix"], "Must be usual or mix."),
}).superRefine((v, ctx) => {
  if (v.scope === "day" && !v.date) ctx.addIssue({ code: "custom", path: ["date"], message: "Choose the day to plan." });
});

// Days are planned one at a time. With Accept: text/event-stream, each is sent as it is saved
// (`day` events carrying the plan so far), then `done` with the finished draft.
plans.post("/:weekStart/generate", aiRateLimit, async (req, res) => {
  const weekStart = weekParam(req);
  const profile = requireProfile(res.locals.userId);
  const input = parse(generateInput, req.body);
  if (input.scope === "day") checkInWeek(weekStart, input.date!);
  const dates = input.scope === "day" ? [input.date!] : weekDates(weekStart);
  const userId = res.locals.userId;
  const run = prepareDraft(userId, profile, weekStart, input.mode);

  if (req.accepts(["application/json", "text/event-stream"]) !== "text/event-stream") {
    await fillDraft(run, dates);
    res.json(planResponse(userId, weekStart));
    return;
  }
  const abort = new AbortController();
  res.on("close", () => {
    if (!res.writableFinished) abort.abort();
  });
  res.status(200).set({ "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders();
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  try {
    await fillDraft(run, dates, { onDay: (date) => void send("day", { date, plan: planResponse(userId, weekStart) }), signal: abort.signal });
  } catch (err) {
    // Headers are gone, so the failure is reported in the stream. The draft keeps the days already saved.
    const e = err instanceof HttpError ? err : new HttpError(500, "internal", "Something went wrong while planning.");
    send("error", { type: `https://lighter.app/problems/${e.slug}`, title: e.title, status: e.status, detail: e.detail } satisfies Problem);
    res.end();
    return;
  }
  if (abort.signal.aborted) return;
  send("done", planResponse(userId, weekStart));
  res.end();
});

plans.post("/:weekStart/draft/keep", (req, res) => {
  const weekStart = weekParam(req);
  keepDraft(res.locals.userId, weekStart);
  res.json(planResponse(res.locals.userId, weekStart));
});

plans.post("/:weekStart/draft/discard", (req, res) => {
  const weekStart = weekParam(req);
  discardDraft(res.locals.userId, weekStart);
  res.json(planResponse(res.locals.userId, weekStart));
});

/* ---------------- Export ---------------- */

const userName = db.prepare<[string], { name: string }>("SELECT name FROM users WHERE id = ?");
const exportQuery = z
  .object({
    scope: z.enum(["week", "day"], "Must be week or day.").default("week"),
    date: date.optional(),
    includeMacros: z.enum(["true", "false"], "Must be true or false.").default("false"),
    includeGrocery: z.enum(["true", "false"], "Must be true or false.").default("false"),
  })
  .superRefine((v, ctx) => {
    if (v.scope === "day" && !v.date) ctx.addIssue({ code: "custom", path: ["date"], message: "Choose the day to export." });
  });

plans.get("/:weekStart/export", async (req, res) => {
  const weekStart = weekParam(req);
  const q = parse(exportQuery, req.query);
  if (q.scope === "day") checkInWeek(weekStart, q.date!);
  const plan = planResponse(res.locals.userId, weekStart);
  let grocery;
  if (q.includeGrocery === "true") {
    // Estimating ingredients costs an AI call only for foods that have none yet.
    const dates = q.scope === "day" ? [q.date!] : weekDates(weekStart);
    await ensureIngredients(res.locals.userId, plan, dates, () => aiAllowed(req, res));
    grocery = groceryList(res.locals.userId, plan, dates);
  }
  const pdf = await planPdf({ plan, name: userName.get(res.locals.userId)?.name ?? "", scope: q.scope, date: q.date, macros: q.includeMacros === "true", grocery });
  res
    .status(200)
    .set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="meal-plan-${q.scope === "day" ? q.date : weekStart}.pdf"`, "Cache-Control": "no-store" })
    .send(pdf);
});
