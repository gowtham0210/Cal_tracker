import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { named } from "../db/named.js";
import { CURATED_FOODS, CUISINE_STYLES, type Cuisine } from "./curated-foods.js";
import { allergyConflicts, detectAllergens, detectDiet } from "./food-tags.js";

// The food library: the planner's source of truth for nutrition. It is kept in sync with the
// user's food log and favorites, and seeded with curated dishes.

export interface LibraryRow {
  id: string;
  user_id: string;
  name: string;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: "logged" | "favorite" | "curated" | "ai";
  confidence: "high" | "medium" | "low" | null;
  cuisine: string | null;
  diet: "veg" | "eggetarian" | "non-veg" | null;
  allergens: string;
  ingredients: string | null;
  use_count: number;
  last_used: string | null;
}

/** A library food for the API. `allergies` are the user's, to flag conflicts. */
export const toLibraryFood = (r: LibraryRow, allergies: string[]) => {
  const allergens = JSON.parse(r.allergens) as string[];
  return {
  id: r.id,
  name: r.name,
  meal: r.meal,
  serving: r.serving,
  calories: r.calories,
  protein: r.protein,
  carbs: r.carbs,
  fat: r.fat,
  source: r.source,
  confidence: r.confidence,
  cuisine: r.cuisine,
  diet: r.diet,
  allergens,
  allergyConflicts: allergyConflicts({ name: r.name, allergens, ingredients: r.ingredients ? (JSON.parse(r.ingredients) as { name: string }[]).map((i) => i.name) : [] }, allergies),
  useCount: r.use_count,
  };
};
export type LibraryFood = ReturnType<typeof toLibraryFood>;

const insertCurated = named(
  `INSERT INTO library_foods (id, user_id, name, meal, serving, calories, protein, carbs, fat, source, cuisine, diet, allergens, ingredients)
   VALUES (@id, @userId, @name, @meal, @serving, @calories, @protein, @carbs, @fat, 'curated', @cuisine, @diet, @allergens, @ingredients)
   ON CONFLICT (user_id, name) DO NOTHING`,
);

// Per food name: the latest logged values, how often it was logged, and the meal it is most often eaten at.
const loggedFoods = db.prepare<[string], { name: string; meal: LibraryRow["meal"]; calories: number; protein: number; carbs: number; fat: number; n: number; last: string }>(
  // Entries logged from a plan hold a whole portion, not one serving, so they never set a food's values.
  `WITH e AS (SELECT name, meal, calories, protein, carbs, fat, date, created_at, source, lower(name) AS k FROM food_entries WHERE user_id = ?),
   latest AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY k ORDER BY date DESC, created_at DESC) AS rn FROM e WHERE source != 'plan'),
   counts AS (SELECT k, count(*) AS n, max(date) AS last FROM e GROUP BY k),
   meals AS (SELECT k, meal, ROW_NUMBER() OVER (PARTITION BY k ORDER BY count(*) DESC, max(date) DESC) AS rn FROM e GROUP BY k, meal)
   SELECT l.name, m.meal, l.calories, l.protein, l.carbs, l.fat, c.n, c.last
   FROM latest l JOIN counts c ON c.k = l.k JOIN meals m ON m.k = l.k AND m.rn = 1
   WHERE l.rn = 1`,
);
const upsertLogged = named(
  `INSERT INTO library_foods (id, user_id, name, meal, serving, calories, protein, carbs, fat, source, diet, allergens, use_count, last_used)
   VALUES (@id, @userId, @name, @meal, '1 serving', @calories, @protein, @carbs, @fat, 'logged', @diet, @allergens, @n, @last)
   ON CONFLICT (user_id, name) DO UPDATE SET
     use_count = excluded.use_count,
     last_used = excluded.last_used,
     -- Only foods that came from the log follow the latest logged values; curated, favorite and
     -- reviewed AI foods keep their nutrition.
     meal = CASE WHEN library_foods.source = 'logged' THEN excluded.meal ELSE library_foods.meal END,
     calories = CASE WHEN library_foods.source = 'logged' THEN excluded.calories ELSE library_foods.calories END,
     protein = CASE WHEN library_foods.source = 'logged' THEN excluded.protein ELSE library_foods.protein END,
     carbs = CASE WHEN library_foods.source = 'logged' THEN excluded.carbs ELSE library_foods.carbs END,
     fat = CASE WHEN library_foods.source = 'logged' THEN excluded.fat ELSE library_foods.fat END
   WHERE library_foods.use_count IS NOT excluded.use_count OR library_foods.last_used IS NOT excluded.last_used
      OR (library_foods.source = 'logged' AND (library_foods.calories IS NOT excluded.calories OR library_foods.meal IS NOT excluded.meal))`,
);
const newFavorites = db.prepare<[string, string], { name: string; meal: LibraryRow["meal"]; calories: number; protein: number; carbs: number; fat: number }>(
  `SELECT name, meal, calories, protein, carbs, fat FROM favorite_foods f WHERE user_id = ?
   AND NOT EXISTS (SELECT 1 FROM library_foods l WHERE l.user_id = ? AND l.name = f.name)`,
);
const insertFavorite = named(
  `INSERT INTO library_foods (id, user_id, name, meal, serving, calories, protein, carbs, fat, source, diet, allergens)
   VALUES (@id, @userId, @name, @meal, '1 serving', @calories, @protein, @carbs, @fat, 'favorite', @diet, @allergens)`,
);
// Logged foods and favorites saved before tags were detected.
const untagged = db.prepare<[string], { id: string; name: string }>("SELECT id, name FROM library_foods WHERE user_id = ? AND source IN ('logged', 'favorite') AND diet IS NULL");
const setTags = db.prepare<[string, string, string]>("UPDATE library_foods SET diet = ?, allergens = ? WHERE id = ?");
const tags = (name: string) => ({ diet: detectDiet(name), allergens: JSON.stringify(detectAllergens(name)) });
// Foods only ever logged from a plan still count as eaten.
const syncUseCounts = db.prepare<[string, string]>(
  `UPDATE library_foods SET use_count = c.n, last_used = c.last
   FROM (SELECT lower(name) AS k, count(*) AS n, max(date) AS last FROM food_entries WHERE user_id = ? GROUP BY k) AS c
   WHERE library_foods.user_id = ? AND lower(library_foods.name) = c.k AND (library_foods.use_count IS NOT c.n OR library_foods.last_used IS NOT c.last)`,
);
const curatedSeeded = db.prepare<[string], { n: number }>("SELECT count(*) AS n FROM library_foods WHERE user_id = ? AND source = 'curated'");

