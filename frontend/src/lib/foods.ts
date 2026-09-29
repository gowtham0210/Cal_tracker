import type { Macros, MealType } from "./types";

export interface FoodItem extends Macros {
  name: string;
  aliases: string[];
  serving: string;
  calories: number;
}

/** A small mock nutrition database used by the "AI" features. Values are per serving. */
export const FOOD_DB: FoodItem[] = [
  { name: "Egg", aliases: ["egg", "eggs", "boiled egg", "fried egg"], serving: "1 large", calories: 72, protein: 6, carbs: 0, fat: 5 },
  {
    name: "Scrambled eggs",
    aliases: ["scrambled egg", "scrambled eggs"],
    serving: "2 eggs",
    calories: 180,
    protein: 12,
    carbs: 2,
    fat: 14,
  },
  { name: "Omelette", aliases: ["omelette", "omelet"], serving: "2 eggs", calories: 210, protein: 14, carbs: 2, fat: 16 },
  {
    name: "Toast",
    aliases: ["toast", "bread", "slice of bread", "slices of toast", "slice", "slices"],
    serving: "1 slice",
    calories: 80,
    protein: 3,
    carbs: 14,
    fat: 1,
  },
  { name: "Oatmeal", aliases: ["oatmeal", "oats", "porridge"], serving: "1 cup cooked", calories: 160, protein: 6, carbs: 27, fat: 3 },
  {
    name: "Greek yogurt",
    aliases: ["greek yogurt", "yogurt", "yoghurt", "curd"],
    serving: "170 g",
    calories: 100,
    protein: 17,
    carbs: 6,
    fat: 0,
  },
  { name: "Banana", aliases: ["banana", "bananas"], serving: "1 medium", calories: 105, protein: 1, carbs: 27, fat: 0 },
  { name: "Apple", aliases: ["apple", "apples"], serving: "1 medium", calories: 95, protein: 0, carbs: 25, fat: 0 },
  { name: "Orange", aliases: ["orange", "oranges"], serving: "1 medium", calories: 62, protein: 1, carbs: 15, fat: 0 },
  { name: "Berries", aliases: ["berries", "blueberries", "strawberries"], serving: "1 cup", calories: 70, protein: 1, carbs: 17, fat: 0 },
  { name: "Coffee with milk", aliases: ["coffee", "latte", "cappuccino"], serving: "1 cup", calories: 90, protein: 5, carbs: 8, fat: 4 },
  { name: "Tea with milk", aliases: ["tea", "chai"], serving: "1 cup", calories: 60, protein: 2, carbs: 8, fat: 2 },
  { name: "Orange juice", aliases: ["juice", "orange juice"], serving: "1 glass", calories: 110, protein: 2, carbs: 26, fat: 0 },
  { name: "Milk", aliases: ["milk", "glass of milk"], serving: "1 cup", calories: 120, protein: 8, carbs: 12, fat: 5 },
  { name: "Protein shake", aliases: ["protein shake", "whey", "shake"], serving: "1 scoop", calories: 130, protein: 25, carbs: 4, fat: 2 },
  {
    name: "Grilled chicken breast",
    aliases: ["chicken breast", "grilled chicken", "chicken"],
    serving: "150 g",
    calories: 250,
    protein: 46,
    carbs: 0,
    fat: 5,
  },
  {
    name: "Chicken curry",
    aliases: ["chicken curry", "butter chicken"],
    serving: "1 bowl",
    calories: 380,
    protein: 28,
    carbs: 12,
    fat: 24,
  },
  { name: "Salmon", aliases: ["salmon", "fish"], serving: "150 g", calories: 310, protein: 34, carbs: 0, fat: 18 },
  { name: "Tuna", aliases: ["tuna"], serving: "1 can", calories: 150, protein: 33, carbs: 0, fat: 1 },
  { name: "Paneer", aliases: ["paneer", "cottage cheese"], serving: "100 g", calories: 265, protein: 18, carbs: 4, fat: 20 },
  { name: "Tofu", aliases: ["tofu"], serving: "150 g", calories: 180, protein: 20, carbs: 4, fat: 10 },
  {
    name: "White rice",
    aliases: ["rice", "white rice", "steamed rice"],
    serving: "1 cup cooked",
    calories: 205,
    protein: 4,
    carbs: 45,
    fat: 0,
  },
  { name: "Brown rice", aliases: ["brown rice"], serving: "1 cup cooked", calories: 215, protein: 5, carbs: 45, fat: 2 },
  {
    name: "Chapati",
    aliases: ["chapati", "roti", "chapatis", "rotis", "phulka"],
    serving: "1 piece",
    calories: 120,
    protein: 3,
    carbs: 18,
    fat: 4,
  },
  { name: "Dal", aliases: ["dal", "daal", "lentils", "lentil soup"], serving: "1 bowl", calories: 180, protein: 12, carbs: 28, fat: 3 },
  { name: "Dosa", aliases: ["dosa", "dosas"], serving: "1 plain", calories: 170, protein: 4, carbs: 28, fat: 5 },
  { name: "Idli", aliases: ["idli", "idlis", "idly"], serving: "1 piece", calories: 58, protein: 2, carbs: 12, fat: 0 },
  { name: "Sambar", aliases: ["sambar"], serving: "1 bowl", calories: 130, protein: 6, carbs: 20, fat: 3 },
  { name: "Pasta", aliases: ["pasta", "spaghetti", "penne"], serving: "1 cup cooked", calories: 220, protein: 8, carbs: 43, fat: 1 },
  {
    name: "Pizza slice",
    aliases: ["pizza", "slice of pizza", "pizza slice", "pizza slices"],
    serving: "1 slice",
    calories: 285,
    protein: 12,
    carbs: 36,
    fat: 10,
  },
  { name: "Burger", aliases: ["burger", "cheeseburger", "hamburger"], serving: "1 burger", calories: 540, protein: 28, carbs: 40, fat: 29 },
  { name: "French fries", aliases: ["fries", "french fries", "chips"], serving: "medium", calories: 365, protein: 4, carbs: 48, fat: 17 },
  { name: "Sandwich", aliases: ["sandwich", "sub", "wrap"], serving: "1 sandwich", calories: 350, protein: 18, carbs: 38, fat: 13 },
  { name: "Caesar salad", aliases: ["caesar salad", "salad"], serving: "1 bowl", calories: 220, protein: 8, carbs: 10, fat: 17 },
  {
    name: "Green salad",
    aliases: ["green salad", "side salad", "veggies", "vegetables"],
    serving: "1 bowl",
    calories: 60,
    protein: 2,
    carbs: 10,
    fat: 1,
  },
  { name: "Avocado", aliases: ["avocado", "avocados"], serving: "1/2 fruit", calories: 120, protein: 1, carbs: 6, fat: 11 },
  {
    name: "Almonds",
    aliases: ["almonds", "nuts", "handful of almonds", "handful of nuts"],
    serving: "28 g",
    calories: 165,
    protein: 6,
    carbs: 6,
    fat: 14,
  },
  { name: "Peanut butter", aliases: ["peanut butter", "pb"], serving: "1 tbsp", calories: 95, protein: 4, carbs: 3, fat: 8 },
  { name: "Dark chocolate", aliases: ["chocolate", "dark chocolate"], serving: "20 g", calories: 110, protein: 1, carbs: 9, fat: 8 },
  {
    name: "Cookie",
    aliases: ["cookie", "cookies", "biscuit", "biscuits"],
    serving: "1 cookie",
    calories: 80,
    protein: 1,
    carbs: 11,
    fat: 4,
  },
  { name: "Ice cream", aliases: ["ice cream", "icecream"], serving: "1/2 cup", calories: 140, protein: 2, carbs: 16, fat: 7 },
  { name: "Soda", aliases: ["soda", "coke", "cola", "soft drink"], serving: "330 ml can", calories: 140, protein: 0, carbs: 39, fat: 0 },
  { name: "Beer", aliases: ["beer", "beers"], serving: "330 ml", calories: 150, protein: 1, carbs: 13, fat: 0 },
  { name: "Wine", aliases: ["wine", "glass of wine"], serving: "150 ml", calories: 125, protein: 0, carbs: 4, fat: 0 },
  { name: "Biryani", aliases: ["biryani"], serving: "1 plate", calories: 490, protein: 22, carbs: 60, fat: 18 },
  { name: "Noodles", aliases: ["noodles", "ramen", "fried noodles"], serving: "1 bowl", calories: 380, protein: 10, carbs: 55, fat: 13 },
  { name: "Burrito bowl", aliases: ["burrito", "burrito bowl"], serving: "1 bowl", calories: 620, protein: 35, carbs: 70, fat: 20 },
  { name: "Sushi roll", aliases: ["sushi", "sushi roll"], serving: "6 pieces", calories: 255, protein: 9, carbs: 38, fat: 7 },
  { name: "Steak", aliases: ["steak", "beef"], serving: "170 g", calories: 420, protein: 46, carbs: 0, fat: 25 },
  { name: "Hummus", aliases: ["hummus"], serving: "2 tbsp", calories: 70, protein: 2, carbs: 4, fat: 5 },
  { name: "Granola bar", aliases: ["granola bar", "protein bar", "bar"], serving: "1 bar", calories: 190, protein: 8, carbs: 25, fat: 7 },
];

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  half: 0.5,
  couple: 2,
  few: 3,
};

