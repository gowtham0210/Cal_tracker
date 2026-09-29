// Curated dishes with typical home portions. Nutrition is per serving and uses standard
// estimates; ingredients are approximate per serving and feed the grocery list.

export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
export type Cuisine = "tamil-nadu" | "south-indian" | "north-indian" | "any";
export type Diet = "veg" | "eggetarian" | "non-veg";
export type GroceryCategory = "Vegetables & fruit" | "Grains & millets" | "Dals & legumes" | "Dairy & eggs" | "Meat & fish" | "Nuts & seeds" | "Oils, spices & others";

export interface Ingredient {
  name: string;
  amount: number;
  unit: "g" | "ml" | "pc";
  category: GroceryCategory;
}

export interface CuratedFood {
  name: string;
  meal: Meal;
  serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** The food style it belongs to; null for international dishes. */
  cuisine: Exclude<Cuisine, "any"> | null;
  diet: Diet;
  allergens: string[];
  tags: string[];
  ingredients: Ingredient[];
}

const V = "Vegetables & fruit" as const;
const G = "Grains & millets" as const;
const D = "Dals & legumes" as const;
const E = "Dairy & eggs" as const;
const M = "Meat & fish" as const;
const N = "Nuts & seeds" as const;
const P = "Oils, spices & others" as const;
const i = (name: string, amount: number, unit: Ingredient["unit"], category: GroceryCategory): Ingredient => ({ name, amount, unit, category });

type Row = [name: string, meal: Meal, serving: string, kcal: number, p: number, c: number, f: number, diet: Diet, allergens: string[], tags: string[], ingredients: Ingredient[]];
const make = (cuisine: CuratedFood["cuisine"], rows: Row[]): CuratedFood[] =>
  rows.map(([name, meal, serving, calories, protein, carbs, fat, diet, allergens, tags, ingredients]) => ({ name, meal, serving, calories, protein, carbs, fat, cuisine, diet, allergens, tags, ingredients }));

