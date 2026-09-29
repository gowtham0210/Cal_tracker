"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Card, ProgressBar } from "@/components/ui";
import { Menu, type MenuItem } from "@/components/ui/menu";
import type { MealPlan, PlanItem } from "@/lib/api";
import { fromKey } from "@/lib/date";
import { PLAN_MEALS } from "@/lib/plan-math";
import { MEAL_EMOJI, MEAL_LABEL } from "@/lib/ui";
import { longDay, shortDay } from "@/lib/week";
import type { SlotTarget } from "./add-food-sheet";
import { SlotItems } from "./slot-items";
import { StatusDot, StatusPill } from "./status-pill";

/** Phones and tablets: one day at a time, with day chips that show each day's status. */
export function DayView({
  plan,
  day,
  onDay,
  onOpen,
  onAdd,
  dayActions,
}: {
  plan: MealPlan;
  day: string;
  onDay: (d: string) => void;
  onOpen: (i: PlanItem) => void;
  onAdd: (t: SlotTarget) => void;
  dayActions: (date: string) => MenuItem[];
}) {
  const index = Math.max(0, plan.days.findIndex((d) => d.date === day));
  const current = plan.days[index];

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Days of the week" className="grid grid-cols-7 gap-1">
        {plan.days.map((d) => {
          const selected = d.date === current.date;
          return (
            <button
              key={d.date}
              role="tab"
              id={`day-tab-${d.date}`}
              aria-selected={selected}
              aria-controls="day-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => onDay(d.date)}
              onKeyDown={(e) => {
                const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
                if (!step) return;
                e.preventDefault();
                const next = plan.days[(index + step + 7) % 7].date;
                onDay(next);
                requestAnimationFrame(() => document.getElementById(`day-tab-${next}`)?.focus());
              }}
              className={clsx(
                "flex flex-col items-center gap-1 rounded-xl py-2 text-xs font-medium transition",
                selected ? "bg-brand text-brand-contrast" : "bg-surface-2 text-muted hover:text-text",
              )}
            >
              <span>{shortDay(d.date).slice(0, 2)}</span>
              <span className={clsx("text-sm font-semibold", selected ? "" : "text-text")}>{fromKey(d.date).getDate()}</span>
              <StatusDot status={d.status} />
            </button>
          );
        })}
      </div>

      <div id="day-panel" role="tabpanel" aria-labelledby={`day-tab-${current.date}`} className="space-y-3">
        <Card>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">{longDay(current.date)}</h2>
              <p className="mt-0.5 text-sm tabular text-muted">
                {Math.round(current.calories).toLocaleString()} of {plan.calorieGoal.toLocaleString()} kcal
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Menu label={`${longDay(current.date)} actions`} items={dayActions(current.date)} />
              <Button variant="ghost" size="icon" aria-label="Previous day" disabled={index === 0} onClick={() => onDay(plan.days[index - 1].date)}>
                <ChevronLeft className="size-5" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Next day" disabled={index === 6} onClick={() => onDay(plan.days[index + 1].date)}>
                <ChevronRight className="size-5" />
              </Button>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <ProgressBar value={current.calories} max={plan.calorieGoal} label="Calories planned against your goal" />
            <StatusPill status={current.status} />
          </div>
        </Card>

        {PLAN_MEALS.map((meal) => {
          const items = plan.items.filter((i) => i.date === current.date && i.meal === meal);
          return (
            <Card key={meal} as="section" aria-label={MEAL_LABEL[meal]}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium">
                  <span aria-hidden>{MEAL_EMOJI[meal]} </span>
                  {MEAL_LABEL[meal]}
                </h3>
                <span className="text-sm tabular text-muted">{Math.round(current.meals[meal].calories)} kcal</span>
              </div>
              <SlotItems items={items} date={current.date} meal={meal} onOpen={onOpen} onAdd={() => onAdd({ date: current.date, meal })} />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