/** Brings the library up to date with the user's log and favorites (cheap when nothing changed). */
export const syncLibrary = db.transaction((userId: string) => {
  if (curatedSeeded.get(userId)!.n === 0) {
    for (const f of CURATED_FOODS) {
      insertCurated.run({
        id: randomUUID(),
        userId,
        ...f,
        allergens: JSON.stringify(f.allergens),
        ingredients: JSON.stringify(f.ingredients),
      });
    }
  }
  for (const f of loggedFoods.all(userId)) upsertLogged.run({ id: randomUUID(), userId, ...f, ...tags(f.name) });
  syncUseCounts.run(userId, userId);
  for (const f of newFavorites.all(userId, userId)) insertFavorite.run({ id: randomUUID(), userId, ...f, ...tags(f.name) });
  for (const f of untagged.all(userId)) {
    const t = tags(f.name);
    setTags.run(t.diet, t.allergens, f.id);
  }
});

export function listLibrary(userId: string, opts: { tab: "usual" | "favorites" | "new" | "all"; meal?: string; q?: string; cuisine: Cuisine; allergies: string[] }) {
  syncLibrary(userId);
  const where = ["user_id = @userId"];
  const params: Record<string, unknown> = { userId, meal: opts.meal, q: opts.q ? `%${opts.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : undefined };
  if (opts.meal) where.push("meal = @meal");
  let order = "name COLLATE NOCASE";

  if (opts.q) {
    where.push("name LIKE @q ESCAPE '\\'");
    order = "use_count DESC, name COLLATE NOCASE";
  } else if (opts.tab === "favorites") {
    where.push("lower(name) IN (SELECT lower(name) FROM favorite_foods WHERE user_id = @userId)");
  } else if (opts.tab === "new") {
    where.push("source = 'ai'");
  } else if (opts.tab === "usual") {
    // The user's own foods first (most eaten), then curated dishes in their food style.
    const styles = CUISINE_STYLES[opts.cuisine];
    const styleList = styles.filter((s) => s !== null).map((s) => `'${s}'`).join(", ");
    const curated = `source = 'curated' AND (${styleList ? `cuisine IN (${styleList})` : "0"}${styles.includes(null) ? " OR cuisine IS NULL" : ""})`;
    where.push(`(use_count > 0 OR (${curated}))`);
    order = "use_count DESC, last_used DESC, name COLLATE NOCASE";
  }
  const rows = named<LibraryRow>(`SELECT * FROM library_foods WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT 500`).all(params);
  return rows.map((r) => toLibraryFood(r, opts.allergies));
}