const TAMIL = make("tamil-nadu", [
  ["2 idli with sambar & tomato chutney", "breakfast", "1 plate (2 idli)", 270, 9, 48, 4, "veg", [], ["light", "steamed"], [i("Idli rice", 60, "g", G), i("Urad dal", 20, "g", D), i("Toor dal", 20, "g", D), i("Mixed vegetables", 60, "g", V), i("Tomato", 40, "g", V), i("Oil", 5, "ml", P)]],
  ["Ven pongal (1 cup) with sambar", "breakfast", "1 cup", 330, 10, 50, 10, "veg", ["dairy"], ["comfort"], [i("Raw rice", 50, "g", G), i("Moong dal", 25, "g", D), i("Toor dal", 15, "g", D), i("Mixed vegetables", 50, "g", V), i("Ghee", 8, "g", E), i("Pepper & cumin", 2, "g", P)]],
  ["2 ragi dosa with peanut chutney", "breakfast", "2 dosa", 290, 9, 40, 10, "veg", ["peanut"], ["millet", "fiber"], [i("Ragi flour", 60, "g", G), i("Peanuts", 20, "g", N), i("Oil", 5, "ml", P)]],
  ["2 adai with avial", "breakfast", "2 adai", 360, 16, 48, 11, "veg", ["dairy"], ["high protein", "lentils"], [i("Raw rice", 40, "g", G), i("Mixed dals", 50, "g", D), i("Mixed vegetables", 100, "g", V), i("Coconut", 20, "g", V), i("Curd", 30, "g", E), i("Oil", 5, "ml", P)]],
  ["Vegetable rava upma (1 cup)", "breakfast", "1 cup", 280, 7, 42, 9, "veg", ["gluten"], ["10 min"], [i("Rava (semolina)", 50, "g", G), i("Mixed vegetables", 60, "g", V), i("Oil", 8, "ml", P)]],
  ["Kambu koozh with small onion", "breakfast", "1 glass", 200, 6, 38, 2, "veg", ["dairy"], ["millet", "cooling"], [i("Kambu (pearl millet)", 45, "g", G), i("Buttermilk", 150, "ml", E), i("Small onion", 20, "g", V)]],
  ["Rice with sambar, beans poriyal & curd", "lunch", "1 plate", 520, 16, 88, 11, "veg", ["dairy"], ["classic meals"], [i("Rice", 90, "g", G), i("Toor dal", 25, "g", D), i("Beans", 80, "g", V), i("Mixed vegetables", 60, "g", V), i("Curd", 100, "g", E), i("Oil", 8, "ml", P)]],
  ["Varagu rice with rasam & keerai kootu", "lunch", "1 plate", 420, 14, 70, 9, "veg", [], ["millet", "light"], [i("Varagu (kodo millet)", 70, "g", G), i("Toor dal", 15, "g", D), i("Moong dal", 20, "g", D), i("Spinach (keerai)", 100, "g", V), i("Tomato", 50, "g", V), i("Oil", 6, "ml", P)]],
  ["Meen kuzhambu with 1 cup rice", "lunch", "1 plate", 480, 28, 55, 15, "non-veg", ["fish"], ["high protein", "fish"], [i("Fish", 120, "g", M), i("Rice", 70, "g", G), i("Tamarind", 10, "g", P), i("Onion & tomato", 80, "g", V), i("Oil", 10, "ml", P)]],
  ["Chicken chettinad with 1 cup rice", "lunch", "1 plate", 560, 34, 55, 22, "non-veg", [], ["high protein"], [i("Chicken", 150, "g", M), i("Rice", 70, "g", G), i("Onion", 60, "g", V), i("Tomato", 50, "g", V), i("Chettinad spices", 5, "g", P), i("Oil", 12, "ml", P)]],
  ["Curd rice (1 cup)", "lunch", "1 cup", 280, 8, 45, 7, "veg", ["dairy"], ["cooling", "comfort"], [i("Rice", 60, "g", G), i("Curd", 150, "g", E), i("Cucumber", 30, "g", V)]],
  ["2 wheat dosa with tomato chutney", "dinner", "2 dosa", 260, 8, 42, 7, "veg", ["gluten"], ["light"], [i("Wheat flour", 60, "g", G), i("Tomato", 60, "g", V), i("Oil", 6, "ml", P)]],
  ["Egg curry with 2 idiyappam", "dinner", "1 plate", 380, 16, 52, 12, "eggetarian", ["egg"], ["high protein"], [i("Eggs", 2, "pc", E), i("Rice flour", 60, "g", G), i("Onion", 50, "g", V), i("Tomato", 50, "g", V), i("Oil", 8, "ml", P)]],
  ["Kuthiraivali pongal with sambar", "dinner", "1 cup", 310, 10, 48, 8, "veg", ["dairy"], ["millet"], [i("Kuthiraivali (barnyard millet)", 50, "g", G), i("Moong dal", 25, "g", D), i("Toor dal", 15, "g", D), i("Mixed vegetables", 50, "g", V), i("Ghee", 6, "g", E)]],
  ["Paruppu kootu with 2 chapati", "dinner", "1 plate", 400, 17, 60, 10, "veg", ["gluten"], ["vegetarian", "fiber"], [i("Wheat flour", 60, "g", G), i("Moong dal", 40, "g", D), i("Mixed vegetables", 100, "g", V), i("Oil", 6, "ml", P)]],
  ["Idiyappam with vegetable kurma", "dinner", "1 plate", 360, 8, 58, 10, "veg", [], ["light"], [i("Rice flour", 70, "g", G), i("Mixed vegetables", 100, "g", V), i("Coconut", 20, "g", V), i("Oil", 6, "ml", P)]],
  ["Chicken pepper fry with 2 chapati", "dinner", "1 plate", 520, 38, 42, 20, "non-veg", ["gluten"], ["high protein"], [i("Chicken", 150, "g", M), i("Wheat flour", 60, "g", G), i("Onion", 50, "g", V), i("Pepper", 3, "g", P), i("Oil", 10, "ml", P)]],
  ["Channa sundal (1 cup)", "snack", "1 cup", 210, 11, 30, 5, "veg", [], ["high protein", "evening"], [i("Chickpeas (dry)", 60, "g", D), i("Coconut", 10, "g", V), i("Oil", 3, "ml", P)]],
  ["Neer mor (spiced buttermilk)", "snack", "1 glass", 60, 3, 5, 3, "veg", ["dairy"], ["cooling", "light"], [i("Curd", 100, "g", E), i("Curry leaves & ginger", 5, "g", P)]],
  ["Roasted peanuts (small handful)", "snack", "30 g", 170, 7, 5, 14, "veg", ["peanut"], ["on the go"], [i("Peanuts", 30, "g", N)]],
  ["Guava with a pinch of chilli salt", "snack", "1 medium", 70, 3, 14, 1, "veg", [], ["fruit", "fiber"], [i("Guava", 1, "pc", V)]],
]);

