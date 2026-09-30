import { randomUUID } from "node:crypto";
import { SqliteError } from "better-sqlite3";
import * as newFoods from "../ai/prompts/new-foods.js";
import { llm } from "../ai/llm.js";
import { db } from "../db/index.js";
import { named } from "../db/named.js";
import { HttpError } from "../http/problem.js";
import type { Profile } from "../routes/profile.js";
import type { Diet } from "./curated-foods.js";
import { ALLERGENS, allergyConflicts, detectAllergens, detectDiet, normalizeAllergies } from "./food-tags.js";
import { syncLibrary, toLibraryFood, type LibraryRow } from "./library.js";
import { dietAllowed, isYours } from "./plan-generate.js";

// "Try new": the AI suggests foods close to what the user eats. Suggestions are only shown; a
// food joins the library (source "ai") when the user accepts it, possibly edited, and from then
// on its numbers are fixed like any library food.

const DIET_RANK: Record<Diet, number> = { veg: 0, eggetarian: 1, "non-veg": 2 };

/** The stricter of what we were told and what the name suggests: "Chicken 65" is non-veg whatever the label says. */
export const tagDiet = (name: string, given?: Diet | null): Diet => {
  const detected = detectDiet(name);
  return given && DIET_RANK[given] > DIET_RANK[detected] ? given : detected;
};
/** Standard allergens we were told about, plus any the name suggests. */
export const tagAllergens = (name: string, given: string[] = []): string[] =>
  [...new Set([...normalizeAllergies(given).filter((a) => (ALLERGENS as readonly string[]).includes(a)), ...detectAllergens(name)])].sort();

const libraryRows = db.prepare<[string], LibraryRow>("SELECT * FROM library_foods WHERE user_id = ? ORDER BY use_count DESC, name COLLATE NOCASE");
const r1 = (n: number) => Math.round(n * 10) / 10;

export async function suggestNewFoods(userId: string, p: Profile, meal?: LibraryRow["meal"]) {
  syncLibrary(userId);
  const rows = libraryRows.all(userId);
  const taken = new Set(rows.map((r) => r.name.toLowerCase()));
  const usual = rows.filter(isYours).slice(0, 15).map((r) => r.name);
  const facts: newFoods.NewFoodFacts = {
    count: 5,
    ...(meal ? { meal } : {}),
    usualFoods: usual,
    avoid: rows.map((r) => r.name).slice(0, 150),
    dietType: p.dietType,
    allergies: p.allergies,
    cuisine: p.cuisine,
    budget: p.budget,
    dailyBudget: p.dailyBudget,
  };
  const out = await llm().json(
    { messages: newFoods.messages(facts), name: "new_foods", jsonSchema: newFoods.jsonSchema, schema: newFoods.schema, maxTokens: 4000, timeoutMs: 45_000 },
    { prompt: newFoods.PROMPT, userId },
  );

  const seen = new Set<string>();
  return out.suggestions.flatMap((s) => {
    const key = s.name.toLowerCase();
    if (taken.has(key) || seen.has(key) || (meal && s.meal !== meal)) return [];
    const diet = tagDiet(s.name, s.diet);
    const allergens = tagAllergens(s.name, s.allergens);
    // The model is asked to respect these; the server makes sure.
    if (!dietAllowed(p.dietType, diet) || allergyConflicts({ name: s.name, allergens }, p.allergies).length) return [];
    seen.add(key);
    const fromMacros = s.protein * 4 + s.carbs * 4 + s.fat * 9;
    const inconsistent = s.calories > 50 && Math.abs(fromMacros - s.calories) / s.calories > 0.35;
    return [
      {
        name: s.name.slice(0, 60),
        meal: s.meal,
        serving: s.serving,
        calories: Math.round(s.calories),
        protein: r1(s.protein),
        carbs: r1(s.carbs),
        fat: r1(s.fat),
        confidence: inconsistent ? ("low" as const) : s.confidence,
        cuisine: s.cuisine,
        diet,
        allergens,
        basedOn: usual.find((n) => n.toLowerCase() === s.basedOn?.toLowerCase()) ?? null,
        reason: s.reason.slice(0, 60),
      },
    ];
  });
}

export interface NewFoodInput {
  name: string;
  meal: LibraryRow["meal"];
  serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence?: "high" | "medium" | "low";
  cuisine?: string | null;
  diet?: Diet | null;
  allergens?: string[];
}

const insertAi = named(
  `INSERT INTO library_foods (id, user_id, name, meal, serving, calories, protein, carbs, fat, source, confidence, cuisine, diet, allergens)
   VALUES (@id, @userId, @name, @meal, @serving, @calories, @protein, @carbs, @fat, 'ai', @confidence, @cuisine, @diet, @allergens)`,
);
const byName = db.prepare<[string, string], LibraryRow>("SELECT * FROM library_foods WHERE user_id = ? AND name = ?");

/** Saves a reviewed suggestion to the library. */
export function acceptNewFood(userId: string, p: Profile, f: NewFoodInput) {
  syncLibrary(userId);
  try {
    insertAi.run({
      id: randomUUID(),
      userId,
      ...f,
      confidence: f.confidence ?? "medium",
      cuisine: f.cuisine ?? null,
      diet: tagDiet(f.name, f.diet),
      allergens: JSON.stringify(tagAllergens(f.name, f.allergens)),
    });
  } catch (err) {
    // Names are unique per user, ignoring case.
    if (err instanceof SqliteError && err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new HttpError(409, "library-food-exists", "This food is already in your library.", undefined, [{ pointer: "/name", detail: "A food with this name is already in your library." }]);
    }
    throw err;
  }
  return toLibraryFood(byName.get(userId, f.name)!, p.allergies);
}
