import { randomUUID } from "node:crypto";
import { SqliteError } from "better-sqlite3";
import { db } from "../db/index.js";
import { iso } from "./dates.js";
import { HttpError } from "../http/problem.js";
import { ensurePlan, fieldError, getPlanRow, insertItem, MEALS, planNutrition, weekDates, type ItemRow, type Meal } from "./plan.js";
import type { LibraryRow } from "./library.js";

// Plan templates: a week's foods saved as weekday offsets, applied to any week by replacing it or
// by filling only its empty meals. Numbers always come from the library at the time of use, and
// foods that were deleted from the library are skipped.

interface TemplateRow {
  id: string;
  user_id: string;
  name: string;
  created_at: number;
}
type TemplateItem = { day_offset: number; meal: Meal; quantity: number; position: number } & Pick<LibraryRow, "id" | "name" | "calories" | "diet">;

const templatesOf = db.prepare<[string], TemplateRow>("SELECT * FROM plan_templates WHERE user_id = ? ORDER BY created_at DESC, name");
const templateOf = db.prepare<[string, string], TemplateRow>("SELECT * FROM plan_templates WHERE id = ? AND user_id = ?");
// Joining the owner's library drops foods that no longer exist.
const itemsOf = db.prepare<[string], TemplateItem>(
  `SELECT t.day_offset, t.meal, t.quantity, t.position, f.id, f.name, f.calories, f.diet
   FROM template_items t JOIN plan_templates p ON p.id = t.template_id JOIN library_foods f ON f.id = t.food_id AND f.user_id = p.user_id
   WHERE t.template_id = ? ORDER BY t.day_offset, CASE t.meal WHEN 'breakfast' THEN 0 WHEN 'lunch' THEN 1 WHEN 'snack' THEN 2 ELSE 3 END, t.position`,
);

function toTemplate(t: TemplateRow) {
  const items = itemsOf.all(t.id);
  const days = Array.from({ length: 7 }, (_, offset) => {
    const dayItems = items.filter((i) => i.day_offset === offset);
    return {
      offset,
      calories: Math.round(dayItems.reduce((s, i) => s + planNutrition({ calories: i.calories, protein: 0, carbs: 0, fat: 0 }, i.quantity).calories, 0)),
      meals: Object.fromEntries(MEALS.map((m) => [m, dayItems.filter((i) => i.meal === m).map((i) => i.name)])) as Record<Meal, string[]>,
    };
  });
  const planned = days.filter((d) => MEALS.some((m) => d.meals[m].length));
  return {
    id: t.id,
    name: t.name,
    createdAt: iso(t.created_at),
    plannedDays: planned.length,
    averageCalories: planned.length ? Math.round(planned.reduce((s, d) => s + d.calories, 0) / planned.length) : 0,
    dietTags: [...new Set(items.map((i) => i.diet).filter((d) => d !== null))].sort(),
    days,
  };
}
export type Template = ReturnType<typeof toTemplate>;

export const listTemplates = (userId: string) => templatesOf.all(userId).map(toTemplate);

function findTemplate(userId: string, id: string) {
  const t = templateOf.get(id, userId);
  if (!t) throw new HttpError(404, "not-found", "Not found.");
  return t;
}

const weekItems = db.prepare<[string], ItemRow>("SELECT * FROM plan_items WHERE plan_id = ? ORDER BY date, meal, position");

/** Saves the week's foods under a name. */
export const saveTemplate = db.transaction((userId: string, name: string, weekStart: string) => {
  const plan = getPlanRow(userId, weekStart);
  const items = plan ? weekItems.all(plan.id) : [];
  if (!items.length) throw fieldError("/weekStart", "This week has nothing planned to save.");
  const id = randomUUID();
  try {
    db.prepare("INSERT INTO plan_templates (id, user_id, name) VALUES (?, ?, ?)").run(id, userId, name);
  } catch (err) {
    if (err instanceof SqliteError && err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new HttpError(409, "template-exists", "You already have a template with this name.", undefined, [{ pointer: "/name", detail: "Choose another name." }]);
    }
    throw err;
  }
  const days = weekDates(weekStart);
  const insert = db.prepare("INSERT INTO template_items (id, template_id, day_offset, meal, food_id, quantity, position) VALUES (?, ?, ?, ?, ?, ?, ?)");
  for (const i of items) insert.run(randomUUID(), id, days.indexOf(i.date), i.meal, i.food_id, i.quantity, i.position);
  return toTemplate(templateOf.get(id, userId)!);
});

export function deleteTemplate(userId: string, id: string) {
  findTemplate(userId, id);
  db.prepare("DELETE FROM plan_templates WHERE id = ?").run(id);
}

const slotHasFood = db.prepare<[string, string, string], { n: number }>("SELECT count(*) AS n FROM plan_items WHERE plan_id = ? AND date = ? AND meal = ?");

/** Replace: the week becomes the template. Fill: the template's foods go only into meals that are empty. */
export const applyTemplate = db.transaction((userId: string, weekStart: string, templateId: string, mode: "replace" | "fill") => {
  const t = findTemplate(userId, templateId);
  const plan = ensurePlan(userId, weekStart);
  // Discarding the draft afterwards would silently undo the template.
  if (plan.status === "draft") throw new HttpError(409, "draft-open", "Keep or discard this week's draft before applying a template.");
  const days = weekDates(weekStart);
  if (mode === "replace") db.prepare("DELETE FROM plan_items WHERE plan_id = ?").run(plan.id);
  const items = itemsOf.all(t.id);
  // In fill mode, whether a slot was empty is decided before any of the template goes in.
  const empty = new Set(
    MEALS.flatMap((meal) => days.map((date) => `${date}|${meal}`)).filter((k) => {
      const [date, meal] = k.split("|");
      return slotHasFood.get(plan.id, date, meal)!.n === 0;
    }),
  );
  for (const i of items) {
    const date = days[i.day_offset];
    if (mode === "fill" && !empty.has(`${date}|${i.meal}`)) continue;
    insertItem(plan.id, { date, meal: i.meal, foodId: i.id, quantity: i.quantity });
  }
  db.prepare("UPDATE meal_plans SET source = 'template' WHERE id = ?").run(plan.id);
});
