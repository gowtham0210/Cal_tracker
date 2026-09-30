"use client";

import { create } from "zustand";
import { api, ApiError, type ApiFoodEntry, type ApiProfile, type User } from "./api";
import type { ChatMessage, ExerciseEntry, FavoriteFood, FoodEntry, JournalEntry, MeasurementEntry, Profile, WeightEntry } from "./types";

/**
 * The app's working copy of the signed-in user's data. The server is the source of truth:
 * `load()` fills the store, and every action updates the screen right away, saves to the API,
 * and rolls back (with an error message) if the save fails.
 */

export type Status = "idle" | "loading" | "ready" | "needs-profile" | "error";

export interface Data {
  profile: Profile;
  foods: FoodEntry[];
  favorites: FavoriteFood[];
  weights: WeightEntry[];
  measurements: MeasurementEntry[];
  exercises: ExerciseEntry[];
  water: Record<string, number>;
  journal: Record<string, JournalEntry>;
}

interface State extends Data {
  status: Status;
  loadError: string | null;
  user: User | null;
  chat: ChatMessage[];

  load: () => Promise<void>;
  reset: () => void;
  resetDemo: () => Promise<void>;
  clearAll: () => Promise<void>;

  addFood: (f: Omit<FoodEntry, "id" | "createdAt">) => FoodEntry;
  /** Adds entries the server already created (e.g. logged from a plan). */
  addSavedFoods: (entries: ApiFoodEntry[]) => void;
  updateFood: (id: string, patch: Partial<FoodEntry>) => void;
  removeFood: (id: string) => void;
  restoreFood: (f: FoodEntry) => void;

  addFavorite: (f: Omit<FavoriteFood, "id">) => void;
  removeFavorite: (id: string) => void;

  logWeight: (date: string, weight: number) => void;
  removeWeight: (id: string) => void;

  logMeasurement: (m: Omit<MeasurementEntry, "id">) => void;
  removeMeasurement: (id: string) => void;

  addExercise: (e: Omit<ExerciseEntry, "id">) => void;
  removeExercise: (id: string) => void;

  setWater: (date: string, glasses: number) => void;
  saveJournal: (j: JournalEntry) => void;

  updateProfile: (patch: Partial<Profile>) => void;

  setChat: (chat: ChatMessage[]) => void;
  clearChat: () => void;
}

/* ---------------- Sync plumbing ---------------- */

type ErrorListener = (message: string) => void;
const errorListeners = new Set<ErrorListener>();

/** Subscribes to save failures, so the UI can show them. */
export function onSyncError(fn: ErrorListener) {
  errorListeners.add(fn);
  return () => void errorListeners.delete(fn);
}

/** Shows a save failure from elsewhere in the app (e.g. the planner). */
export function reportSyncError(message: string) {
  errorListeners.forEach((fn) => fn(message));
}

function reportError(err: unknown, fallback: string) {
  if (err instanceof ApiError && err.status === 401) return; // The session handler signs out.
  const message = err instanceof ApiError && err.status !== 0 && err.status < 500 ? err.problem.detail ?? err.problem.title : err instanceof ApiError ? err.problem.title : fallback;
  errorListeners.forEach((fn) => fn(message));
}

// Saves to the same key (e.g. one day's water) are sent one after another, in order.
const queues = new Map<string, Promise<unknown>>();
function serial<T>(key: string, task: () => Promise<T>): Promise<T> {
  const next = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(task);
  queues.set(key, next);
  void next.finally(() => queues.get(key) === next && queues.delete(key));
  return next;
}

/** Resolves once the profile saves queued so far have finished (whether or not they worked). */
export const profileSaved = () => (queues.get("profile") ?? Promise.resolve()).then(
  () => {},
  () => {},
);

// New entries get a temporary id until the server answers; later edits wait for the real one.
const pendingIds = new Map<string, Promise<string>>();
const tempId = () => `tmp-${Math.random().toString(36).slice(2, 10)}`;
const realId = async (id: string) => (id.startsWith("tmp-") ? ((await pendingIds.get(id)) ?? id) : id);

/* ---------------- Mapping ---------------- */

const toFood = (f: ApiFoodEntry): FoodEntry => ({
  id: f.id,
  date: f.date,
  meal: f.meal,
  name: f.name,
  calories: f.calories,
  protein: f.protein,
  carbs: f.carbs,
  fat: f.fat,
  source: f.source,
  favoriteId: f.favoriteId,
  createdAt: Date.parse(f.createdAt),
});

const toProfile = (p: ApiProfile, user: User): Profile => ({
  name: user.name,
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
  timeZone: p.timeZone,
  cuisine: p.cuisine,
  dietType: p.dietType,
  allergies: p.allergies,
  budget: p.budget,
  dailyBudget: p.dailyBudget,
});

const byDate = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date);

const EMPTY: Omit<Data, "profile"> = { foods: [], favorites: [], weights: [], measurements: [], exercises: [], water: {}, journal: {} };

/* ---------------- Store ---------------- */

