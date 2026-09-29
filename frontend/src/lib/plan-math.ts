import type { GoalStatus, LibraryFood, MealPlan, Nutrition, PlanItem } from "./api";
import type { MealType } from "./types";
import { weekDates } from "./week";

// Mirrors the server's plan maths (backend lib/plan.ts) so the UI can update instantly while a
// change is saving. The server's response always replaces this afterwards.

export const PLAN_MEALS: MealType[] = ["breakfast", "lunch", "snack", "dinner"];

const r1 = (n: number) => Math.round(n * 10) / 10;
const zero = (): Nutrition => ({ calories: 0, protein: 0, carbs: 0, fat: 0 });
const add = (a: Nutrition, b: Nutrition): Nutrition => ({ calories: a.calories + b.calories, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat });
const round = (n: Nutrition): Nutrition => ({ calories: r1(n.calories), protein: r1(n.protein), carbs: r1(n.carbs), fat: r1(n.fat) });

/** ±5% of the goal or ±100 kcal, whichever is larger. */
export const toleranceFor = (goal: number) => Math.max(goal * 0.05, 100);

export function goalStatus(calories: number, goal: number, planned: boolean): GoalStatus {
  const difference = r1(calories - goal);
  if (!planned) return { state: "empty", difference };
  return { state: Math.abs(difference) <= toleranceFor(goal) ? "on-target" : difference < 0 ? "under" : "over", difference };
}

export const itemNutrition = (food: LibraryFood, quantity: number): Nutrition =>
  round({ calories: food.calories * quantity, protein: food.protein * quantity, carbs: food.carbs * quantity, fat: food.fat * quantity });

const MEAL_ORDER: Record<MealType, number> = { breakfast: 0, lunch: 1, snack: 2, dinner: 3 };

/** Recomputes every total from the items, exactly as the server does. */
export function computePlan(base: MealPlan, rawItems: PlanItem[]): MealPlan {
  const items = rawItems
    .map((i) => ({ ...i, ...itemNutrition(i.food, i.quantity) }))
    .sort((a, b) => a.date.localeCompare(b.date) || MEAL_ORDER[a.meal] - MEAL_ORDER[b.meal] || a.position - b.position);
  const days = weekDates(base.weekStart).map((date) => {
    const dayItems = items.filter((i) => i.date === date);
    const meals = Object.fromEntries(PLAN_MEALS.map((m) => [m, round(dayItems.filter((i) => i.meal === m).reduce<Nutrition>(add, zero()))])) as Record<MealType, Nutrition>;
    const total = round(dayItems.reduce<Nutrition>(add, zero()));
    return { date, ...total, status: goalStatus(total.calories, base.calorieGoal, dayItems.length > 0), meals };
  });
  const planned = days.filter((d) => d.status.state !== "empty");
  return {
    ...base,
    items,
    days,
    week: {
      ...round(days.reduce<Nutrition>(add, zero())),
      plannedDays: planned.length,
      daysOnTarget: planned.filter((d) => d.status.state === "on-target").length,
      averageCalories: planned.length ? r1(planned.reduce((s, d) => s + d.calories, 0) / planned.length) : 0,
    },
  };
}

/** Renumbers positions within each slot, in the given order. */
export function renumber(items: PlanItem[]): PlanItem[] {
  const next = new Map<string, number>();
  return items.map((i) => {
    const key = `${i.date}|${i.meal}`;
    const position = next.get(key) ?? 0;
    next.set(key, position + 1);
    return { ...i, position };
  });
}

const FRACTIONS: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾" };
/** 1.5 → "1½", 0.25 → "¼", 2 → "2". */
export function formatQuantity(q: number): string {
  const whole = Math.floor(q);
  const frac = FRACTIONS[String(r1(q - whole))] ?? "";
  return `${whole || (frac ? "" : "0")}${frac}`;
}
