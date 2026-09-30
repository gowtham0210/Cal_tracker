"use client";

import { create } from "zustand";
import { api, ApiError, type GenerateRequest, type LibraryFood, type MealPlan, type PlanItem, type PlanItemPatch } from "./api";
import { computePlan, renumber } from "./plan-math";
import { profileSaved, reportSyncError } from "./store";
import type { MealType } from "./types";
import { weekDates } from "./week";

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
  /** While a draft is being generated: the days asked for and those already filled. */
  generating: { weekStart: string; dates: string[]; done: string[] } | null;
  /** The last generate request, so Regenerate can repeat it. */
  lastGenerate: GenerateRequest | null;

  load: (weekStart: string) => Promise<void>;
  addItem: (date: string, meal: MealType, food: LibraryFood, quantity?: number) => string;
  updateItem: (id: string, patch: PlanItemPatch, food?: LibraryFood) => void;
  removeItem: (id: string) => void;
  copyItem: (id: string, to: { date: string; meal: MealType }) => void;
  setDay: (date: string, items: PlanItem[]) => void;
  copyDay: (from: string, to: string[], mode: "replace" | "add") => void;

  /** Takes a plan saved elsewhere (e.g. after logging from the dashboard) if it's the week on screen and nothing is saving. */
  adopt: (plan: MealPlan) => void;
  generate: (req: GenerateRequest) => Promise<void>;
  keepDraft: () => Promise<boolean>;
  /** Resolves true once applied (false if it failed, which is reported). */
  applyTemplate: (templateId: string, mode: "replace" | "fill") => Promise<boolean>;
  discardDraft: () => Promise<boolean>;

  /** The foods planned on some days, to undo a change later with restoreDays. */
  snapshotDays: (dates: string[]) => DaySnapshot;
  restoreDays: (snapshot: DaySnapshot) => void;
}

export type DaySnapshot = Record<string, PlanItem[]>;

const tmp = () => `tmp-${Math.random().toString(36).slice(2, 10)}`;

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

  /** Runs a whole-plan server step after pending saves, and adopts the plan it returns. Resolves whether it worked. */
  async function step(run: (weekStart: string) => Promise<MealPlan>, failure: string): Promise<boolean> {
    const { weekStart } = get();
    if (!weekStart) return false;
    set({ pending: get().pending + 1, touched: true });
    const next = queue.then(() => run(weekStart));
    queue = next.catch(() => {});
    try {
      const plan = await next;
      // As with edits, only adopt it when nothing newer is waiting.
      if (get().weekStart === weekStart && get().pending === 1) set({ plan });
      return true;
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) reportSyncError(err instanceof ApiError ? (err.problem.detail ?? err.problem.title) : failure);
      void get().load(weekStart);
      return false;
    } finally {
      set({ pending: get().pending - 1 });
    }
  }

  return {
    weekStart: null,
    plan: null,
    loading: false,
    error: null,
    pending: 0,
    touched: false,
    generating: null,
    lastGenerate: null,

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
      const id = tmp();
      const before = new Set(get().plan?.items.map((i) => i.id));
      const saved = mutate(
        (items) => [...items, { id, date, meal, quantity, position: 9999, food, calories: 0, protein: 0, carbs: 0, fat: 0, logged: false }],
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

    copyItem: (id, to) => {
      void mutate(
        (items) => {
          const src = items.find((i) => i.id === id);
          return src ? [...items, { ...src, id: tmp(), ...to, position: 9999, logged: false }] : items;
        },
        async (week) => api.copyPlanItem(week, await resolveId(id), to),
      ).catch(() => {});
    },

    setDay: (date, dayItems) => {
      void mutate(
        (items) => [...items.filter((i) => i.date !== date), ...dayItems.map((i, n) => ({ ...i, id: tmp(), date, position: n, logged: false }))],
        (week) => api.setPlanDay(week, date, dayItems.map((i) => ({ meal: i.meal, foodId: i.food.id, quantity: i.quantity }))),
      ).catch(() => {});
    },

    copyDay: (from, to, mode) => {
      void mutate(
        (items) => {
          const source = items.filter((i) => i.date === from);
          const kept = mode === "replace" ? items.filter((i) => !to.includes(i.date)) : items;
          return [...kept, ...to.flatMap((date) => source.map((i) => ({ ...i, id: tmp(), date, position: 9999 + i.position, logged: false })))];
        },
        (week) => api.copyPlanDay(week, from, to, mode),
      ).catch(() => {});
    },

    adopt: (plan) => {
      if (get().weekStart === plan.weekStart && get().pending === 0) set({ plan });
    },
    generate: async (req) => {
      const { weekStart } = get();
      if (!weekStart) return;
      set({ generating: { weekStart, dates: req.scope === "day" && req.date ? [req.date] : weekDates(weekStart), done: [] }, lastGenerate: req });
      // Each day is shown as soon as the server has saved it, unless the user is editing meanwhile
      // (their changes are queued behind this and would be undone on screen).
      const onDay = (date: string, plan: MealPlan) => {
        const g = get().generating;
        if (get().weekStart !== weekStart) return;
        set({ generating: g && { ...g, done: [...g.done, date] }, ...(get().pending === 1 ? { plan } : {}) });
      };
      // Preferences changed in the Generate sheet must reach the server first: allergies are hard rules.
      await step(async (week) => (await profileSaved(), api.generatePlan(week, req, onDay)), "Couldn't plan your week.");
      set({ generating: null });
    },
    keepDraft: () => step((week) => api.keepPlanDraft(week), "Couldn't keep the draft."),
    applyTemplate: (templateId, mode) => step((week) => api.applyTemplate(week, templateId, mode), "Couldn't apply the template."),
    discardDraft: () => step((week) => api.discardPlanDraft(week), "Couldn't discard the draft."),

    snapshotDays: (dates) => Object.fromEntries(dates.map((d) => [d, (get().plan?.items ?? []).filter((i) => i.date === d)])),
    restoreDays: (snapshot) => {
      for (const [date, dayItems] of Object.entries(snapshot)) get().setDay(date, dayItems);
    },
  };
});
