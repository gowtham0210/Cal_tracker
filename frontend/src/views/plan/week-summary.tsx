"use client";

import type { MealPlan } from "@/lib/api";
import { useStore } from "@/lib/store";

/** Average calories, days on target and macros for the week. */
export function WeekSummary({ plan }: { plan: MealPlan }) {
  const trackMacros = useStore((s) => s.profile?.trackMacros ?? true);
  const { week } = plan;
  const macroKcal = week.protein * 4 + week.carbs * 4 + week.fat * 9 || 1;
  return (
    <section aria-label="Week summary" className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm shadow-card">
      <p>
        <span className="font-semibold tabular">{Math.round(week.averageCalories).toLocaleString()}</span> <span className="text-muted">kcal/day avg</span>
      </p>
      <p>
        <span className="font-semibold tabular">
          {week.daysOnTarget} of {week.plannedDays}
        </span>{" "}
        <span className="text-muted">planned days on target</span>
      </p>
      {trackMacros && week.plannedDays > 0 && (
        <p className="flex items-center gap-3 text-muted">
          {(
            [
              ["Protein", week.protein, 4],
              ["Carbs", week.carbs, 4],
              ["Fat", week.fat, 9],
            ] as const
          ).map(([label, g, k]) => (
            <span key={label}>
              {label} <span className="font-semibold tabular text-text">{Math.round(g / week.plannedDays)} g</span>
              <span className="sr-only"> per day,</span> <span className="text-xs">({Math.round(((g * k) / macroKcal) * 100)}%)</span>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
