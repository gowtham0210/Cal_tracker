import { CURATED_FOODS, CUISINE_STYLES, type Cuisine, type Meal } from "./curated-foods.js";

// Curated fallback ideas for meal suggestions, used when the AI service is unavailable.
export type { Cuisine, Meal };

export interface MealIdea {
  name: string;
  meal: Meal;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  tags: string[];
}

/**
 * Ranks the curated ideas for a calorie budget in the user's food style, preferring protein when
 * it is lagging. Falls back to any style only if the chosen one has nothing that fits.
 */
export function rankIdeas(budget: number, proteinLeft: number, meal: Meal | undefined, count: number, cuisine: Cuisine = "any"): MealIdea[] {
  const styles = CUISINE_STYLES[cuisine];
  const forMeal = (m: { meal: Meal }) => !meal || m.meal === meal;
  const inStyle = CURATED_FOODS.filter((m) => styles.includes(m.cuisine) && forMeal(m));
  const fits = inStyle.filter((m) => m.calories <= budget);
  const anyFits = CURATED_FOODS.filter((m) => forMeal(m) && m.calories <= budget);
  const pool = fits.length ? fits : anyFits.length ? anyFits : inStyle.filter((m) => m.meal === (meal ?? "snack"));
  const score = (m: MealIdea) => (proteinLeft > 30 ? (m.protein / m.calories) * 800 : 0) - Math.abs(budget * 0.6 - m.calories) / 50;
  return [...pool]
    .sort((a, b) => score(b) - score(a))
    .slice(0, count)
    .map(({ name, meal: m, calories, protein, carbs, fat, tags }) => ({ name, meal: m, calories, protein, carbs, fat, tags }));
}
