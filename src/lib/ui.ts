"use client";

import { create } from "zustand";
import type { MealType } from "./types";

export type DialogKind = "food" | "weight" | "exercise" | "measurement" | "quick" | "more";
export type FoodTab = "describe" | "photo" | "manual" | "favorites";

interface UIState {
  dialog: DialogKind | null;
  foodMeal: MealType;
  foodTab: FoodTab;
  date?: string;
  open: (d: DialogKind, opts?: { meal?: MealType; tab?: FoodTab; date?: string }) => void;
  close: () => void;
  setFoodTab: (t: FoodTab) => void;
}

export function defaultMeal(): MealType {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 18) return "snack";
  return "dinner";
}

export const useUI = create<UIState>()((set) => ({
  dialog: null,
  foodMeal: "breakfast",
  foodTab: "describe",
  open: (dialog, opts) =>
    set((s) => ({
      dialog,
      foodMeal: opts?.meal ?? defaultMeal(),
      foodTab: opts?.tab ?? s.foodTab,
      date: opts?.date,
    })),
  close: () => set({ dialog: null }),
  setFoodTab: (foodTab) => set({ foodTab }),
}));

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};
export const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: "🌅",
  lunch: "🥗",
  dinner: "🍽️",
  snack: "🍎",
};
export const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
