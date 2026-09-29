import { addDays, daysBetween, lastNDays, todayKey } from "./date";
import type { ExerciseEntry, FoodEntry, Macros, Profile, UnitSystem, WeightEntry } from "./types";

/* ---------- Units ---------- */
export const KG_TO_LB = 2.20462;
export const CM_TO_IN = 0.393701;

export function weightOut(kg: number, units: UnitSystem) {
  return units === "imperial" ? kg * KG_TO_LB : kg;
}
export function weightIn(v: number, units: UnitSystem) {
  return units === "imperial" ? v / KG_TO_LB : v;
}
export function lengthOut(cm: number, units: UnitSystem) {
  return units === "imperial" ? cm * CM_TO_IN : cm;
}
export function lengthIn(v: number, units: UnitSystem) {
  return units === "imperial" ? v / CM_TO_IN : v;
}
export const wUnit = (u: UnitSystem) => (u === "imperial" ? "lb" : "kg");
export const lUnit = (u: UnitSystem) => (u === "imperial" ? "in" : "cm");
export const fmt1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);
export const fmtInt = (n: number) => Math.round(n).toLocaleString();

/* ---------- Day totals ---------- */
export interface DayTotals extends Macros {
  calories: number;
  burned: number;
  net: number;
}

export function dayTotals(date: string, foods: FoodEntry[], exercises: ExerciseEntry[]): DayTotals {
  const t = { calories: 0, protein: 0, carbs: 0, fat: 0, burned: 0, net: 0 };
  for (const f of foods) {
    if (f.date !== date) continue;
    t.calories += f.calories;
    t.protein += f.protein;
    t.carbs += f.carbs;
    t.fat += f.fat;
  }
  for (const e of exercises) if (e.date === date) t.burned += e.calories;
  t.net = t.calories - t.burned;
  return t;
}

