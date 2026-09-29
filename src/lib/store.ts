"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generateMockData, uid, type SeedData } from "./mock";
import type { ChatMessage, ExerciseEntry, FavoriteFood, FoodEntry, JournalEntry, MeasurementEntry, Profile } from "./types";

interface State extends SeedData {
  seeded: boolean;
  chat: ChatMessage[];

  seed: () => void;
  resetDemo: () => void;
  clearAll: () => void;

  addFood: (f: Omit<FoodEntry, "id" | "createdAt">) => FoodEntry;
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

  pushChat: (m: Omit<ChatMessage, "id">) => void;
  clearChat: () => void;
}

const empty = (): SeedData => {
  const d = generateMockData();
  return {
    ...d,
    foods: [],
    favorites: [],
    weights: [],
    measurements: [],
    exercises: [],
    water: {},
    journal: {},
  };
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...({} as SeedData),
      seeded: false,
      chat: [],

      seed: () => {
        if (get().seeded) return;
        set({ ...generateMockData(), seeded: true });
      },
      resetDemo: () => set({ ...generateMockData(), seeded: true, chat: [] }),
      clearAll: () => set({ ...empty(), seeded: true, chat: [] }),

      addFood: (f) => {
        const entry: FoodEntry = { ...f, id: uid(), createdAt: Date.now() };
        set((s) => ({ foods: [...s.foods, entry] }));
        return entry;
      },
      updateFood: (id, patch) => set((s) => ({ foods: s.foods.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
      removeFood: (id) => set((s) => ({ foods: s.foods.filter((f) => f.id !== id) })),
      restoreFood: (f) => set((s) => ({ foods: [...s.foods, f] })),

      addFavorite: (f) =>
        set((s) =>
          s.favorites.some((x) => x.name.toLowerCase() === f.name.toLowerCase()) ? s : { favorites: [...s.favorites, { ...f, id: uid() }] },
        ),
      removeFavorite: (id) => set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) })),

      logWeight: (date, weight) =>
        set((s) => {
          const rest = s.weights.filter((w) => w.date !== date);
          return { weights: [...rest, { id: uid(), date, weight }].sort((a, b) => a.date.localeCompare(b.date)) };
        }),
      removeWeight: (id) => set((s) => ({ weights: s.weights.filter((w) => w.id !== id) })),

      logMeasurement: (m) =>
        set((s) => {
          const rest = s.measurements.filter((x) => x.date !== m.date);
          return {
            measurements: [...rest, { ...m, id: uid() }].sort((a, b) => a.date.localeCompare(b.date)),
          };
        }),
      removeMeasurement: (id) => set((s) => ({ measurements: s.measurements.filter((m) => m.id !== id) })),

      addExercise: (e) => set((s) => ({ exercises: [...s.exercises, { ...e, id: uid() }] })),
      removeExercise: (id) => set((s) => ({ exercises: s.exercises.filter((e) => e.id !== id) })),

      setWater: (date, glasses) => set((s) => ({ water: { ...s.water, [date]: Math.max(0, Math.min(30, glasses)) } })),
      saveJournal: (j) => set((s) => ({ journal: { ...s.journal, [j.date]: { ...s.journal[j.date], ...j } } })),

      updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),

      pushChat: (m) => set((s) => ({ chat: [...s.chat, { ...m, id: uid() }] })),
      clearChat: () => set({ chat: [] }),
    }),
    {
      name: "cal-tracker-v1",
      skipHydration: true,
      partialize: (s) => ({
        seeded: s.seeded,
        profile: s.profile,
        foods: s.foods,
        favorites: s.favorites,
        weights: s.weights,
        measurements: s.measurements,
        exercises: s.exercises,
        water: s.water,
        journal: s.journal,
        chat: s.chat,
      }),
    },
  ),
);
