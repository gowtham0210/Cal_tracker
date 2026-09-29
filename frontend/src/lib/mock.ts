import { addDays, todayKey } from "./date";
import type { ExerciseEntry, FavoriteFood, FoodEntry, JournalEntry, MealType, MeasurementEntry, Profile, WeightEntry } from "./types";

/** Deterministic PRNG so mock data looks the same on every reset. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const MEALS: Record<MealType, { name: string; calories: number; protein: number; carbs: number; fat: number }[]> = {
  breakfast: [
    { name: "Oatmeal with banana", calories: 265, protein: 7, carbs: 54, fat: 3 },
    { name: "Scrambled eggs & toast", calories: 340, protein: 18, carbs: 30, fat: 16 },
    { name: "Greek yogurt & berries", calories: 190, protein: 18, carbs: 24, fat: 1 },
    { name: "2 dosa with chutney", calories: 380, protein: 8, carbs: 58, fat: 12 },
    { name: "Coffee with milk", calories: 90, protein: 5, carbs: 8, fat: 4 },
  ],
  lunch: [
    { name: "Grilled chicken salad", calories: 420, protein: 45, carbs: 16, fat: 18 },
    { name: "Dal, rice & salad", calories: 520, protein: 18, carbs: 85, fat: 9 },
    { name: "Turkey sandwich", calories: 410, protein: 28, carbs: 42, fat: 13 },
    { name: "Burrito bowl", calories: 620, protein: 35, carbs: 70, fat: 20 },
    { name: "Chicken biryani", calories: 560, protein: 26, carbs: 66, fat: 20 },
  ],
  dinner: [
    { name: "Salmon with veggies", calories: 480, protein: 38, carbs: 18, fat: 26 },
    { name: "2 chapati & paneer curry", calories: 590, protein: 26, carbs: 46, fat: 32 },
    { name: "Pasta primavera", calories: 520, protein: 17, carbs: 78, fat: 14 },
    { name: "Tofu stir-fry & rice", calories: 510, protein: 27, carbs: 58, fat: 17 },
    { name: "Homemade pizza (2 slices)", calories: 570, protein: 24, carbs: 72, fat: 20 },
  ],
  snack: [
    { name: "Apple", calories: 95, protein: 0, carbs: 25, fat: 0 },
    { name: "Handful of almonds", calories: 165, protein: 6, carbs: 6, fat: 14 },
    { name: "Protein shake", calories: 130, protein: 25, carbs: 4, fat: 2 },
    { name: "Dark chocolate", calories: 110, protein: 1, carbs: 9, fat: 8 },
    { name: "Masala chai", calories: 60, protein: 2, carbs: 8, fat: 2 },
  ],
};

const WORKOUTS = [
  { name: "Walking", perMin: 4.5, mins: [30, 45, 60] },
  { name: "Running", perMin: 11, mins: [20, 30] },
  { name: "Strength training", perMin: 6, mins: [40, 50] },
  { name: "Cycling", perMin: 8, mins: [30, 45] },
  { name: "Yoga", perMin: 3.5, mins: [30, 45] },
];

const NOTES = [
  "Felt great today, stuck to the plan.",
  "Craved sweets after lunch — had fruit instead.",
  "Slept badly, low energy all day.",
  "Busy day at work, skipped the snack.",
  "Weekend dinner out, went a bit over.",
  "Energy was high after the morning walk.",
  "",
  "",
];

export interface SeedData {
  profile: Profile;
  foods: FoodEntry[];
  favorites: FavoriteFood[];
  weights: WeightEntry[];
  measurements: MeasurementEntry[];
  exercises: ExerciseEntry[];
  water: Record<string, number>;
  journal: Record<string, JournalEntry>;
}

export function generateMockData(): SeedData {
  const rand = mulberry32(42);
  const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const today = todayKey();
  const DAYS = 120;
  const start = addDays(today, -DAYS);

  const profile: Profile = {
    name: "Gowtham",
    heightCm: 175,
    startWeight: 92.4,
    goalWeight: 78,
    startDate: start,
    calorieGoal: 1900,
    macroGoals: { protein: 130, carbs: 190, fat: 65 },
    trackMacros: true,
    waterGoal: 8,
    glassMl: 250,
    units: "metric",
    theme: "system",
  };

  // Weight: ~0.065 kg/day loss with noise and a small plateau around day 60-75
  const weights: WeightEntry[] = [];
  let w = profile.startWeight;
  for (let i = 0; i <= DAYS; i++) {
    const date = addDays(start, i);
    const plateau = i > 60 && i < 75;
    w -= plateau ? 0.005 : 0.068;
    const noise = (rand() - 0.5) * 0.7;
    if (i === 0 || i === DAYS || rand() < 0.62) {
      weights.push({ id: uid(), date, weight: Math.round((i === 0 ? profile.startWeight : w + noise) * 10) / 10 });
    }
  }

  const measurements: MeasurementEntry[] = [];
  for (let i = 0; i <= DAYS; i += 14) {
    const p = i / DAYS;
    measurements.push({
      id: uid(),
      date: addDays(start, i),
      waist: Math.round((101 - 8.5 * p + (rand() - 0.5)) * 10) / 10,
      hips: Math.round((108 - 5 * p + (rand() - 0.5)) * 10) / 10,
      chest: Math.round((106 - 4 * p + (rand() - 0.5)) * 10) / 10,
    });
  }

  const foods: FoodEntry[] = [];
  const exercises: ExerciseEntry[] = [];
  const water: Record<string, number> = {};
  const journal: Record<string, JournalEntry> = {};

  for (let i = 60; i >= 0; i--) {
    const date = addDays(today, -i);
    // A gap 16 days ago so the streak is a meaningful, finite number
    if (i === 16 || i === 38) continue;
    const isToday = i === 0;
    const meals: MealType[] = isToday ? ["breakfast", "lunch", "snack"] : ["breakfast", "lunch", "dinner", "snack"];
    for (const meal of meals) {
      const count = meal === "snack" ? (rand() < 0.5 ? 1 : 2) : rand() < 0.3 ? 2 : 1;
      const used = new Set<string>();
      for (let c = 0; c < count; c++) {
        const item = pick(MEALS[meal]);
        if (used.has(item.name)) continue;
        used.add(item.name);
        foods.push({ id: uid(), date, meal, ...item, source: "manual", createdAt: Date.now() - i * 86_400_000 });
      }
    }
    water[date] = isToday ? 5 : Math.max(3, Math.min(10, Math.round(6 + (rand() - 0.35) * 5)));
    if (rand() < 0.6 || isToday) {
      const wk = pick(WORKOUTS);
      const minutes = pick(wk.mins);
      exercises.push({ id: uid(), date, name: wk.name, minutes, calories: Math.round(minutes * wk.perMin) });
    }
    if (rand() < 0.75) {
      const sleep = Math.round((6 + rand() * 2.5) * 2) / 2;
      journal[date] = {
        date,
        mood: Math.min(5, Math.max(1, Math.round(3 + (rand() - 0.3) * 3))) as JournalEntry["mood"],
        energy: (sleep >= 7 ? (rand() < 0.7 ? 3 : 2) : rand() < 0.6 ? 1 : 2) as JournalEntry["energy"],
        sleepHours: sleep,
        cravings: Math.floor(rand() * 4) as JournalEntry["cravings"],
        note: pick(NOTES),
      };
    }
  }

  const favorites: FavoriteFood[] = [
    { id: uid(), name: "Oatmeal with banana", calories: 265, protein: 7, carbs: 54, fat: 3, meal: "breakfast" },
    { id: uid(), name: "Grilled chicken salad", calories: 420, protein: 45, carbs: 16, fat: 18, meal: "lunch" },
    { id: uid(), name: "Protein shake", calories: 130, protein: 25, carbs: 4, fat: 2, meal: "snack" },
    { id: uid(), name: "Coffee with milk", calories: 90, protein: 5, carbs: 8, fat: 4, meal: "breakfast" },
    { id: uid(), name: "Dal, rice & salad", calories: 520, protein: 18, carbs: 85, fat: 9, meal: "lunch" },
  ];

  return { profile, foods, favorites, weights, measurements, exercises, water, journal };
}
