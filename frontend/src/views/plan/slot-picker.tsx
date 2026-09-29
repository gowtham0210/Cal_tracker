"use client";

import clsx from "clsx";
import { Segmented } from "@/components/ui";
import { fromKey } from "@/lib/date";
import { PLAN_MEALS } from "@/lib/plan-math";
import type { MealType } from "@/lib/types";
import { MEAL_LABEL } from "@/lib/ui";
import { shortDay, weekDates } from "@/lib/week";

/** Choose a day of the week and a meal. */
export function SlotPicker({
  weekStart,
  date,
  meal,
  onChange,
}: {
  weekStart: string;
  date: string;
  meal: MealType;
  onChange: (v: { date: string; meal: MealType }) => void;
}) {
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Day" className="grid grid-cols-7 gap-1">
        {weekDates(weekStart).map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={d === date}
            aria-label={fromKey(d).toLocaleDateString(undefined, { weekday: "long" })}
            onClick={() => onChange({ date: d, meal })}
            className={clsx(
              "flex flex-col items-center rounded-xl py-2 text-xs font-medium transition",
              d === date ? "bg-brand text-brand-contrast" : "bg-surface-2 text-muted hover:text-text",
            )}
          >
            <span aria-hidden>{shortDay(d).slice(0, 2)}</span>
            <span aria-hidden className="text-sm font-semibold">
              {fromKey(d).getDate()}
            </span>
          </button>
        ))}
      </div>
      <Segmented<MealType>
        label="Meal"
        value={meal}
        onChange={(m) => onChange({ date, meal: m })}
        options={PLAN_MEALS.map((m) => ({ value: m, label: MEAL_LABEL[m] }))}
        className="w-full"
        size="sm"
      />
    </div>
  );
}
