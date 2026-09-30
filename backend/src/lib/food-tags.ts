import type { Diet } from "./curated-foods.js";

// Diet type and allergens for foods that only have a name (logged foods and favorites), and the
// user's allergies matched against foods. Curated and AI foods come with their own tags.
// Detection is a best guess from common English, Hindi and Tamil food words.

export const ALLERGENS = ["peanut", "tree nut", "dairy", "egg", "gluten", "soy", "fish", "shellfish", "sesame"] as const;
export type Allergen = (typeof ALLERGENS)[number];

/** Whole words (plurals included), case-insensitive. */
const words = (...w: string[]) => new RegExp(`\\b(?:${w.join("|")})(?:e?s)?\\b`, "i");

const FISH = words("fish", "(?:kari)?meen", "machli", "machhi", "macchi", "tuna", "salmon", "sardine", "mackerel", "anchov(?:y|ie)", "nethili", "vanjaram", "pomfret", "seer", "tilapia", "rohu", "katla", "cod", "karuvadu", "bangda", "bombay duck");
const SHELLFISH = words("prawn", "shrimp", "jhinga", "crab", "lobster", "squid", "calamari", "oyster", "mussel", "clam", "scallop", "eral", "nandu");
const MEAT = words(
  "chicken", "murgh", "kozhi", "kori", "mutton", "gosht", "lamb", "goat", "beef", "pork", "ham", "bacon", "sausage", "salami", "pepperoni",
  "meat", "keema", "kheema", "turkey", "duck", "liver",
);
// Meat words that don't mean meat here: "soya keema", "veg sausage", "goat cheese".
const LOOKALIKES = /\b(?:(?:veg|veggie|soya|soy|mock|vegan|plant[- ]based|jackfruit)\s+(?:keema|kheema|sausages?|nuggets?|chicken|meat|mince|burgers?)|goat(?:'s)?\s+(?:cheese|milk))\b/gi;

/** What each allergen looks like in a food name, and phrases that rule it out. */
const RULES: Record<Allergen, { match: RegExp; unless?: RegExp }> = {
  peanut: { match: words("peanut", "groundnut", "ground nut", "verkadalai", "kadalai mittai", "chikki", "satay") },
  "tree nut": {
    match: /\b(?:(?<!ground\s?)nuts?|almonds?|badam|cashews?|kaju|walnuts?|pistachios?|pista|hazelnuts?|pecans?|macadamias?)\b/i,
  },
  dairy: {
    // Plant "milks", coconut cream and nut butters aren't dairy.
    match: /\b(?:(?<!(?:coconut|almond|cashew|soy|soya|oat|rice) )milk|milkshakes?|curd|dahi|thayir|yog(?:h)?urt|paneer|cheese|(?<!(?:peanut|almond|cashew|nut) )butter|buttermilk|ghee|(?<!coconut )cream|lassi|mor|raita|kheer|payasam|rabri|kulfi|khoa|khova|malai|rasmalai|rasgullas?|makhan|makhani|chai|filter coffee|gulab jamuns?|kalakand|shrikhand|basundi|whey|lattes?|cappuccinos?|mozzarella)\b/i,
    unless: /\b(?:dairy|lactose)[- ]?free\b|\bvegan\b/i,
  },
  egg: { match: words("egg", "omelet(?:te)?", "anda", "muttai", "mayo", "mayonnaise", "french toast"), unless: /\beggless\b|\begg[- ]?free\b|\bvegan\b/i },
  gluten: {
    match: words(
      "wheat", "atta", "maida", "rava", "sooji", "semolina", "roti", "chapath?i", "chappathi", "phulka", "paratha", "parotta", "porotta",
      "naan", "kulcha", "bhatura", "bhature", "poori", "puri", "bread", "toast", "sandwich", "burger", "pizza", "pasta", "spaghetti", "macaroni",
      "noodle", "vermicelli", "semiya", "seviyan", "samosa", "kachori", "jalebi", "biscuit", "cookie", "cake", "pancake", "cupcake", "cheesecake",
      "muffin", "croissant", "bun", "pav", "rusk", "barley", "dalia", "tortilla", "wrap", "couscous", "bagel",
    ),
    unless: /\bgluten[- ]?free\b/i,
  },
  soy: { match: words("soy", "soya", "tofu", "edamame", "tempeh", "meal maker", "miso") },
  fish: { match: FISH },
  shellfish: { match: SHELLFISH },
  sesame: { match: words("sesame", "til", "ellu", "gingelly", "tahini", "hummus") },
};

/** Allergens a food's name suggests, in a stable order. */
export function detectAllergens(name: string): Allergen[] {
  return ALLERGENS.filter((a) => RULES[a].match.test(name) && !RULES[a].unless?.test(name)).sort();
}

/** Veg, eggetarian or non-veg, from the name. Anything without meat, fish or egg reads as veg. */
export function detectDiet(name: string): Diet {
  const meatless = name.replace(LOOKALIKES, " ");
  if (MEAT.test(meatless) || FISH.test(name) || SHELLFISH.test(name)) return "non-veg";
  return detectAllergens(name).includes("egg") ? "eggetarian" : "veg";
}

const ALIASES: Record<string, Allergen> = {
  peanuts: "peanut", groundnut: "peanut", groundnuts: "peanut",
  nut: "tree nut", nuts: "tree nut", "tree nuts": "tree nut", "tree-nut": "tree nut",
  milk: "dairy", lactose: "dairy",
  eggs: "egg",
  wheat: "gluten",
  soya: "soy", soybean: "soy", soybeans: "soy",
  prawn: "shellfish", prawns: "shellfish", shrimp: "shellfish", crab: "shellfish", lobster: "shellfish",
  til: "sesame", ellu: "sesame", "sesame seeds": "sesame",
};

/** Lower-cases allergies, maps common names onto the standard allergens, and drops repeats. */
export function normalizeAllergies(list: string[]): string[] {
  const out = list.map((a) => a.trim().toLowerCase().replace(/\s+/g, " ")).map((a) => ALIASES[a] ?? a);
  return [...new Set(out)];
}

const isAllergen = (a: string): a is Allergen => (ALLERGENS as readonly string[]).includes(a);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The user's allergies this food conflicts with: a standard allergen it's tagged with, or a
 * custom allergy (like "brinjal") in its name or its ingredients.
 */
export function allergyConflicts(food: { name: string; allergens: string[]; ingredients?: string[] }, allergies: string[]): string[] {
  const text = [food.name, ...(food.ingredients ?? [])].join(" · ");
  // Letters and digits either side end the match, so "k-rice" works and "nut" doesn't match "coconut".
  const has = (a: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(a)}(?:e?s)?(?![\\p{L}\\p{N}])`, "iu").test(text);
  return allergies.filter((a) => (isAllergen(a) ? food.allergens.includes(a) : has(a)));
}
