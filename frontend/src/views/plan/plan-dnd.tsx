"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Active,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type Over,
} from "@dnd-kit/core";
import clsx from "clsx";
import { Copy } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { LibraryFood, MealPlan, PlanItem } from "@/lib/api";
import { addDays, fromKey } from "@/lib/date";
import { itemNutrition, PLAN_MEALS } from "@/lib/plan-math";
import { usePlan } from "@/lib/plan-store";
import type { MealType } from "@/lib/types";
import { MEAL_LABEL } from "@/lib/ui";
import { shortDay } from "@/lib/week";
import type { SlotTarget } from "./add-food-sheet";
import { useUndoable } from "./use-undoable";

/**
 * Drag and drop for the planner: library foods and planned foods can be dropped on any meal slot.
 * Dropping a planned food moves it; holding Alt/Option copies it. Mouse, touch (long press) and
 * keyboard (Space to pick up and drop, arrows to go between slots, Escape to cancel) all work,
 * and every step is announced. Every drag also has a menu/tap alternative in the item sheet.
 */

type DragData = { kind: "food"; food: LibraryFood } | { kind: "item"; item: PlanItem };

const slotId = (date: string, meal: MealType) => `slot:${date}:${meal}`;
const dragOf = (a: Active | null) => (a?.data.current as DragData | undefined) ?? null;
const slotOf = (o: Over | null) => (o?.data.current as SlotTarget | undefined) ?? null;
const foodOf = (d: DragData) => (d.kind === "food" ? d.food : d.item.food);
const weekday = (date: string) => fromKey(date).toLocaleDateString(undefined, { weekday: "long" });
const spoken = (s: SlotTarget) => `${weekday(s.date)} ${MEAL_LABEL[s.meal].toLowerCase()}`;

type Outcome = "add" | "move" | "copy" | "none";

/** What dropping here would do, and the slot's total afterwards. */
function outcome(plan: MealPlan | null, drag: DragData, to: SlotTarget, copy: boolean): { kind: Outcome; slotCalories: number } {
  const slotItems = plan?.items.filter((i) => i.date === to.date && i.meal === to.meal) ?? [];
  const now = slotItems.reduce((s, i) => s + i.calories, 0);
  const kind: Outcome =
    drag.kind === "food" ? "add" : copy ? "copy" : drag.item.date === to.date && drag.item.meal === to.meal ? "none" : "move";
  const adding = kind === "none" ? 0 : drag.kind === "food" ? itemNutrition(drag.food, 1).calories : drag.item.calories;
  return { kind, slotCalories: Math.round(now + adding) };
}

const PAST: Record<Outcome, string> = { add: "Added", move: "Moved", copy: "Copied", none: "" };

/** Pointer drags hit the slot under the pointer; keyboard drags land on the nearest slot. */
const collision: CollisionDetection = (args) => (args.pointerCoordinates ? pointerWithin(args) : closestCenter(args));

/** Arrow keys step between slots: left/right change the day, up/down change the meal. */
const slotKeyboard: KeyboardCoordinateGetter = (event, { context: { active, over, droppableRects, collisionRect } }) => {
  const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.code];
  if (!step || !collisionRect) return undefined;
  event.preventDefault();
  const drag = dragOf(active);
  const from = slotOf(over) ?? (drag?.kind === "item" ? { date: drag.item.date, meal: drag.item.meal } : null);
  const meal = from && PLAN_MEALS[PLAN_MEALS.indexOf(from.meal) + step[1]];
  // A library food starts outside the plan, so its first arrow press goes to the week's first breakfast.
  const first = usePlan.getState().plan?.days[0]?.date;
  const target = from ? meal && droppableRects.get(slotId(addDays(from.date, step[0]), meal)) : first && droppableRects.get(slotId(first, "breakfast"));
  if (!target) return undefined;
  return {
    x: target.left + (target.width - collisionRect.width) / 2,
    y: target.top + Math.min(8, (target.height - collisionRect.height) / 2),
  };
};

const CopyMode = createContext(false);

