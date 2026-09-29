"use client";

import clsx from "clsx";
import { Plus } from "lucide-react";
import { useState } from "react";
import type { PlanItem } from "@/lib/api";
import { formatQuantity } from "@/lib/plan-math";
import type { MealType } from "@/lib/types";
import { MEAL_LABEL } from "@/lib/ui";
import { longDay } from "@/lib/week";

/** The foods in one meal slot, with a compact mode that shows two and "+N more". */
export function SlotItems({
  items,
  date,
  meal,
  onOpen,
  onAdd,
  compact,
}: {
  items: PlanItem[];
  date: string;
  meal: MealType;
  onOpen: (item: PlanItem) => void;
  onAdd: () => void;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = compact && !expanded ? items.slice(0, 2) : items;
  const hidden = items.length - shown.length;
  const where = `${MEAL_LABEL[meal].toLowerCase()} on ${longDay(date)}`;

  return (
    <div className="flex flex-col gap-1.5">
      {shown.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label={`Planned for ${where}`}>
          {shown.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => onOpen(i)}
                aria-label={`${i.food.name}, ${formatQuantity(i.quantity)} × ${i.food.serving}, ${Math.round(i.calories)} kcal. Change portion`}
                className={clsx(
                  "w-full rounded-lg border border-border bg-surface text-left transition hover:border-brand/60",
                  compact ? "px-2 py-1.5" : "flex items-center gap-3 px-3 py-2.5",
                  i.id.startsWith("tmp-") && "opacity-70",
                )}
              >
                <span className={clsx("block font-medium leading-snug", compact ? "line-clamp-2 text-xs" : "flex-1 text-sm")}>{i.food.name}</span>
                <span className={clsx("block tabular text-muted", compact ? "mt-0.5 text-[11px]" : "text-xs")}>
                  {formatQuantity(i.quantity)} × {compact ? "" : `${i.food.serving} · `}
                  {Math.round(i.calories)} kcal
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 && (
        <button type="button" onClick={() => setExpanded(true)} className="rounded-md px-1 text-left text-xs font-medium text-brand-strong hover:underline">
          +{hidden} more
        </button>
      )}
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Add food to ${where}`}
        className={clsx(
          "flex items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted transition hover:border-brand hover:text-brand-strong",
          compact ? "h-8 text-xs" : "h-10 text-sm",
        )}
      >
        <Plus className="size-3.5" aria-hidden /> Add
      </button>
    </div>
  );
}
