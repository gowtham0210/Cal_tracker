// Curated fallback ideas, used when the AI service is unavailable (from frontend/src/lib/foods.ts).
export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
export interface MealIdea {
  name: string;
  meal: Meal;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  tags: string[];
}

export const MEAL_IDEAS: MealIdea[] = [
  { name: "Greek yogurt with berries & almonds", calories: 280, protein: 21, carbs: 26, fat: 11, meal: "breakfast", tags: ["high protein", "5 min"] },
  { name: "Veggie omelette with 1 toast", calories: 330, protein: 20, carbs: 18, fat: 19, meal: "breakfast", tags: ["high protein"] },
  { name: "Overnight oats with banana", calories: 360, protein: 13, carbs: 58, fat: 8, meal: "breakfast", tags: ["prep ahead"] },
  { name: "2 idli + sambar", calories: 250, protein: 10, carbs: 44, fat: 3, meal: "breakfast", tags: ["light", "vegetarian"] },
  { name: "Grilled chicken salad bowl", calories: 420, protein: 45, carbs: 16, fat: 18, meal: "lunch", tags: ["high protein", "low carb"] },
  { name: "Dal, 2 chapati & salad", calories: 480, protein: 20, carbs: 70, fat: 11, meal: "lunch", tags: ["vegetarian", "fiber"] },
  { name: "Tuna wrap with greens", calories: 390, protein: 36, carbs: 34, fat: 11, meal: "lunch", tags: ["high protein", "10 min"] },
  { name: "Tofu stir-fry with brown rice", calories: 510, protein: 27, carbs: 58, fat: 17, meal: "dinner", tags: ["vegan"] },
  { name: "Salmon, quinoa & roasted veg", calories: 560, protein: 40, carbs: 38, fat: 24, meal: "dinner", tags: ["omega-3"] },
  { name: "Paneer tikka with salad", calories: 430, protein: 26, carbs: 14, fat: 29, meal: "dinner", tags: ["vegetarian", "low carb"] },
  { name: "Chicken curry with 1 cup rice", calories: 585, protein: 32, carbs: 57, fat: 24, meal: "dinner", tags: ["comfort"] },
  { name: "Apple with 1 tbsp peanut butter", calories: 190, protein: 4, carbs: 28, fat: 8, meal: "snack", tags: ["5 min"] },
  { name: "Protein shake + banana", calories: 235, protein: 26, carbs: 31, fat: 2, meal: "snack", tags: ["post-workout"] },
  { name: "Hummus with veggie sticks", calories: 130, protein: 4, carbs: 14, fat: 6, meal: "snack", tags: ["light"] },
  { name: "Handful of almonds", calories: 165, protein: 6, carbs: 6, fat: 14, meal: "snack", tags: ["on the go"] },
  { name: "Berries & a square of dark chocolate", calories: 125, protein: 1, carbs: 22, fat: 4, meal: "snack", tags: ["sweet tooth"] },
];

/** Ranks the curated ideas for a calorie budget, preferring protein when it is lagging. */
export function rankIdeas(budget: number, proteinLeft: number, meal: Meal | undefined, count: number) {
  const fits = MEAL_IDEAS.filter((m) => m.calories <= budget && (!meal || m.meal === meal));
  const pool = fits.length ? fits : MEAL_IDEAS.filter((m) => (meal ? m.meal === meal : m.meal === "snack"));
  const score = (m: MealIdea) => (proteinLeft > 30 ? (m.protein / m.calories) * 800 : 0) - Math.abs(budget * 0.6 - m.calories) / 50;
  return [...pool].sort((a, b) => score(b) - score(a)).slice(0, count);
}