const SOUTH = make("south-indian", [
  ["2 idli + sambar", "breakfast", "1 plate (2 idli)", 250, 10, 44, 3, "veg", [], ["light", "vegetarian"], [i("Idli rice", 60, "g", G), i("Urad dal", 20, "g", D), i("Toor dal", 20, "g", D), i("Mixed vegetables", 50, "g", V)]],
  ["Pesarattu with ginger chutney", "breakfast", "2 pesarattu", 280, 14, 38, 7, "veg", [], ["high protein"], [i("Green moong", 70, "g", D), i("Ginger", 5, "g", V), i("Oil", 6, "ml", P)]],
  ["Bisi bele bath (1 cup)", "lunch", "1 cup", 380, 11, 60, 10, "veg", ["dairy"], ["comfort"], [i("Rice", 50, "g", G), i("Toor dal", 30, "g", D), i("Mixed vegetables", 80, "g", V), i("Ghee", 6, "g", E)]],
  ["Chicken curry with 1 cup rice", "dinner", "1 plate", 585, 32, 57, 24, "non-veg", [], ["comfort"], [i("Chicken", 130, "g", M), i("Rice", 70, "g", G), i("Onion & tomato", 100, "g", V), i("Oil", 12, "ml", P)]],
  ["Appam with vegetable stew", "dinner", "2 appam", 340, 7, 56, 9, "veg", [], ["light"], [i("Raw rice", 60, "g", G), i("Coconut milk", 80, "ml", P), i("Mixed vegetables", 100, "g", V)]],
]);

const NORTH = make("north-indian", [
  ["Poha with peanuts (1 plate)", "breakfast", "1 plate", 300, 6, 50, 9, "veg", ["peanut"], ["10 min"], [i("Poha (flattened rice)", 60, "g", G), i("Peanuts", 15, "g", N), i("Onion", 40, "g", V), i("Oil", 6, "ml", P)]],
  ["Aloo paratha with curd", "breakfast", "1 paratha", 420, 10, 55, 17, "veg", ["gluten", "dairy"], ["comfort"], [i("Wheat flour", 70, "g", G), i("Potato", 80, "g", V), i("Curd", 100, "g", E), i("Ghee", 6, "g", E)]],
  ["Moong dal cheela (2)", "breakfast", "2 cheela", 260, 14, 34, 7, "veg", [], ["high protein"], [i("Moong dal", 70, "g", D), i("Onion & tomato", 50, "g", V), i("Oil", 6, "ml", P)]],
  ["Dal, 2 chapati & salad", "lunch", "1 plate", 480, 20, 70, 11, "veg", ["gluten"], ["vegetarian", "fiber"], [i("Wheat flour", 60, "g", G), i("Toor dal", 40, "g", D), i("Salad vegetables", 100, "g", V), i("Oil", 6, "ml", P)]],
  ["Rajma chawal (1 plate)", "lunch", "1 plate", 480, 17, 80, 9, "veg", [], ["comfort", "fiber"], [i("Rajma (kidney beans)", 50, "g", D), i("Rice", 70, "g", G), i("Onion & tomato", 80, "g", V), i("Oil", 8, "ml", P)]],
  ["Chole with 2 roti", "lunch", "1 plate", 470, 17, 68, 13, "veg", ["gluten"], ["fiber"], [i("Chickpeas (dry)", 50, "g", D), i("Wheat flour", 60, "g", G), i("Onion & tomato", 80, "g", V), i("Oil", 8, "ml", P)]],
  ["Paneer tikka with salad", "dinner", "1 plate", 430, 26, 14, 29, "veg", ["dairy"], ["vegetarian", "low carb"], [i("Paneer", 120, "g", E), i("Capsicum & onion", 100, "g", V), i("Curd", 30, "g", E)]],
  ["Palak paneer with 2 roti", "dinner", "1 plate", 460, 20, 48, 20, "veg", ["dairy", "gluten"], ["iron"], [i("Spinach", 150, "g", V), i("Paneer", 60, "g", E), i("Wheat flour", 60, "g", G), i("Oil", 6, "ml", P)]],
  ["Dal khichdi with curd", "dinner", "1 bowl", 380, 14, 60, 9, "veg", ["dairy"], ["light", "comfort"], [i("Rice", 45, "g", G), i("Moong dal", 35, "g", D), i("Curd", 100, "g", E), i("Ghee", 5, "g", E)]],
  ["Roasted chana (small bowl)", "snack", "40 g", 150, 8, 22, 3, "veg", [], ["high protein", "on the go"], [i("Roasted chana", 40, "g", D)]],
]);

