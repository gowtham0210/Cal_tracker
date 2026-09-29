// Curated fallback ideas, used when the AI service is unavailable.
export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
export type Cuisine = "tamil-nadu" | "south-indian" | "north-indian" | "any";
type Style = "tamil" | "south" | "north" | "other";
export interface MealIdea {
  name: string;
  meal: Meal;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  tags: string[];
}

// Typical home portions; values are standard estimates.
const TAMIL: MealIdea[] = [
  { name: "2 idli with sambar & tomato chutney", calories: 270, protein: 9, carbs: 48, fat: 4, meal: "breakfast", tags: ["light", "steamed"] },
  { name: "Ven pongal (1 cup) with sambar", calories: 330, protein: 10, carbs: 50, fat: 10, meal: "breakfast", tags: ["comfort"] },
  { name: "2 ragi dosa with peanut chutney", calories: 290, protein: 9, carbs: 40, fat: 10, meal: "breakfast", tags: ["millet", "fiber"] },
  { name: "2 adai with avial", calories: 360, protein: 16, carbs: 48, fat: 11, meal: "breakfast", tags: ["high protein", "lentils"] },
  { name: "Vegetable rava upma (1 cup)", calories: 280, protein: 7, carbs: 42, fat: 9, meal: "breakfast", tags: ["10 min"] },
  { name: "Rice with sambar, beans poriyal & curd", calories: 520, protein: 16, carbs: 88, fat: 11, meal: "lunch", tags: ["classic meals"] },
  { name: "Varagu rice with rasam & keerai kootu", calories: 420, protein: 14, carbs: 70, fat: 9, meal: "lunch", tags: ["millet", "light"] },
  { name: "Meen kuzhambu with 1 cup rice", calories: 480, protein: 28, carbs: 55, fat: 15, meal: "lunch", tags: ["high protein", "fish"] },
  { name: "Chicken chettinad with 1 cup rice", calories: 560, protein: 34, carbs: 55, fat: 22, meal: "lunch", tags: ["high protein"] },
  { name: "2 wheat dosa with tomato chutney", calories: 260, protein: 8, carbs: 42, fat: 7, meal: "dinner", tags: ["light"] },
  { name: "Egg curry with 2 idiyappam", calories: 380, protein: 16, carbs: 52, fat: 12, meal: "dinner", tags: ["high protein"] },
  { name: "Kuthiraivali pongal with sambar", calories: 310, protein: 10, carbs: 48, fat: 8, meal: "dinner", tags: ["millet"] },
  { name: "Paruppu kootu with 2 chapati", calories: 400, protein: 17, carbs: 60, fat: 10, meal: "dinner", tags: ["vegetarian", "fiber"] },
  { name: "Channa sundal (1 cup)", calories: 210, protein: 11, carbs: 30, fat: 5, meal: "snack", tags: ["high protein", "evening"] },
  { name: "Neer mor (spiced buttermilk)", calories: 60, protein: 3, carbs: 5, fat: 3, meal: "snack", tags: ["cooling", "light"] },
  { name: "Roasted peanuts (small handful)", calories: 170, protein: 7, carbs: 5, fat: 14, meal: "snack", tags: ["on the go"] },
  { name: "Guava with a pinch of chilli salt", calories: 70, protein: 3, carbs: 14, fat: 1, meal: "snack", tags: ["fruit", "fiber"] },
];

const STYLE_OF: Record<string, Style> = {
  "2 idli + sambar": "south",
  "Dal, 2 chapati & salad": "north",
  "Paneer tikka with salad": "north",
  "Chicken curry with 1 cup rice": "south",
};

const OTHER: MealIdea[] = [
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

export const MEAL_IDEAS: (MealIdea & { style: Style })[] = [
  ...TAMIL.map((m) => ({ ...m, style: "tamil" as const })),
  ...OTHER.map((m) => ({ ...m, style: STYLE_OF[m.name] ?? ("other" as const) })),
];

const STYLES: Record<Cuisine, Style[]> = {
  "tamil-nadu": ["tamil"],
  "south-indian": ["tamil", "south"],
  "north-indian": ["north"],
  any: ["tamil", "south", "north", "other"],
};

/**
 * Ranks the curated ideas for a calorie budget in the user's food style, preferring protein when
 * it is lagging. Falls back to any style only if the chosen one has nothing that fits.
 */
export function rankIdeas(budget: number, proteinLeft: number, meal: Meal | undefined, count: number, cuisine: Cuisine = "any"): MealIdea[] {
  const styles = STYLES[cuisine];
  const forMeal = (m: MealIdea) => !meal || m.meal === meal;
  const inStyle = MEAL_IDEAS.filter((m) => styles.includes(m.style) && forMeal(m));
  const fits = inStyle.filter((m) => m.calories <= budget);
  const pool = fits.length
    ? fits
    : MEAL_IDEAS.filter((m) => forMeal(m) && m.calories <= budget).length
      ? MEAL_IDEAS.filter((m) => forMeal(m) && m.calories <= budget)
      : inStyle.filter((m) => m.meal === (meal ?? "snack"));
  const score = (m: MealIdea) => (proteinLeft > 30 ? (m.protein / m.calories) * 800 : 0) - Math.abs(budget * 0.6 - m.calories) / 50;
  return [...pool]
    .sort((a, b) => score(b) - score(a))
    .slice(0, count)
    .map(({ style: _, ...m }) => m);
}
