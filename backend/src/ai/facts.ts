import { db } from "../db/index.js";
import { addDays, lastNDays } from "../lib/dates.js";
import { dayTotals, overview } from "../lib/stats.js";
import type { Profile } from "../routes/profile.js";

// Deterministic facts the model is grounded on. The model phrases these; it never computes them.
// Values are already in the user's display units and rounded, so no arithmetic is left to the model.

const KG_TO_LB = 2.20462;

export function unitsFor(p: Profile) {
  const imperial = p.units === "imperial";
  return {
    w: (kg: number) => `${(Math.round((imperial ? kg * KG_TO_LB : kg) * 10) / 10).toFixed(1)} ${imperial ? "lb" : "kg"}`,
  };
}

export function weekStats(userId: string, end: string) {
  const days = lastNDays(7, end);
  const totals = dayTotals(userId, days[0], end);
  const logged = totals.filter((t) => t.calories > 0);
  const n = Math.max(1, logged.length);
  const water = db
    .prepare("SELECT COALESCE(SUM(glasses), 0) AS g FROM water_entries WHERE user_id = ? AND date BETWEEN ? AND ?")
    .get(userId, days[0], end) as { g: number };
  const workouts = db
    .prepare("SELECT count(*) AS n, COALESCE(SUM(minutes), 0) AS minutes, COALESCE(SUM(calories), 0) AS kcal FROM exercise_entries WHERE user_id = ? AND date BETWEEN ? AND ?")
    .get(userId, days[0], end) as { n: number; minutes: number; kcal: number };
  return {
    from: days[0],
    to: end,
    daysLogged: logged.length,
    avgIntake: Math.round(logged.reduce((s, t) => s + t.calories, 0) / n),
    avgBurned: Math.round(logged.reduce((s, t) => s + t.burned, 0) / n),
    avgNet: Math.round(logged.reduce((s, t) => s + t.net, 0) / n),
    avgProtein: Math.round(logged.reduce((s, t) => s + t.protein, 0) / n),
    avgWaterGlasses: Math.round((water.g / 7) * 10) / 10,
    workouts: workouts.n,
    workoutMinutes: workouts.minutes,
    workoutKcal: Math.round(workouts.kcal),
    totals,
  };
}

const weightOnOrBefore = db.prepare<[string, string], { weight: number }>("SELECT weight FROM weight_entries WHERE user_id = ? AND date <= ? ORDER BY date DESC LIMIT 1");

/** Snapshot for the chat coach: everything it may talk about, as plain facts. */
export function coachFacts(userId: string, p: Profile, today: string) {
  const { w } = unitsFor(p);
  const o = overview(userId, p, today);
  const thisWeek = weekStats(userId, today);
  const lastWeek = weekStats(userId, addDays(today, -7));
  const monthAgo = weightOnOrBefore.get(userId, addDays(today, -30))?.weight;
  const todayTotals = thisWeek.totals[thisWeek.totals.length - 1];

  const month = dayTotals(userId, addDays(today, -29), today).filter((t) => t.calories > 0);
  const best = [...month].sort((a, b) => Math.abs(a.net - p.calorieGoal) - Math.abs(b.net - p.calorieGoal))[0];
  const proteinHit = thisWeek.totals.filter((t) => t.calories > 0 && t.protein >= p.macroGoals.protein).length;
  const waterHit = (db.prepare("SELECT count(*) AS n FROM water_entries WHERE user_id = ? AND date BETWEEN ? AND ? AND glasses >= ?").get(userId, thisWeek.from, today, p.waterGoal) as { n: number }).n;

  const journal = db.prepare("SELECT sleep_hours AS sleep, mood FROM journal_entries WHERE user_id = ? AND sleep_hours IS NOT NULL AND mood IS NOT NULL").all(userId) as { sleep: number; mood: number }[];
  const avgMood = (xs: typeof journal) => (xs.length ? Math.round((xs.reduce((s, j) => s + j.mood, 0) / xs.length) * 10) / 10 : null);

  return {
    today,
    units: p.units,
    goals: {
      goalWeight: w(p.goalWeight),
      dailyCalories: p.calorieGoal,
      protein_g: p.macroGoals.protein,
      carbs_g: p.macroGoals.carbs,
      fat_g: p.macroGoals.fat,
      waterGlasses: p.waterGoal,
    },
    weight: {
      startDate: p.startDate,
      start: w(o.startWeight),
      current: w(o.currentWeight),
      lostSinceStart: w(o.lostKg),
      changeLast30Days: monthAgo === undefined ? null : w(o.currentWeight - monthAgo),
      goalProgressPercent: Math.round(o.goalProgressPercent),
      trendPerWeek: w(o.weeklyRateKg),
      toGo: w(Math.max(0, o.currentWeight - p.goalWeight)),
      projectedGoalDate: o.projectedGoalDate,
      bmi: o.bmi,
      bmiCategory: o.bmiCategory,
    },
    todaySoFar: {
      eaten_kcal: Math.round(todayTotals.calories),
      burned_kcal: Math.round(todayTotals.burned),
      remaining_kcal: Math.round(p.calorieGoal - todayTotals.net),
      protein_g: Math.round(todayTotals.protein),
    },
    thisWeek: { ...withoutTotals(thisWeek), proteinGoalHitDays: proteinHit, waterGoalHitDays: waterHit },
    lastWeek: withoutTotals(lastWeek),
    streaks: { currentDays: o.currentStreak, longestDays: o.longestStreak },
    sleepAndMood: {
      entries: journal.length,
      avgMoodAfter7PlusHoursSleep: avgMood(journal.filter((j) => j.sleep >= 7)),
      avgMoodAfterUnder7HoursSleep: avgMood(journal.filter((j) => j.sleep < 7)),
    },
    bestDayLast30: best ? { date: best.date, eaten_kcal: Math.round(best.calories), burned_kcal: Math.round(best.burned), protein_g: Math.round(best.protein) } : null,
  };
}

function withoutTotals<T extends { totals: unknown }>(x: T): Omit<T, "totals"> {
  const { totals: _, ...rest } = x;
  return rest;
}