/* ---------- BMI ---------- */
export function bmi(weightKg: number, heightCm: number) {
  if (!weightKg || !heightCm) return 0;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiCategory(b: number): { label: string; tone: "info" | "good" | "warn" | "bad" } {
  if (b < 18.5) return { label: "Underweight", tone: "info" };
  if (b < 25) return { label: "Healthy", tone: "good" };
  if (b < 30) return { label: "Overweight", tone: "warn" };
  return { label: "Obese", tone: "bad" };
}

/* ---------- Weight ---------- */
export function sortedWeights(weights: WeightEntry[]) {
  return [...weights].sort((a, b) => a.date.localeCompare(b.date));
}

export function latestWeight(weights: WeightEntry[], profile: Profile) {
  const s = sortedWeights(weights);
  return s.length ? s[s.length - 1].weight : profile.startWeight;
}

/** Weight closest to (on or before) a date. */
export function weightOn(weights: WeightEntry[], date: string) {
  const s = sortedWeights(weights).filter((w) => w.date <= date);
  return s.length ? s[s.length - 1].weight : undefined;
}

/** Exponentially-smoothed trend line, which is far less noisy than raw daily weigh-ins. */
export function weightTrend(weights: WeightEntry[]) {
  const s = sortedWeights(weights);
  let trend = s[0]?.weight ?? 0;
  return s.map((w) => {
    trend = trend + 0.2 * (w.weight - trend);
    return { date: w.date, weight: w.weight, trend: Math.round(trend * 100) / 100 };
  });
}

export function goalProgress(current: number, p: Profile) {
  const total = p.startWeight - p.goalWeight;
  if (total === 0) return 100;
  const done = p.startWeight - current;
  return Math.max(0, Math.min(100, (done / total) * 100));
}

/** Average weekly change (kg) over the last `days` days using the trend line. */
export function weeklyRate(weights: WeightEntry[], days = 28) {
  const t = weightTrend(weights);
  if (t.length < 2) return 0;
  const end = t[t.length - 1];
  const startDate = addDays(end.date, -days);
  const startPt = t.find((x) => x.date >= startDate) ?? t[0];
  const span = Math.max(1, daysBetween(startPt.date, end.date));
  return ((end.trend - startPt.trend) / span) * 7;
}

export function projectedGoalDate(weights: WeightEntry[], p: Profile) {
  const rate = weeklyRate(weights);
  const current = latestWeight(weights, p);
  if (rate >= -0.01 || current <= p.goalWeight) return undefined;
  const weeks = (current - p.goalWeight) / -rate;
  return addDays(todayKey(), Math.round(weeks * 7));
}

/* ---------- Streak ---------- */
export function loggedDays(foods: FoodEntry[]) {
  return new Set(foods.map((f) => f.date));
}

export function currentStreak(foods: FoodEntry[]) {
  const days = loggedDays(foods);
  let d = todayKey();
  // If nothing logged yet today, the streak is still alive from yesterday.
  if (!days.has(d)) d = addDays(d, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function longestStreak(foods: FoodEntry[]) {
  const days = [...loggedDays(foods)].sort();
  let best = 0;
  let run = 0;
  let prev: string | undefined;
  for (const d of days) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/* ---------- Aggregates ---------- */
export function averageCalories(foods: FoodEntry[], exercises: ExerciseEntry[], days: string[]) {
  const logged = days.filter((d) => foods.some((f) => f.date === d));
  if (!logged.length) return { intake: 0, net: 0, burned: 0, days: 0 };
  let intake = 0;
  let burned = 0;
  for (const d of logged) {
    const t = dayTotals(d, foods, exercises);
    intake += t.calories;
    burned += t.burned;
  }
  return {
    intake: intake / logged.length,
    burned: burned / logged.length,
    net: (intake - burned) / logged.length,
    days: logged.length,
  };
}

export function weekDays(offsetWeeks = 0) {
  return lastNDays(7, addDays(todayKey(), -7 * offsetWeeks));
}

/* ---------- Milestones ---------- */
export interface Badge {
  id: string;
  title: string;
  description: string;
  emoji: string;
  earned: boolean;
  progress?: number; // 0-1
}

export function computeBadges(args: {
  profile: Profile;
  weights: WeightEntry[];
  foods: FoodEntry[];
  exercises: ExerciseEntry[];
  water: Record<string, number>;
}): Badge[] {
  const { profile, weights, foods, exercises, water } = args;
  const current = latestWeight(weights, profile);
  const lost = profile.startWeight - current;
  const pct = goalProgress(current, profile);
  const longest = longestStreak(foods);
  const waterDays = Object.values(water).filter((g) => g >= profile.waterGoal).length;
  const workouts = exercises.length;
  const u = profile.units;
  const lostLabel = (kg: number) => `${Math.round(weightOut(kg, u))} ${wUnit(u)}`;

  const make = (id: string, title: string, description: string, emoji: string, value: number, target: number): Badge => ({
    id,
    title,
    description,
    emoji,
    earned: value >= target,
    progress: Math.max(0, Math.min(1, value / target)),
  });

  return [
    make("first-log", "First step", "Log your first meal", "🌱", foods.length, 1),
    make("streak-7", "Week warrior", "7-day logging streak", "🔥", longest, 7),
    make("streak-30", "Habit formed", "30-day logging streak", "🏆", longest, 30),
    make("lost-2", `Down ${lostLabel(2)}`, `Lose your first ${lostLabel(2)}`, "📉", lost, 2),
    make("lost-5", `Down ${lostLabel(5)}`, `Lose ${lostLabel(5)} total`, "💪", lost, 5),
    make("lost-10", `Down ${lostLabel(10)}`, `Lose ${lostLabel(10)} total`, "🚀", lost, 10),
    make("halfway", "Halfway there", "Reach 50% of your goal", "⛰️", pct, 50),
    make("goal", "Goal reached", "Hit your goal weight", "🎯", pct, 100),
    make("hydrated", "Hydration hero", "Hit your water goal on 20 days", "💧", waterDays, 20),
    make("active", "On the move", "Log 25 workouts", "👟", workouts, 25),
  ];
}
