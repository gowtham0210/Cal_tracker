"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type ApiFoodEntry, type MealPlan, type PlanItem } from "./api";
import { usePlan } from "./plan-store";
import { useStore } from "./store";
import type { MealType } from "./types";
import { MEAL_LABEL } from "./ui";
import { mondayOf } from "./week";

/** The toast after logging a planned meal. */
export const loggedMessage = (meal: MealType, entries: ApiFoodEntry[]) =>
  `Logged ${MEAL_LABEL[meal].toLowerCase()} from your plan (${Math.round(entries.reduce((s, e) => s + e.calories, 0))} kcal)`;

/**
 * The plan for one day, outside the planner (dashboard, Quick add), and logging a planned meal
 * to the food log with the plan's numbers.
 */
export function usePlannedDay(date: string) {
  const weekStart = mondayOf(date);
  const [state, setState] = useState<{ week: string; plan?: MealPlan; error?: string } | null>(null);
  const addSavedFoods = useStore((s) => s.addSavedFoods);
  const adopt = usePlan((s) => s.adopt);
  // Refetch when this day's plan entries change (e.g. one is deleted from the food log), so "Logged" stays true.
  const planEntries = useStore((s) => s.foods.filter((f) => f.source === "plan" && f.date === date).length);

  useEffect(() => {
    let live = true;
    api
      .plan(weekStart)
      .then((plan) => live && setState({ week: weekStart, plan }))
      .catch((e) => live && setState({ week: weekStart, error: e instanceof ApiError ? e.problem.title : "Couldn't load your plan." }));
    return () => {
      live = false;
    };
  }, [weekStart, planEntries]);

  const log = useCallback(
    async (meal: MealType) => {
      const r = await api.logPlannedMeal(weekStart, date, meal);
      addSavedFoods(r.entries);
      setState({ week: weekStart, plan: r.plan });
      adopt(r.plan);
      return r.entries;
    },
    [weekStart, date, addSavedFoods, adopt],
  );

  // Only this week's data counts; a previous week's is treated as still loading.
  const current = state?.week === weekStart ? state : null;
  const items = (meal?: MealType): PlanItem[] => current?.plan?.items.filter((i) => i.date === date && (!meal || i.meal === meal)) ?? [];
  return { error: current?.error ?? null, loading: !current, items, log };
}
