"use client";

import { Menu, type MenuItem } from "@/components/ui/menu";
import type { MealPlan, PlanItem } from "@/lib/api";
import { PLAN_MEALS } from "@/lib/plan-math";
import { MEAL_EMOJI, MEAL_LABEL } from "@/lib/ui";
import { shortDay } from "@/lib/week";
import { fromKey } from "@/lib/date";
import { SlotItems } from "./slot-items";
import { StatusPill } from "./status-pill";
import type { SlotTarget } from "./add-food-sheet";

/** Desktop week grid: days as columns, meals as rows. Scrolls sideways when space is tight. */
export function WeekGrid({
  plan,
  onOpen,
  onAdd,
  dayActions,
}: {
  plan: MealPlan;
  onOpen: (i: PlanItem) => void;
  onAdd: (t: SlotTarget) => void;
  dayActions: (date: string) => MenuItem[];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-card">
      <table className="w-full min-w-[980px] table-fixed border-collapse text-left">
        <caption className="sr-only">Meal plan for the week. Each column is a day, each row a meal.</caption>
        <colgroup>
          <col className="w-24" />
          {plan.days.map((d) => (
            <col key={d.date} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-border">
            <td />
            {plan.days.map((d) => (
              <th key={d.date} scope="col" className="px-2 py-3 align-top font-normal">
                <div className="flex items-start justify-between gap-1">
                  <span className="block text-sm font-semibold">
                    {shortDay(d.date)} <span className="font-normal text-muted">{fromKey(d.date).getDate()}</span>
                  </span>
                  <Menu label={`${fromKey(d.date).toLocaleDateString(undefined, { weekday: "long" })} actions`} items={dayActions(d.date)} className="-mr-1 -mt-1" />
                </div>
                <span className="mt-0.5 block text-xs tabular text-muted">{d.status.state === "empty" ? "—" : `${Math.round(d.calories).toLocaleString()} kcal`}</span>
                {d.status.state !== "empty" && <StatusPill status={d.status} compact className="mt-1" />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PLAN_MEALS.map((meal) => (
            <tr key={meal} className="border-b border-border last:border-0">
              <th scope="row" className="px-3 py-2 align-top text-sm font-medium">
                <span aria-hidden>{MEAL_EMOJI[meal]} </span>
                {MEAL_LABEL[meal]}
              </th>
              {plan.days.map((d) => {
                const items = plan.items.filter((i) => i.date === d.date && i.meal === meal);
                return (
                  <td key={d.date} className="px-1.5 py-2 align-top">
                    <SlotItems compact items={items} date={d.date} meal={meal} onOpen={onOpen} onAdd={() => onAdd({ date: d.date, meal })} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
