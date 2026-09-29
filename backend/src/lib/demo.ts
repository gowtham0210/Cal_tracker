import { randomUUID } from "node:crypto";
import { addDays } from "./dates.js";

// Deterministic sample journey, ported from frontend/src/lib/mock.ts so every reset looks the same.

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Meal = "breakfast" | "lunch" | "dinner" | "snack";
type Item = { name: string; calories: number; protein: number; carbs: number; fat: number };

const MEALS: Record<Meal, Item[]> = {
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
  null,
  null,
];

export function generateDemoData(today: string, now = Date.now()) {
  const rand = mulberry32(42);
  const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const DAYS = 120;
  const start = addDays(today, -DAYS);
  const startWeight = 92.4;

  const profile = {
    heightCm: 175,
    startWeight,
    goalWeight: 78,
    startDate: start,
    calorieGoal: 1900,
    macroGoals: { protein: 130, carbs: 190, fat: 65 },
    trackMacros: true,
    waterGoal: 8,
    glassMl: 250,
    units: "metric" as const,
    theme: "system" as const,
  };

  // ~0.068 kg/day loss with noise and a plateau around day 60–75.
  const weights: { id: string; date: string; weight: number }[] = [];
  let w = startWeight;
  for (let i = 0; i <= DAYS; i++) {
    const date = addDays(start, i);
    const plateau = i > 60 && i < 75;
    w -= plateau ? 0.005 : 0.068;
    const noise = (rand() - 0.5) * 0.7;
    if (i === 0 || i === DAYS || rand() < 0.62) {
      weights.push({ id: randomUUID(), date, weight: Math.round((i === 0 ? startWeight : w + noise) * 10) / 10 });
    }
  }

  const measurements: { id: string; date: string; waist: number; hips: number; chest: number }[] = [];
  for (let i = 0; i <= DAYS; i += 14) {
    const p = i / DAYS;
    measurements.push({
      id: randomUUID(),
      date: addDays(start, i),
      waist: Math.round((101 - 8.5 * p + (rand() - 0.5)) * 10) / 10,
      hips: Math.round((108 - 5 * p + (rand() - 0.5)) * 10) / 10,
      chest: Math.round((106 - 4 * p + (rand() - 0.5)) * 10) / 10,
    });
  }

  const foods: ({ id: string; date: string; meal: Meal; createdAt: number } & Item)[] = [];
  const exercises: { id: string; date: string; name: string; minutes: number; calories: number }[] = [];
  const water: { date: string; glasses: number }[] = [];
  const journal: { date: string; mood: number; energy: number; sleepHours: number; cravings: number; note: string | null }[] = [];

  for (let i = 60; i >= 0; i--) {
    const date = addDays(today, -i);
    // Gaps so the streak is a meaningful, finite number.
    if (i === 16 || i === 38) continue;
    const isToday = i === 0;
    const meals: Meal[] = isToday ? ["breakfast", "lunch", "snack"] : ["breakfast", "lunch", "dinner", "snack"];
    let order = 0;
    for (const meal of meals) {
      const count = meal === "snack" ? (rand() < 0.5 ? 1 : 2) : rand() < 0.3 ? 2 : 1;
      const used = new Set<string>();
      for (let c = 0; c < count; c++) {
        const item = pick(MEALS[meal]);
        if (used.has(item.name)) continue;
        used.add(item.name);
        foods.push({ id: randomUUID(), date, meal, ...item, createdAt: now - i * 86_400_000 + order++ });
      }
    }
    water.push({ date, glasses: isToday ? 5 : Math.max(3, Math.min(10, Math.round(6 + (rand() - 0.35) * 5))) });
    if (rand() < 0.6 || isToday) {
      const wk = pick(WORKOUTS);
      const minutes = pick(wk.mins);
      exercises.push({ id: randomUUID(), date, name: wk.name, minutes, calories: Math.round(minutes * wk.perMin) });
    }
    if (rand() < 0.75) {
      const sleep = Math.round((6 + rand() * 2.5) * 2) / 2;
      journal.push({
        date,
        mood: Math.min(5, Math.max(1, Math.round(3 + (rand() - 0.3) * 3))),
        energy: sleep >= 7 ? (rand() < 0.7 ? 3 : 2) : rand() < 0.6 ? 1 : 2,
        sleepHours: sleep,
        cravings: Math.floor(rand() * 4),
        note: pick(NOTES),
      });
    }
  }

  const favorites = [
    { id: randomUUID(), name: "Oatmeal with banana", calories: 265, protein: 7, carbs: 54, fat: 3, meal: "breakfast" },
    { id: randomUUID(), name: "Grilled chicken salad", calories: 420, protein: 45, carbs: 16, fat: 18, meal: "lunch" },
    { id: randomUUID(), name: "Protein shake", calories: 130, protein: 25, carbs: 4, fat: 2, meal: "snack" },
    { id: randomUUID(), name: "Coffee with milk", calories: 90, protein: 5, carbs: 8, fat: 4, meal: "breakfast" },
    { id: randomUUID(), name: "Dal, rice & salad", calories: 520, protein: 18, carbs: 85, fat: 9, meal: "lunch" },
  ];

  return { profile, weights, measurements, foods, exercises, water, journal, favorites };
}
