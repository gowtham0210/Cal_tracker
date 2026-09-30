"use client";

import clsx from "clsx";
import { Plus } from "lucide-react";
import { useState } from "react";
import type { PlanItem } from "@/lib/api";
import { formatQuantity } from "@/lib/plan-math";
import type { MealType } from "@/lib/types";
import { MEAL_LABEL } from "@/lib/ui";
import { longDay } from "@/lib/week";
import { usePlanItemDrag, useSlotDrop } from "./plan-dnd";

function PlannedFood({ item: i, onOpen, compact }: { item: PlanItem; onOpen: (item: PlanItem) => void; compact?: boolean }) {
  const { ref, props, isDragging } = usePlanItemDrag(i);
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      onClick={() => onOpen(i)}
      aria-label={`${i.food.name}, ${formatQuantity(i.quantity)} × ${i.food.serving}, ${Math.round(i.calories)} kcal. Change portion`}
      className={clsx(
        "w-full cursor-grab touch-manipulation select-none rounded-lg [-webkit-touch-callout:none] border border-border bg-surface text-left transition hover:border-brand/60",
        compact ? "px-2 py-1.5" : "flex items-center gap-3 px-3 py-2.5",
        i.id.startsWith("tmp-") && "opacity-70",
        isDragging && "outline-2 outline-dashed outline-brand",
      )}
    >
      <span className={clsx("block font-medium leading-snug", compact ? "line-clamp-2 text-xs" : "flex-1 text-sm")}>{i.food.name}</span>
      <span className={clsx("block tabular text-muted", compact ? "mt-0.5 text-[11px]" : "text-xs")}>
        {formatQuantity(i.quantity)} × {compact ? "" : `${i.food.serving} · `}
        {Math.round(i.calories)} kcal
      </span>
    </button>
  );
}

/** The foods in one meal slot (also a drop target), with a compact mode that shows two and "+N more". */
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
  const { setNodeRef, dragging, isOver, preview } = useSlotDrop(date, meal);

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "relative -m-1 flex flex-col gap-1.5 rounded-xl p-1 transition-colors",
        dragging && "outline-2 -outline-offset-2 outline-dashed outline-brand/40",
        isOver && "bg-brand-soft outline-solid outline-brand",
      )}
    >
      {preview !== null && (
        <p
          className="pointer-events-none absolute -top-2.5 right-1 z-10 rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold tabular text-brand-contrast shadow"
          aria-hidden
        >
          → {preview} kcal
        </p>
      )}
      {shown.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label={`Planned for ${where}`}>
          {shown.map((i) => (
            <li key={i.id}>
              <PlannedFood item={i} onOpen={onOpen} compact={compact} />
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
