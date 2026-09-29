import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { named } from "../db/named.js";
import { HttpError } from "../http/problem.js";
import { addDays } from "./dates.js";
import { toLibraryFood, type LibraryRow } from "./library.js";

// Meal plans. Every number is the library's per-serving nutrition times the planned quantity,
// computed here, so the planner, the tracker and exports always agree.

export type Meal = "breakfast" | "lunch" | "snack" | "dinner";
export const MEALS: Meal[] = ["breakfast", "lunch", "snack", "dinner"];

export interface PlanRow {
  id: string;
  user_id: string;
  week_start: string;
  status: "active" | "draft";
  source: "manual" | "ai" | "rules" | "template" | null;
  previous_items: string | null;
}

export interface ItemRow {
  id: string;
  plan_id: string;
  date: string;
  meal: Meal;
  food_id: string;
  quantity: number;
  position: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
type Nutrition = { calories: number; protein: number; carbs: number; fat: number };
const zero = (): Nutrition => ({ calories: 0, protein: 0, carbs: 0, fat: 0 });
const add = (a: Nutrition, b: Nutrition): Nutrition => ({ calories: a.calories + b.calories, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat });
const round = (n: Nutrition): Nutrition => ({ calories: r1(n.calories), protein: r1(n.protein), carbs: r1(n.carbs), fat: r1(n.fat) });

/** How far from the goal still counts as on target: ±5% or ±100 kcal, whichever is larger. */
export const toleranceFor = (goal: number) => Math.max(goal * 0.05, 100);

export function goalStatus(calories: number, goal: number, planned: boolean) {
  const difference = r1(calories - goal);
  if (!planned) return { state: "empty" as const, difference };
  const tolerance = toleranceFor(goal);
  return { state: Math.abs(difference) <= tolerance ? ("on-target" as const) : difference < 0 ? ("under" as const) : ("over" as const), difference };
}

export const weekDates = (weekStart: string) => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

const planFor = db.prepare<[string, string], PlanRow>("SELECT * FROM meal_plans WHERE user_id = ? AND week_start = ?");
const insertPlan = named("INSERT INTO meal_plans (id, user_id, week_start, source) VALUES (@id, @userId, @weekStart, @source) ON CONFLICT (user_id, week_start) DO NOTHING");
const itemsOf = db.prepare<[string], ItemRow & { f: string }>(
  `SELECT i.*, json_object('id', f.id, 'user_id', f.user_id, 'name', f.name, 'meal', f.meal, 'serving', f.serving, 'calories', f.calories,
     'protein', f.protein, 'carbs', f.carbs, 'fat', f.fat, 'source', f.source, 'confidence', f.confidence, 'cuisine', f.cuisine, 'diet', f.diet,
     'allergens', f.allergens, 'ingredients', f.ingredients, 'use_count', f.use_count, 'last_used', f.last_used) AS f
   FROM plan_items i JOIN library_foods f ON f.id = i.food_id
   WHERE i.plan_id = ? ORDER BY i.date, CASE i.meal WHEN 'breakfast' THEN 0 WHEN 'lunch' THEN 1 WHEN 'snack' THEN 2 ELSE 3 END, i.position`,
);

export const getPlanRow = (userId: string, weekStart: string) => planFor.get(userId, weekStart);

/** The plan row for a week, created on first write. */
export function ensurePlan(userId: string, weekStart: string, source: PlanRow["source"] = "manual"): PlanRow {
  insertPlan.run({ id: randomUUID(), userId, weekStart, source });
  const plan = planFor.get(userId, weekStart)!;
  if (!plan.source && source) db.prepare("UPDATE meal_plans SET source = ? WHERE id = ?").run(source, plan.id);
  return planFor.get(userId, weekStart)!;
}

/** The full MealPlan response for a week. */
export function buildPlan(userId: string, weekStart: string, calorieGoal: number) {
  const plan = planFor.get(userId, weekStart);
  const rows = plan ? itemsOf.all(plan.id) : [];
  const items = rows.map(({ f, plan_id: _p, food_id: _f, ...i }) => {
    const food = toLibraryFood(JSON.parse(f) as LibraryRow);
    return { id: i.id, date: i.date, meal: i.meal, quantity: i.quantity, position: i.position, food, ...round({ calories: food.calories * i.quantity, protein: food.protein * i.quantity, carbs: food.carbs * i.quantity, fat: food.fat * i.quantity }) };
  });

  const days = weekDates(weekStart).map((date) => {
    const dayItems = items.filter((i) => i.date === date);
    const meals = Object.fromEntries(MEALS.map((m) => [m, round(dayItems.filter((i) => i.meal === m).reduce(add, zero()))])) as Record<Meal, Nutrition>;
    const total = round(dayItems.reduce(add, zero()));
    return { date, ...total, status: goalStatus(total.calories, calorieGoal, dayItems.length > 0), meals };
  });

  const planned = days.filter((d) => d.status.state !== "empty");
  return {
    weekStart,
    status: plan?.status ?? "active",
    source: plan?.source ?? null,
    calorieGoal,
    toleranceKcal: r1(toleranceFor(calorieGoal)),
    items,
    days,
    week: {
      ...round(days.reduce(add, zero())),
      plannedDays: planned.length,
      daysOnTarget: planned.filter((d) => d.status.state === "on-target").length,
      averageCalories: planned.length ? r1(planned.reduce((s, d) => s + d.calories, 0) / planned.length) : 0,
    },
  };
}
export type MealPlan = ReturnType<typeof buildPlan>;

/* ---------------- Item operations ---------------- */

const ownFood = db.prepare<[string, string], { id: string }>("SELECT id FROM library_foods WHERE id = ? AND user_id = ?");
const slotCount = db.prepare<[string, string, string], { n: number }>("SELECT count(*) AS n FROM plan_items WHERE plan_id = ? AND date = ? AND meal = ?");
const itemIn = db.prepare<[string, string], ItemRow>("SELECT * FROM plan_items WHERE id = ? AND plan_id = ?");

export const fieldError = (pointer: string, detail: string) => new HttpError(400, "validation-failed", "Your request is not valid.", undefined, [{ pointer, detail }]);

export function checkInWeek(weekStart: string, date: string, pointer = "/date") {
  if (date < weekStart || date > addDays(weekStart, 6)) throw fieldError(pointer, "Must be a day in this week.");
}

export function checkFood(userId: string, foodId: string, pointer = "/foodId") {
  if (!ownFood.get(foodId, userId)) throw fieldError(pointer, "No food with this id in your library.");
}

/** Renumbers a slot's positions to 0..n-1, keeping `first` (if given) at `firstAt`. */
function renumber(planId: string, date: string, meal: Meal, first?: { id: string; at: number }) {
  const ids = (db.prepare("SELECT id FROM plan_items WHERE plan_id = ? AND date = ? AND meal = ? ORDER BY position, created_at").all(planId, date, meal) as { id: string }[]).map((r) => r.id);
  if (first) {
    const rest = ids.filter((id) => id !== first.id);
    rest.splice(Math.min(first.at, rest.length), 0, first.id);
    ids.splice(0, ids.length, ...rest);
  }
  const set = db.prepare("UPDATE plan_items SET position = ? WHERE id = ?");
  ids.forEach((id, i) => set.run(i, id));
}

export const insertItem = (planId: string, i: { date: string; meal: Meal; foodId: string; quantity: number; position?: number }) => {
  const id = randomUUID();
  const position = i.position ?? slotCount.get(planId, i.date, i.meal)!.n;
  db.prepare("INSERT INTO plan_items (id, plan_id, date, meal, food_id, quantity, position) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, planId, i.date, i.meal, i.foodId, i.quantity, position);
  return id;
};

export const addItem = db.transaction((userId: string, weekStart: string, i: { date: string; meal: Meal; foodId: string; quantity: number }) => {
  checkInWeek(weekStart, i.date);
  checkFood(userId, i.foodId);
  const plan = ensurePlan(userId, weekStart);
  return insertItem(plan.id, i);
});

export function findItem(userId: string, weekStart: string, itemId: string) {
  const plan = planFor.get(userId, weekStart);
  const item = plan && itemIn.get(itemId, plan.id);
  if (!plan || !item) throw new HttpError(404, "not-found", "Not found.");
  return { plan, item };
}

export const updateItem = db.transaction(
  (userId: string, weekStart: string, itemId: string, patch: { date?: string; meal?: Meal; foodId?: string; quantity?: number; position?: number }) => {
    const { plan, item } = findItem(userId, weekStart, itemId);
    if (patch.date) checkInWeek(weekStart, patch.date);
    if (patch.foodId) checkFood(userId, patch.foodId);
    const date = patch.date ?? item.date;
    const meal = patch.meal ?? item.meal;
    const moved = date !== item.date || meal !== item.meal;
    db.prepare("UPDATE plan_items SET date = ?, meal = ?, food_id = ?, quantity = ?, position = ? WHERE id = ?").run(
      date,
      meal,
      patch.foodId ?? item.food_id,
      patch.quantity ?? item.quantity,
      // Moving to another slot puts the item at the end unless a position is given.
      moved ? 1_000_000 : item.position,
      item.id,
    );
    if (moved) renumber(plan.id, item.date, item.meal);
    renumber(plan.id, date, meal, patch.position !== undefined ? { id: item.id, at: patch.position } : undefined);
  },
);

export const removeItem = db.transaction((userId: string, weekStart: string, itemId: string) => {
  const { plan, item } = findItem(userId, weekStart, itemId);
  db.prepare("DELETE FROM plan_items WHERE id = ?").run(item.id);
  renumber(plan.id, item.date, item.meal);
});

/* ---------------- Day operations ---------------- */

export interface DayItem {
  meal: Meal;
  foodId: string;
  quantity: number;
}

const dayItems = db.prepare<[string, string], ItemRow>(
  `SELECT * FROM plan_items WHERE plan_id = ? AND date = ?
   ORDER BY CASE meal WHEN 'breakfast' THEN 0 WHEN 'lunch' THEN 1 WHEN 'snack' THEN 2 ELSE 3 END, position`,
);

/** Replaces a day's foods, keeping the given order within each meal. */
export const setDay = db.transaction((userId: string, weekStart: string, date: string, items: DayItem[], source?: PlanRow["source"]) => {
  checkInWeek(weekStart, date, "date");
  items.forEach((i, n) => checkFood(userId, i.foodId, `/items/${n}/foodId`));
  const plan = ensurePlan(userId, weekStart, source);
  db.prepare("DELETE FROM plan_items WHERE plan_id = ? AND date = ?").run(plan.id, date);
  for (const i of items) insertItem(plan.id, { date, ...i });
});

export const copyDay = db.transaction((userId: string, weekStart: string, from: string, to: string[], mode: "replace" | "add") => {
  checkInWeek(weekStart, from, "date");
  to.forEach((d, n) => {
    checkInWeek(weekStart, d, `/to/${n}`);
    if (d === from) throw fieldError(`/to/${n}`, "Can't copy a day onto itself.");
  });
  const plan = ensurePlan(userId, weekStart);
  const source = dayItems.all(plan.id, from);
  for (const date of to) {
    if (mode === "replace") db.prepare("DELETE FROM plan_items WHERE plan_id = ? AND date = ?").run(plan.id, date);
    for (const i of source) insertItem(plan.id, { date, meal: i.meal, foodId: i.food_id, quantity: i.quantity });
  }
});

export const copyItem = db.transaction((userId: string, weekStart: string, itemId: string, to: { date: string; meal: Meal }) => {
  const { plan, item } = findItem(userId, weekStart, itemId);
  checkInWeek(weekStart, to.date);
  insertItem(plan.id, { date: to.date, meal: to.meal, foodId: item.food_id, quantity: item.quantity });
});