const INTERNATIONAL = make(null, [
  ["Greek yogurt with berries & almonds", "breakfast", "1 bowl", 280, 21, 26, 11, "veg", ["dairy", "tree nut"], ["high protein", "5 min"], [i("Greek yogurt", 170, "g", E), i("Berries", 80, "g", V), i("Almonds", 10, "g", N)]],
  ["Veggie omelette with 1 toast", "breakfast", "1 plate", 330, 20, 18, 19, "eggetarian", ["egg", "gluten"], ["high protein"], [i("Eggs", 2, "pc", E), i("Bread", 1, "pc", G), i("Mixed vegetables", 60, "g", V)]],
  ["Overnight oats with banana", "breakfast", "1 jar", 360, 13, 58, 8, "veg", ["dairy", "gluten"], ["prep ahead"], [i("Oats", 50, "g", G), i("Milk", 150, "ml", E), i("Banana", 1, "pc", V)]],
  ["Grilled chicken salad bowl", "lunch", "1 bowl", 420, 45, 16, 18, "non-veg", [], ["high protein", "low carb"], [i("Chicken breast", 150, "g", M), i("Salad vegetables", 150, "g", V), i("Olive oil", 10, "ml", P)]],
  ["Tuna wrap with greens", "lunch", "1 wrap", 390, 36, 34, 11, "non-veg", ["fish", "gluten"], ["high protein", "10 min"], [i("Tuna", 100, "g", M), i("Tortilla", 1, "pc", G), i("Salad greens", 50, "g", V)]],
  ["Tofu stir-fry with brown rice", "dinner", "1 bowl", 510, 27, 58, 17, "veg", ["soy"], ["vegan"], [i("Tofu", 150, "g", D), i("Brown rice", 70, "g", G), i("Mixed vegetables", 120, "g", V), i("Oil", 8, "ml", P)]],
  ["Salmon, quinoa & roasted veg", "dinner", "1 plate", 560, 40, 38, 24, "non-veg", ["fish"], ["omega-3"], [i("Salmon", 150, "g", M), i("Quinoa", 60, "g", G), i("Mixed vegetables", 150, "g", V)]],
  ["Apple with 1 tbsp peanut butter", "snack", "1 apple", 190, 4, 28, 8, "veg", ["peanut"], ["5 min"], [i("Apple", 1, "pc", V), i("Peanut butter", 16, "g", N)]],
  ["Protein shake + banana", "snack", "1 glass", 235, 26, 31, 2, "veg", ["dairy"], ["post-workout"], [i("Whey protein", 30, "g", P), i("Banana", 1, "pc", V)]],
  ["Hummus with veggie sticks", "snack", "1 bowl", 130, 4, 14, 6, "veg", ["sesame"], ["light"], [i("Hummus", 60, "g", D), i("Carrot & cucumber", 100, "g", V)]],
  ["Handful of almonds", "snack", "25 g", 165, 6, 6, 14, "veg", ["tree nut"], ["on the go"], [i("Almonds", 25, "g", N)]],
  ["Berries & a square of dark chocolate", "snack", "1 bowl", 125, 1, 22, 4, "veg", ["dairy"], ["sweet tooth"], [i("Berries", 100, "g", V), i("Dark chocolate", 10, "g", P)]],
]);

export const CURATED_FOODS: CuratedFood[] = [...TAMIL, ...SOUTH, ...NORTH, ...INTERNATIONAL];

/** Which curated food styles fit a user's cuisine preference. */
export const CUISINE_STYLES: Record<Cuisine, CuratedFood["cuisine"][]> = {
  "tamil-nadu": ["tamil-nadu"],
  "south-indian": ["tamil-nadu", "south-indian"],
  "north-indian": ["north-indian"],
  any: ["tamil-nadu", "south-indian", "north-indian", null],
};