export interface ParsedFood extends Macros {
  name: string;
  quantity: number;
  serving: string;
  calories: number;
  confidence: "high" | "medium" | "low";
}

/** Mock "natural language" parser: splits on separators and matches phrases against the food DB. */
export function parseFoodText(text: string): ParsedFood[] {
  const parts = text
    .toLowerCase()
    .replace(/[.!?]/g, " ")
    .split(/,|\band\b|\bwith\b|\bplus\b|\+|&|\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const aliasList = FOOD_DB.flatMap((f) => f.aliases.map((a) => ({ alias: a, food: f }))).sort((a, b) => b.alias.length - a.alias.length);

  const results: ParsedFood[] = [];
  for (const part of parts) {
    const hit = aliasList.find(({ alias }) => new RegExp(`\\b${alias}\\b`).test(part));
    if (!hit) continue;
    let qty = 1;
    const num = part.match(/(\d+(?:\.\d+)?)/);
    if (num) qty = parseFloat(num[1]);
    else {
      const word = part.split(/\s+/).find((w) => w in NUMBER_WORDS);
      if (word) qty = NUMBER_WORDS[word];
    }
    // Treat gram quantities as multiples of the default serving when the serving is in grams
    const grams = part.match(/(\d+)\s*g\b/);
    const servingGrams = hit.food.serving.match(/(\d+)\s*g/);
    if (grams && servingGrams) qty = parseInt(grams[1]) / parseInt(servingGrams[1]);
    if (/\blarge\b|\bbig\b/.test(part)) qty *= 1.4;
    if (/\bsmall\b|\blittle\b/.test(part)) qty *= 0.7;
    qty = Math.max(0.25, Math.min(qty, 10));

    const f = hit.food;
    results.push({
      name: f.name,
      quantity: Math.round(qty * 100) / 100,
      serving: f.serving,
      calories: Math.round(f.calories * qty),
      protein: Math.round(f.protein * qty),
      carbs: Math.round(f.carbs * qty),
      fat: Math.round(f.fat * qty),
      confidence: num || /\b(a|an|one)\b/.test(part) ? "high" : "medium",
    });
  }
  return results;
}

export interface MealIdea extends Macros {
  name: string;
  calories: number;
  meal: MealType;
  tags: string[];
}

export const MEAL_IDEAS: MealIdea[] = [
  {
    name: "Greek yogurt with berries & almonds",
    calories: 280,
    protein: 21,
    carbs: 26,
    fat: 11,
    meal: "breakfast",
    tags: ["high protein", "5 min"],
  },
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

export const EXERCISE_PRESETS: { name: string; calPerMin: number; emoji: string }[] = [
  { name: "Walking", calPerMin: 4.5, emoji: "🚶" },
  { name: "Running", calPerMin: 11, emoji: "🏃" },
  { name: "Cycling", calPerMin: 8, emoji: "🚴" },
  { name: "Strength training", calPerMin: 6, emoji: "🏋️" },
  { name: "Yoga", calPerMin: 3.5, emoji: "🧘" },
  { name: "Swimming", calPerMin: 9, emoji: "🏊" },
  { name: "HIIT", calPerMin: 12, emoji: "⚡" },
  { name: "Dancing", calPerMin: 6.5, emoji: "💃" },
];