export const useStore = create<State>()((set, get) => {
  /** Applies a change now, runs `save`, and restores the previous state if it fails. */
  function optimistic(change: (s: State) => Partial<State>, save: () => Promise<unknown>, failure: string) {
    const before = get();
    const patch = change(before);
    set(patch);
    save().catch((err) => {
      // Undo only the fields this change touched.
      set(Object.fromEntries(Object.keys(patch).map((k) => [k, before[k as keyof State]])) as Partial<State>);
      reportError(err, failure);
    });
  }

  return {
    ...(EMPTY as Omit<Data, "profile">),
    profile: undefined as unknown as Profile,
    status: "idle",
    loadError: null,
    user: null,
    chat: [],

    load: async () => {
      set({ status: "loading", loadError: null });
      try {
        const user = await api.me();
        let profile: ApiProfile;
        try {
          profile = await api.profile();
        } catch (err) {
          if (err instanceof ApiError && err.kind === "profile-required") {
            set({ user, status: "needs-profile" });
            return;
          }
          throw err;
        }
        const [foods, favorites, weights, measurements, exercises, water, journal, chat] = await Promise.all([
          api.foods(),
          api.favorites(),
          api.weights(),
          api.measurements(),
          api.exercises(),
          api.water(),
          api.journal(),
          api.coachMessages(),
        ]);
        set({
          user,
          profile: toProfile(profile, user),
          foods: foods.map(toFood),
          favorites,
          weights: weights.map((w) => ({ id: w.date, ...w })),
          measurements: measurements.map((m) => ({ id: m.date, ...m })),
          exercises,
          water: Object.fromEntries(water.map((w) => [w.date, w.glasses])),
          journal: Object.fromEntries(journal.map((j) => [j.date, j as JournalEntry])),
          chat: chat.map(({ id, role, text }) => ({ id, role, text })),
          status: "ready",
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return set({ status: "idle" });
        set({ status: "error", loadError: err instanceof ApiError ? err.problem.title : "Couldn't load your data." });
      }
    },

    reset: () => set({ ...EMPTY, profile: undefined as unknown as Profile, user: null, chat: [], status: "idle", loadError: null }),

    resetDemo: async () => {
      await api.loadDemoData();
      await get().load();
    },
    clearAll: async () => {
      await api.clearData();
      await get().load();
    },

    /* ---------- Food ---------- */

    addSavedFoods: (entries) => set((s) => ({ foods: [...s.foods, ...entries.map(toFood)] })),
    addFood: (f) => {
      const entry: FoodEntry = { ...f, id: tempId(), createdAt: Date.now() };
      const saved = (async () => {
        // A favorite saved a moment ago may still be waiting for its server id.
        const favoriteId = f.favoriteId ? await realId(f.favoriteId) : null;
        return api.createFood({
          date: f.date,
          meal: f.meal,
          name: f.name,
          calories: f.calories,
          protein: f.protein,
          carbs: f.carbs,
          fat: f.fat,
          source: f.source ?? "manual",
          favoriteId: favoriteId?.startsWith("tmp-") ? null : favoriteId,
        });
      })().then((created) => {
          set((s) => ({ foods: s.foods.map((x) => (x.id === entry.id ? toFood(created) : x)) }));
          return created.id;
        });
      pendingIds.set(entry.id, saved.catch(() => entry.id));
      set((s) => ({ foods: [...s.foods, entry] }));
      saved.catch((err) => {
        set((s) => ({ foods: s.foods.filter((x) => x.id !== entry.id) }));
        reportError(err, `Couldn't save ${f.name}.`);
      });
      return entry;
    },

    updateFood: (id, patch) => {
      const allowed = (({ date, meal, name, calories, protein, carbs, fat }) => ({ date, meal, name, calories, protein, carbs, fat }))(patch);
      const body = Object.fromEntries(Object.entries(allowed).filter(([, v]) => v !== undefined));
      optimistic(
        (s) => ({ foods: s.foods.map((f) => (f.id === id ? { ...f, ...body } : f)) }),
        () => serial(`food:${id}`, async () => api.updateFood(await realId(id), body)),
        "Couldn't save that change.",
      );
    },

    removeFood: (id) =>
      optimistic(
        (s) => ({ foods: s.foods.filter((f) => f.id !== id) }),
        () => serial(`food:${id}`, async () => api.deleteFood(await realId(id))),
        "Couldn't delete that entry.",
      ),

    restoreFood: (f) => {
      get().addFood({ date: f.date, meal: f.meal, name: f.name, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, source: f.source, favoriteId: null });
    },

    /* ---------- Favorites ---------- */

    addFavorite: (f) => {
      if (get().favorites.some((x) => x.name.toLowerCase() === f.name.toLowerCase())) return;
      const id = tempId();
      set((s) => ({ favorites: [...s.favorites, { ...f, id }] }));
      const saved = api.createFavorite({ name: f.name, meal: f.meal, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat });
      pendingIds.set(id, saved.then((x) => x.id).catch(() => id));
      saved
        .then((created) => set((s) => ({ favorites: s.favorites.map((x) => (x.id === id ? created : x)) })))
        .catch((err) => {
          set((s) => ({ favorites: s.favorites.filter((x) => x.id !== id) }));
          if (!(err instanceof ApiError && err.status === 409)) reportError(err, "Couldn't save the favorite.");
        });
    },

    removeFavorite: (id) =>
      optimistic(
        (s) => ({ favorites: s.favorites.filter((f) => f.id !== id) }),
        async () => api.deleteFavorite(await realId(id)),
        "Couldn't remove the favorite.",
      ),

    /* ---------- Body ---------- */

    logWeight: (date, weight) =>
      optimistic(
        (s) => ({ weights: [...s.weights.filter((w) => w.date !== date), { id: date, date, weight }].sort(byDate) }),
        () => serial(`weight:${date}`, () => api.putWeight(date, weight)),
        "Couldn't save your weight.",
      ),

    removeWeight: (id) =>
      optimistic(
        (s) => ({ weights: s.weights.filter((w) => w.id !== id) }),
        () => serial(`weight:${id}`, () => api.deleteWeight(id)),
        "Couldn't delete that weigh-in.",
      ),

    logMeasurement: (m) => {
      const values = { waist: m.waist, hips: m.hips, chest: m.chest };
      optimistic(
        (s) => ({ measurements: [...s.measurements.filter((x) => x.date !== m.date), { id: m.date, ...m }].sort(byDate) }),
        () => serial(`measurement:${m.date}`, () => api.putMeasurement(m.date, values)),
        "Couldn't save your measurements.",
      );
    },

    removeMeasurement: (id) =>
      optimistic(
        (s) => ({ measurements: s.measurements.filter((m) => m.id !== id) }),
        () => serial(`measurement:${id}`, () => api.deleteMeasurement(id)),
        "Couldn't delete those measurements.",
      ),

    /* ---------- Exercise ---------- */

    addExercise: (e) => {
      const id = tempId();
      set((s) => ({ exercises: [...s.exercises, { ...e, id }] }));
      const saved = api.createExercise({ date: e.date, name: e.name, minutes: e.minutes, calories: e.calories });
      pendingIds.set(id, saved.then((x) => x.id).catch(() => id));
      saved
        .then((created) => set((s) => ({ exercises: s.exercises.map((x) => (x.id === id ? { ...e, id: created.id } : x)) })))
        .catch((err) => {
          set((s) => ({ exercises: s.exercises.filter((x) => x.id !== id) }));
          reportError(err, "Couldn't save the workout.");
        });
    },

    removeExercise: (id) =>
      optimistic(
        (s) => ({ exercises: s.exercises.filter((e) => e.id !== id) }),
        async () => api.deleteExercise(await realId(id)),
        "Couldn't delete the workout.",
      ),

    /* ---------- Water and journal ---------- */

    setWater: (date, glasses) => {
      const g = Math.max(0, Math.min(30, Math.round(glasses)));
      optimistic(
        (s) => ({ water: { ...s.water, [date]: g } }),
        () => serial(`water:${date}`, () => api.putWater(date, g)),
        "Couldn't save your water.",
      );
    },

    saveJournal: (j) => {
      // The API replaces the whole day, so send the merged entry.
      const merged: JournalEntry = { ...get().journal[j.date], ...j };
      const { date, ...fields } = merged;
      const body = Object.fromEntries(Object.entries(fields).filter(([k, v]) => v !== undefined && v !== null && !(k === "note" && v === "")));
      if (!Object.keys(body).length) return;
      optimistic(
        (s) => ({ journal: { ...s.journal, [date]: merged } }),
        () => serial(`journal:${date}`, () => api.putJournal(date, body)),
        "Couldn't save your journal.",
      );
    },

    /* ---------- Profile ---------- */

    updateProfile: (patch) => {
      const { name, ...rest } = patch;
      const s = get();
      if (name !== undefined && name !== s.profile.name) {
        optimistic(
          (st) => ({ profile: { ...st.profile, name } }),
          () => api.updateMe({ name }).then((user) => set({ user })),
          "Couldn't save your name.",
        );
      }
      if (!Object.keys(rest).length) return;
      const next = { ...get().profile, ...rest };
      const changedStart = rest.startWeight !== undefined || rest.startDate !== undefined;
      optimistic(
        () => ({
          profile: next,
          // The start weight is stored as the weigh-in on the start date.
          ...(changedStart ? { weights: [...s.weights.filter((w) => w.date !== next.startDate), { id: next.startDate, date: next.startDate, weight: next.startWeight }].sort(byDate) } : {}),
        }),
        // The server tidies allergy names ("Peanuts" becomes "peanut"), so adopt its list, unless
        // the list has changed again since (that newer save will answer too).
        () =>
          serial("profile", () => api.updateProfile(rest as Partial<ApiProfile>)).then((saved) => {
            if (rest.allergies && get().profile.allergies === rest.allergies) set((st) => ({ profile: { ...st.profile, allergies: saved.allergies } }));
          }),
        "Couldn't save your settings.",
      );
    },

    /* ---------- Coach chat ---------- */

    setChat: (chat) => set({ chat }),
    clearChat: () =>
      optimistic(
        () => ({ chat: [] }),
        () => api.clearCoachMessages(),
        "Couldn't clear the conversation.",
      ),
  };
});
