import { db } from "../db/index.js";
import type { Profile } from "../routes/profile.js";
import { addDays, daysBetween } from "./dates.js";

// Progress maths, ported from frontend/src/lib/calc.ts so both sides agree.

export interface WeightPoint {
  date: string;
  weight: number;
}

export interface DayTotals {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  burned: number;
  net: number;
}

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

const weightsUpTo = db.prepare<[string, string], WeightPoint>("SELECT date, weight FROM weight_entries WHERE user_id = ? AND date <= ? ORDER BY date");
const foodDaysUpTo = db.prepare<[string, string], { date: string }>("SELECT DISTINCT date FROM food_entries WHERE user_id = ? AND date <= ? ORDER BY date");

/** Totals for every day in [from, to]; days with nothing logged are zero. */
export function dayTotals(userId: string, from: string, to: string): DayTotals[] {
  const food = db
    .prepare<[string, string, string], Omit<DayTotals, "burned" | "net">>(
      `SELECT date, SUM(calories) AS calories, SUM(protein) AS protein, SUM(carbs) AS carbs, SUM(fat) AS fat
       FROM food_entries WHERE user_id = ? AND date BETWEEN ? AND ? GROUP BY date`,
    )
    .all(userId, from, to);
  const burned = db
    .prepare<[string, string, string], { date: string; burned: number }>(
      "SELECT date, SUM(calories) AS burned FROM exercise_entries WHERE user_id = ? AND date BETWEEN ? AND ? GROUP BY date",
    )
    .all(userId, from, to);
  const f = new Map(food.map((r) => [r.date, r]));
  const b = new Map(burned.map((r) => [r.date, r.burned]));
  const out: DayTotals[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const x = f.get(d);
    const calories = x?.calories ?? 0;
    const burnedKcal = b.get(d) ?? 0;
    out.push({ date: d, calories, protein: x?.protein ?? 0, carbs: x?.carbs ?? 0, fat: x?.fat ?? 0, burned: burnedKcal, net: calories - burnedKcal });
  }
  return out;
}

/** Exponentially smoothed trend: much less noisy than raw weigh-ins. */
export function weightTrend(weights: WeightPoint[]) {
  let trend = weights[0]?.weight ?? 0;
  return weights.map((w) => {
    trend = trend + 0.2 * (w.weight - trend);
    return { date: w.date, trend };
  });
}

/** Average weekly change in kg over the last `days` days of the trend. Negative means losing. */
export function weeklyRate(weights: WeightPoint[], days = 28) {
  const t = weightTrend(weights);
  if (t.length < 2) return 0;
  const end = t[t.length - 1];
  const startPt = t.find((x) => x.date >= addDays(end.date, -days)) ?? t[0];
  const span = Math.max(1, daysBetween(startPt.date, end.date));
  return ((end.trend - startPt.trend) / span) * 7;
}

export function goalProgress(current: number, p: Pick<Profile, "startWeight" | "goalWeight">) {
  const total = p.startWeight - p.goalWeight;
  if (total === 0) return 100;
  return Math.max(0, Math.min(100, ((p.startWeight - current) / total) * 100));
}

export function bmi(weightKg: number, heightCm: number) {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export const bmiCategory = (b: number) => (b < 18.5 ? "underweight" : b < 25 ? "healthy" : b < 30 ? "overweight" : "obese");

export function currentStreak(days: Set<string>, asOf: string) {
  // If nothing is logged yet on asOf, the streak is still alive from the day before.
  let d = days.has(asOf) ? asOf : addDays(asOf, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function longestStreak(sortedDays: string[]) {
  let best = 0;
  let run = 0;
  let prev: string | undefined;
  for (const d of sortedDays) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Everything on the Overview schema, as of a day. */
export function overview(userId: string, p: Profile, asOf: string) {
  const weights = weightsUpTo.all(userId, asOf);
  const current = weights.length ? weights[weights.length - 1].weight : p.startWeight;
  const rate = weeklyRate(weights);
  const foodDays = foodDaysUpTo.all(userId, asOf).map((r) => r.date);
  const b = bmi(current, p.heightCm);
  const projected = rate < -0.01 && current > p.goalWeight ? addDays(asOf, Math.round(((current - p.goalWeight) / -rate) * 7)) : null;
  return {
    asOf,
    currentWeight: current,
    startWeight: p.startWeight,
    goalWeight: p.goalWeight,
    lostKg: round(p.startWeight - current, 1),
    goalProgressPercent: round(goalProgress(current, p), 1),
    weeklyRateKg: round(rate, 2),
    projectedGoalDate: projected,
    bmi: round(b, 1),
    bmiCategory: bmiCategory(b),
    currentStreak: currentStreak(new Set(foodDays), asOf),
    longestStreak: longestStreak(foodDays),
  };
}

export function badges(userId: string, p: Profile, asOf: string) {
  const o = overview(userId, p, asOf);
  const waterDays = (db.prepare("SELECT count(*) AS n FROM water_entries WHERE user_id = ? AND glasses >= ?").get(userId, p.waterGoal) as { n: number }).n;
  const workouts = (db.prepare("SELECT count(*) AS n FROM exercise_entries WHERE user_id = ?").get(userId) as { n: number }).n;
  const foods = (db.prepare("SELECT count(*) AS n FROM food_entries WHERE user_id = ?").get(userId) as { n: number }).n;
  const imperial = p.units === "imperial";
  const lost = (kg: number) => `${Math.round(imperial ? kg * 2.20462 : kg)} ${imperial ? "lb" : "kg"}`;
  const make = (id: string, title: string, description: string, emoji: string, value: number, target: number) => ({
    id,
    title,
    description,
    emoji,
    earned: value >= target,
    progress: round(Math.max(0, Math.min(1, value / target)), 3),
  });
  return [
    make("first-log", "First step", "Log your first meal", "🌱", foods, 1),
    make("streak-7", "Week warrior", "7-day logging streak", "🔥", o.longestStreak, 7),
    make("streak-30", "Habit formed", "30-day logging streak", "🏆", o.longestStreak, 30),
    make("lost-2", `Down ${lost(2)}`, `Lose your first ${lost(2)}`, "📉", o.lostKg, 2),
    make("lost-5", `Down ${lost(5)}`, `Lose ${lost(5)} total`, "💪", o.lostKg, 5),
    make("lost-10", `Down ${lost(10)}`, `Lose ${lost(10)} total`, "🚀", o.lostKg, 10),
    make("halfway", "Halfway there", "Reach 50% of your goal", "⛰️", o.goalProgressPercent, 50),
    make("goal", "Goal reached", "Hit your goal weight", "🎯", o.goalProgressPercent, 100),
    make("hydrated", "Hydration hero", "Hit your water goal on 20 days", "💧", waterDays, 20),
    make("active", "On the move", "Log 25 workouts", "👟", workouts, 25),
  ];
}