export function PlanDnd({ children }: { children: ReactNode }) {
  const undoable = useUndoable();
  const { addItem, updateItem, copyItem } = usePlan();
  const [dragging, setDragging] = useState<DragData | null>(null);
  // Alt/Option can be pressed or released mid-drag, so it's tracked from the keyboard as well.
  const [copy, setCopy] = useState(false);
  const copyRef = useRef(false);
  const setCopyMode = (on: boolean) => {
    copyRef.current = on;
    setCopy(on);
  };
  useEffect(() => {
    if (!dragging) return;
    const onKey = (e: KeyboardEvent) => e.key === "Alt" && setCopyMode(e.type === "keydown");
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [dragging]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    // Enter is left to open the food; Space picks up and drops.
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
      coordinateGetter: slotKeyboard,
    }),
  );

  const plan = () => usePlan.getState().plan;
  // A keyboard drag starts over its own slot; saying so would talk over "Picked up".
  const atStart = useRef(false);
  // Worked out before the drop changes the plan, so the announced total is the new one.
  const dropMessage = useRef<string | undefined>(undefined);
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const d = dragOf(active);
      return d
        ? `Picked up ${foodOf(d).name}. Use the arrow keys to choose a day and meal, then press Space to drop, or Escape to cancel.`
        : undefined;
    },
    onDragOver: ({ active, over }) => {
      const d = dragOf(active);
      const s = slotOf(over);
      const first = atStart.current;
      atStart.current = false;
      if (!d) return undefined;
      if (!s) return `${foodOf(d).name} is not over a meal.`;
      const o = outcome(plan(), d, s, copyRef.current);
      if (first && o.kind === "none") return undefined;
      return o.kind === "none"
        ? `Over ${spoken(s)}, where it is now.`
        : `Over ${spoken(s)}. ${MEAL_LABEL[s.meal]} would be ${o.slotCalories} kcal.`;
    },
    onDragEnd: () => dropMessage.current,
    onDragCancel: ({ active }) => {
      const d = dragOf(active);
      return d ? `Cancelled. ${foodOf(d).name} was not moved.` : undefined;
    },
  };

  const onDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    setDragging(dragOf(active));
    atStart.current = true;
    setCopyMode((activatorEvent as MouseEvent | KeyboardEvent).altKey ?? false);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const d = dragOf(active);
    const to = slotOf(over);
    const copying = copyRef.current;
    setDragging(null);
    setCopyMode(false);
    dropMessage.current = undefined;
    if (!d) return;
    const name = foodOf(d).name;
    const result = to && outcome(plan(), d, to, copying);
    dropMessage.current =
      !to || !result || result.kind === "none"
        ? `${name} was not moved.`
        : `${PAST[result.kind]} ${name} to ${spoken(to)}. ${MEAL_LABEL[to.meal]} is now ${result.slotCalories} kcal.`;
    if (!to || !result) return;
    const where = `${shortDay(to.date)} ${MEAL_LABEL[to.meal].toLowerCase()}`;
    const kind = result.kind;
    if (kind === "add" && d.kind === "food") undoable([to.date], () => addItem(to.date, to.meal, d.food), `Added ${name} to ${where}`);
    if (d.kind !== "item") return;
    if (kind === "copy") undoable([to.date], () => copyItem(d.item.id, to), `Copied ${name} to ${where}`);
    if (kind === "move") {
      undoable([d.item.date, to.date], () => updateItem(d.item.id, to), `Moved ${name} to ${where}`);
      // The food now lives in another slot; keep keyboard focus on it there.
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-plan-item="${d.item.id}"]`)?.focus());
    }
  };

  const reset = () => {
    setDragging(null);
    setCopyMode(false);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "To move this food, press Space to pick it up, use the arrow keys to choose a day and meal, and press Space again to drop it. Hold Alt or Option while dropping to copy it instead. Press Escape to cancel.",
        },
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={reset}
    >
      <CopyMode.Provider value={copy}>
        {children}
        <DragOverlay dropAnimation={null}>{dragging && <DragPreview drag={dragging} copy={copy} />}</DragOverlay>
      </CopyMode.Provider>
    </DndContext>
  );
}

function DragPreview({ drag, copy }: { drag: DragData; copy: boolean }) {
  const food = foodOf(drag);
  const kcal = drag.kind === "food" ? food.calories : drag.item.calories;
  return (
    <div className="flex w-56 cursor-grabbing items-center gap-2 rounded-xl border border-brand bg-surface px-3 py-2 shadow-xl">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{food.name}</p>
        <p className="tabular text-xs text-muted">{Math.round(kcal)} kcal</p>
      </div>
      {copy && drag.kind === "item" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-strong">
          <Copy className="size-3" aria-hidden /> Copy
        </span>
      )}
    </div>
  );
}

/** Makes a meal slot a drop target. While something is dragged over it, `preview` is the slot's total after the drop. */
export function useSlotDrop(date: string, meal: MealType) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId(date, meal), data: { date, meal } satisfies SlotTarget });
  const { active } = useDndContext();
  const copy = useContext(CopyMode);
  const plan = usePlan((s) => s.plan);
  const drag = dragOf(active);
  const result = drag && isOver ? outcome(plan, drag, { date, meal }, copy) : null;
  return { setNodeRef, dragging: !!drag, isOver, preview: result && result.kind !== "none" ? result.slotCalories : null };
}

/** Pointer, touch and keyboard drag props for a planned food. Spread `props` onto its button. */
export function usePlanItemDrag(item: PlanItem) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `item:${item.id}`,
    data: { kind: "item", item } satisfies DragData,
  });
  return { ref: setNodeRef, props: { ...attributes, ...listeners, "data-plan-item": item.id }, isDragging };
}

/** Wraps a library card so it can be dragged onto a slot. */
export function DraggableFood({ food, children }: { food: LibraryFood; children: ReactNode }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `food:${food.id}`,
    data: { kind: "food", food } satisfies DragData,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`${food.name}, ${food.serving}, ${Math.round(food.calories)} kcal. Drag to a meal`}
      className={clsx(
        "cursor-grab touch-manipulation select-none rounded-xl outline-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-brand",
        isDragging && "outline-2 outline-dashed outline-brand",
      )}
    >
      {children}
    </div>
  );
}
