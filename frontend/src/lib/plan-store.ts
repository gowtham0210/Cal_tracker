"use client";

import { create } from "zustand";
import { api, ApiError, type LibraryFood, type MealPlan, type PlanItem, type PlanItemPatch } from "./api";
import { computePlan, renumber } from "./plan-math";
import { reportSyncError } from "./store";
import type { MealType } from "./types";

/**
 * The plan for the week on screen. Changes apply instantly (recomputed with the server's rules),
 * are sent to the API one at a time in order, and the server's plan replaces the local one once
 * nothing else is waiting. If a save fails, the plan is reloaded and the error shown.
 */

interface PlanState {
  weekStart: string | null;
  plan: MealPlan | null;
  loading: boolean;
  error: string | null;
  /** Saves not yet confirmed by the server. */
  pending: number;
  /** True once anything has been saved in this session, to show the Saved state. */
  touched: boolean;

  load: (weekStart: string) => Promise<void>;
  addItem: (date: string, meal: MealType, food: LibraryFood, quantity?: number) => string;
  updateItem: (id: string, patch: PlanItemPatch, food?: LibraryFood) => void;
  removeItem: (id: string) => void;
}

// New items get a temporary id until the server answers; later changes wait for the real one.
const realIds = new Map<string, Promise<string>>();
const resolveId = async (id: string) => (id.startsWith("tmp-") ? ((await realIds.get(id)) ?? id) : id);

let queue: Promise<unknown> = Promise.resolve();

export const usePlan = create<PlanState>()((set, get) => {
  /** Applies a local change now and queues the server call. */
  function mutate(change: (items: PlanItem[]) => PlanItem[], send: (weekStart: string) => Promise<MealPlan>): Promise<MealPlan> {
    const { plan, weekStart } = get();
    if (!plan || !weekStart) return Promise.reject(new Error("No plan loaded"));
    set({ plan: computePlan(plan, renumber(change(plan.items))), pending: get().pending + 1, touched: true });
    const run = queue.then(() => send(weekStart));
    queue = run.catch(() => {});
    return run
      .then((fresh) => {
        const left = get().pending - 1;
        // Only adopt the server's plan when nothing newer is waiting, so later edits aren't undone.
        set({ pending: left, ...(left === 0 && get().weekStart === weekStart ? { plan: fresh } : {}) });
        return fresh;
      })
      .catch((err) => {
        set({ pending: get().pending - 1 });
        if (!(err instanceof ApiError && err.status === 401)) reportSyncError(err instanceof ApiError ? (err.problem.errors?.[0]?.detail ?? err.problem.title) : "Couldn't save your plan.");
        void get().load(weekStart);
        throw err;
      });
  }

  return {
    weekStart: null,
    plan: null,
    loading: false,
    error: null,
    pending: 0,
    touched: false,

    load: async (weekStart) => {
      set({ weekStart, loading: get().plan?.weekStart !== weekStart, error: null });
      try {
        const plan = await api.plan(weekStart);
        if (get().weekStart === weekStart) set({ plan, loading: false });
      } catch (err) {
        if (get().weekStart === weekStart) set({ loading: false, error: err instanceof ApiError ? err.problem.title : "Couldn't load your plan." });
      }
    },

    addItem: (date, meal, food, quantity = 1) => {
      const id = `tmp-${Math.random().toString(36).slice(2, 10)}`;
      const before = new Set(get().plan?.items.map((i) => i.id));
      const saved = mutate(
        (items) => [...items, { id, date, meal, quantity, position: 9999, food, calories: 0, protein: 0, carbs: 0, fat: 0 }],
        (week) => api.addPlanItem(week, { date, meal, foodId: food.id, quantity }),
      );
      // The new item is the one the server returns that wasn't there before.
      realIds.set(
        id,
        saved.then((plan) => plan.items.find((i) => !before.has(i.id) && i.date === date && i.meal === meal && i.food.id === food.id)?.id ?? id).catch(() => id),
      );
      return id;
    },

    updateItem: (id, patch, food) => {
      void mutate(
        (items) => {
          const moved = items.find((i) => i.id === id);
          if (!moved) return items;
          const next = { ...moved, ...patch, food: food ?? moved.food, position: patch.position ?? (patch.date || patch.meal ? 9999 : moved.position) };
          return [...items.filter((i) => i.id !== id), next].sort((a, b) => a.position - b.position);
        },
        async (week) => api.updatePlanItem(week, await resolveId(id), patch),
      ).catch(() => {});
    },

    removeItem: (id) => {
      void mutate(
        (items) => items.filter((i) => i.id !== id),
        async (week) => api.removePlanItem(week, await resolveId(id)),
      ).catch(() => {});
    },
  };
});
