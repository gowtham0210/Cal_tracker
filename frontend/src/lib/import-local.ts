import { api, type ApiProfile } from "./api";
import type { ExerciseEntry, FavoriteFood, FoodEntry, JournalEntry, MeasurementEntry, Profile, WeightEntry } from "./types";

/**
 * One-time upload of the data this browser kept before accounts existed
 * (the old "cal-tracker-v1" local storage key).
 */

const KEY = "cal-tracker-v1";

interface LocalData {
  profile?: Profile;
  foods?: FoodEntry[];
  favorites?: FavoriteFood[];
  weights?: WeightEntry[];
  measurements?: MeasurementEntry[];
  exercises?: ExerciseEntry[];
  water?: Record<string, number>;
  journal?: Record<string, JournalEntry>;
}

export function readLocalData(): (LocalData & { entries: number }) | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = (JSON.parse(raw).state ?? {}) as LocalData;
    const entries =
      (d.foods?.length ?? 0) +
      (d.weights?.length ?? 0) +
      (d.measurements?.length ?? 0) +
      (d.exercises?.length ?? 0) +
      Object.keys(d.water ?? {}).length +
      Object.keys(d.journal ?? {}).length;
    return d.profile && entries > 0 ? { ...d, entries } : null;
  } catch {
    return null;
  }
}

/** Runs tasks with limited concurrency, reporting progress. */
async function pool(tasks: (() => Promise<unknown>)[], onDone: () => void, width = 6) {
  let next = 0;
  await Promise.all(
    Array.from({ length: width }, async () => {
      while (next < tasks.length) {
        await tasks[next++]();
        onDone();
      }
    }),
  );
}

export async function importLocalData(d: LocalData, timeZone: string, onProgress: (done: number, total: number) => void) {
  const p = d.profile!;
  const profile: ApiProfile = {
    heightCm: p.heightCm,
    startWeight: p.startWeight,
    goalWeight: p.goalWeight,
    startDate: p.startDate,
    calorieGoal: p.calorieGoal,
    macroGoals: p.macroGoals,
    trackMacros: p.trackMacros,
    waterGoal: p.waterGoal,
    glassMl: p.glassMl,
    units: p.units,
    theme: p.theme,
    timeZone,
    cuisine: p.cuisine ?? "tamil-nadu",
  };
  await api.putProfile(profile);

  const tasks: (() => Promise<unknown>)[] = [
    ...(d.favorites ?? []).map((f) => () => api.createFavorite({ name: f.name, meal: f.meal, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat }).catch(() => {})),
    ...(d.foods ?? []).map((f) => () =>
      api.createFood({ date: f.date, meal: f.meal, name: f.name, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, source: f.source ?? "manual" }),
    ),
    ...(d.weights ?? []).filter((w) => w.date !== p.startDate).map((w) => () => api.putWeight(w.date, w.weight)),
    ...(d.measurements ?? [])
      .filter((m) => m.waist || m.hips || m.chest)
      .map((m) => () => api.putMeasurement(m.date, { waist: m.waist || undefined, hips: m.hips || undefined, chest: m.chest || undefined })),
    ...(d.exercises ?? []).map((e) => () => api.createExercise({ date: e.date, name: e.name, minutes: e.minutes, calories: e.calories })),
    ...Object.entries(d.water ?? {}).map(([date, glasses]) => () => api.putWater(date, glasses)),
    ...Object.values(d.journal ?? {}).flatMap((j) => {
      const fields = Object.fromEntries(Object.entries({ mood: j.mood, energy: j.energy, sleepHours: j.sleepHours, cravings: j.cravings, note: j.note || undefined }).filter(([, v]) => v !== undefined));
      return Object.keys(fields).length ? [() => api.putJournal(j.date, fields)] : [];
    }),
  ];

  let done = 0;
  onProgress(0, tasks.length);
  await pool(tasks, () => onProgress(++done, tasks.length));

  // Keep a backup under another key instead of deleting it.
  try {
    localStorage.setItem(`${KEY}-imported`, localStorage.getItem(KEY)!);
    localStorage.removeItem(KEY);
  } catch {}
}
