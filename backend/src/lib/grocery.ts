import * as ingredientsPrompt from "../ai/prompts/ingredients.js";
import { llm } from "../ai/llm.js";
import { db } from "../db/index.js";
import { HttpError } from "../http/problem.js";
import { GROCERY_CATEGORIES, type GroceryCategory, type Ingredient } from "./curated-foods.js";
import type { MealPlan } from "./plan.js";
import { TtlCache } from "./ttl-cache.js";

// An approximate grocery list: each planned food's main ingredients (per serving) times its
// servings, added up across the plan. Curated dishes come with ingredients; other foods are
// estimated by the AI once and stored on the library food. Without them, a food is listed as a
// dish to make or buy.

const ingredientsOf = db.prepare<[string, string], { ingredients: string | null }>("SELECT ingredients FROM library_foods WHERE id = ? AND user_id = ?");
// One AI call estimates at most this many foods; the rest wait for the next export.
const PER_CALL = 40;
// Sensible per-serving amounts; anything else is dropped.
const MAX_AMOUNT = { g: 2000, ml: 2000, pc: 20 } as const;
// One estimate at a time per user (previews can overlap), and a pause after a failure so
// previews don't keep retrying.
const running = new Map<string, Promise<void>>();
const failedRecently = new TtlCache<true>(10 * 60_000);
const setIngredients = db.prepare<[string, string, string]>("UPDATE library_foods SET ingredients = ? WHERE id = ? AND user_id = ? AND ingredients IS NULL");

/**
 * Estimates ingredients for the foods planned on `dates` that have none yet, in one AI call, and
 * stores them so no food is estimated twice. `aiAllowed` is asked only when there's something to
 * estimate. Without the AI, nothing is stored and those foods are listed by name.
 */
export async function ensureIngredients(userId: string, plan: MealPlan, dates: string[], aiAllowed: () => boolean) {
  const busy = running.get(userId);
  if (busy) await busy;
  const unknown = [...new Map(plan.items.filter((i) => dates.includes(i.date) && ingredientsOf.get(i.food.id, userId)?.ingredients == null).map((i) => [i.food.id, i.food])).values()].slice(0, PER_CALL);
  if (!unknown.length || failedRecently.get(userId) || !aiAllowed()) return;
  const run = estimate(userId, unknown).finally(() => running.delete(userId));
  running.set(userId, run);
  await run;
}

async function estimate(userId: string, foods: MealPlan["items"][number]["food"][]) {
  try {
    const out = await llm().json(
      {
        messages: ingredientsPrompt.messages(foods.map((f) => ({ id: f.id, name: f.name, serving: f.serving }))),
        name: "ingredients",
        jsonSchema: ingredientsPrompt.jsonSchema(foods.map((f) => f.id)),
        schema: ingredientsPrompt.schema,
        maxTokens: 6000,
        timeoutMs: 45_000,
      },
      { prompt: ingredientsPrompt.PROMPT, userId },
    );
    const byId = new Map(out.foods.map((f) => [f.id, f.ingredients]));
    for (const f of foods) {
      // A food the model skipped is stored as having no known ingredients, so it isn't asked about again.
      const list: Ingredient[] = (byId.get(f.id) ?? []).filter((i) => i.amount > 0 && i.amount <= MAX_AMOUNT[i.unit]).slice(0, ingredientsPrompt.MAX_INGREDIENTS);
      setIngredients.run(JSON.stringify(list), f.id, userId);
    }
  } catch (err) {
    // Unavailable, busy or filtered: the list falls back to dish names for now.
    if (!(err instanceof HttpError)) throw err;
    failedRecently.set(userId, true);
  }
}

/** Rounds to what someone would write on a list: 5 g/ml steps under 100, 10 above; whole pieces. */
function approx(amount: number, unit: Ingredient["unit"]) {
  if (unit === "pc") return `${Math.max(1, Math.ceil(amount - 0.05))}`;
  const n = amount < 100 ? Math.max(5, Math.round(amount / 5) * 5) : Math.round(amount / 10) * 10;
  return `${n.toLocaleString("en-US")} ${unit}`;
}

export interface GroceryList {
  categories: { name: GroceryCategory; lines: { name: string; amount: string }[] }[];
  /** Foods without known ingredients, to make or buy as they are. */
  dishes: { name: string; servings: number }[];
}

/** The list for the plan's items on the given dates. */
export function groceryList(userId: string, plan: MealPlan, dates: string[]): GroceryList {
  const totals = new Map<string, { name: string; unit: Ingredient["unit"]; category: GroceryCategory; amount: number }>();
  const dishes = new Map<string, { name: string; servings: number }>();
  for (const item of plan.items.filter((i) => dates.includes(i.date))) {
    const stored = ingredientsOf.get(item.food.id, userId)?.ingredients;
    const list = stored ? (JSON.parse(stored) as Ingredient[]) : [];
    if (!list.length) {
      const d = dishes.get(item.food.id) ?? { name: item.food.name, servings: 0 };
      d.servings += item.quantity;
      dishes.set(item.food.id, d);
      continue;
    }
    for (const ing of list) {
      const key = `${ing.name.toLowerCase()}|${ing.unit}`;
      const t = totals.get(key) ?? { name: ing.name, unit: ing.unit, category: ing.category, amount: 0 };
      t.amount += ing.amount * item.quantity;
      totals.set(key, t);
    }
  }
  const all = [...totals.values()];
  return {
    categories: GROCERY_CATEGORIES.map((name) => ({
      name,
      lines: all
        .filter((t) => t.category === name)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((t) => ({ name: t.name, amount: approx(t.amount, t.unit) })),
    })).filter((c) => c.lines.length),
    dishes: [...dishes.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}
