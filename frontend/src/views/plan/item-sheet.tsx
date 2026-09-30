"use client";

import clsx from "clsx";
import { ArrowRightLeft, Copy, Minus, MoveRight, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button, Sheet } from "@/components/ui";
import type { PlanItem } from "@/lib/api";
import { formatQuantity, itemNutrition } from "@/lib/plan-math";
import { usePlan } from "@/lib/plan-store";
import { useStore } from "@/lib/store";
import type { MealType } from "@/lib/types";
import { MEAL_LABEL } from "@/lib/ui";
import { longDay, shortDay } from "@/lib/week";
import { allergyText } from "./allergy-warning";
import { SlotPicker } from "./slot-picker";
import { useUndoable } from "./use-undoable";

const SHORTCUTS = [0.5, 1, 1.5, 2];
const clamp = (q: number) => Math.min(10, Math.max(0.25, Math.round(q * 4) / 4));

type Step = { kind: "main" } | { kind: "move" | "copy"; date: string; meal: MealType };

/** Everything you can do with a planned food: portion, move, copy, swap and remove. */
export function ItemSheet({ item, onClose, onSwap }: { item: PlanItem | null; onClose: () => void; onSwap?: (item: PlanItem) => void }) {
  const weekStart = usePlan((s) => s.weekStart);
  const { updateItem, removeItem, copyItem } = usePlan();
  const trackMacros = useStore((s) => s.profile?.trackMacros ?? true);
  const undoable = useUndoable();
  const [step, setStep] = useState<Step>({ kind: "main" });

  const close = () => {
    setStep({ kind: "main" });
    onClose();
  };
  if (!item || !weekStart) return <Sheet open={false} onClose={close} title="">{null}</Sheet>;

  const n = itemNutrition(item.food, item.quantity);
  const warning = allergyText(item.food);
  const set = (q: number) => clamp(q) !== item.quantity && updateItem(item.id, { quantity: clamp(q) });
  const where = (d: string, m: MealType) => `${shortDay(d)} ${MEAL_LABEL[m].toLowerCase()}`;

  if (step.kind !== "main") {
    const unchanged = step.date === item.date && step.meal === item.meal;
    const confirm = () => {
      const to = { date: step.date, meal: step.meal };
      if (step.kind === "move") undoable([item.date, to.date], () => updateItem(item.id, to), `Moved ${item.food.name} to ${where(to.date, to.meal)}`);
      else undoable([to.date], () => copyItem(item.id, to), `Copied ${item.food.name} to ${where(to.date, to.meal)}`);
      close();
    };
    return (
      <Sheet
        open
        onClose={close}
        title={step.kind === "move" ? "Move to…" : "Copy to…"}
        description={item.food.name}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setStep({ kind: "main" })}>
              Back
            </Button>
            <Button onClick={confirm} disabled={step.kind === "move" && unchanged}>
              {step.kind === "move" ? "Move" : "Copy"} to {where(step.date, step.meal)}
            </Button>
          </div>
        }
      >
        <SlotPicker weekStart={weekStart} date={step.date} meal={step.meal} onChange={(v) => setStep({ ...step, ...v })} />
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      onClose={close}
      title={item.food.name}
      description={`${MEAL_LABEL[item.meal]} · ${longDay(item.date)}`}
      footer={
        <div className="flex justify-between gap-2">
          <Button
            variant="ghost"
            className="text-danger"
            onClick={() => {
              undoable([item.date], () => removeItem(item.id), `Removed ${item.food.name}`);
              close();
            }}
          >
            <Trash2 className="size-4" /> Remove
          </Button>
          <Button onClick={close}>Done</Button>
        </div>
      }
    >
      <div className="space-y-5">
        {warning && (
          <p className="flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-2.5 text-sm font-medium text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            {warning}, which is on your allergy list.
          </p>
        )}
        <div>
          <p id="portion-label" className="text-sm font-medium">
            Portion
          </p>
          <div className="mt-2 flex items-center justify-center gap-4">
            <Button variant="secondary" size="icon" className="size-12 rounded-full" aria-label="Less, by a quarter serving" onClick={() => set(item.quantity - 0.25)} disabled={item.quantity <= 0.25}>
              <Minus className="size-5" />
            </Button>
            <output aria-labelledby="portion-label" aria-live="polite" className="min-w-24 text-center">
              <span className="block text-3xl font-bold tabular">{formatQuantity(item.quantity)}</span>
              <span className="block text-xs text-muted">× {item.food.serving}</span>
            </output>
            <Button variant="secondary" size="icon" className="size-12 rounded-full" aria-label="More, by a quarter serving" onClick={() => set(item.quantity + 0.25)} disabled={item.quantity >= 10}>
              <Plus className="size-5" />
            </Button>
          </div>
          <div role="group" aria-label="Quick portions" className="mt-3 flex justify-center gap-2">
            {SHORTCUTS.map((q) => (
              <button
                key={q}
                type="button"
                aria-pressed={item.quantity === q}
                onClick={() => set(q)}
                className={clsx(
                  "h-9 min-w-12 rounded-full border px-3 text-sm font-medium transition",
                  item.quantity === q ? "border-brand bg-brand-soft text-brand-strong" : "border-border hover:border-brand/50",
                )}
              >
                {formatQuantity(q)}
              </button>
            ))}
          </div>
        </div>

        <dl className="grid grid-cols-4 gap-2 rounded-xl bg-surface-2 p-3 text-center" aria-live="polite">
          <div className={clsx(!trackMacros && "col-span-4")}>
            <dt className="text-xs text-muted">Calories</dt>
            <dd className="text-lg font-semibold tabular">{Math.round(n.calories)}</dd>
          </div>
          {trackMacros &&
            (["protein", "carbs", "fat"] as const).map((k) => (
              <div key={k}>
                <dt className="text-xs capitalize text-muted">{k}</dt>
                <dd className="text-lg font-semibold tabular">{n[k]} g</dd>
              </div>
            ))}
        </dl>

        <div className={clsx("grid gap-2", onSwap ? "grid-cols-3" : "grid-cols-2")}>
          <Button variant="outline" onClick={() => setStep({ kind: "move", date: item.date, meal: item.meal })}>
            <MoveRight className="size-4" /> Move to…
          </Button>
          <Button variant="outline" onClick={() => setStep({ kind: "copy", date: item.date, meal: item.meal })}>
            <Copy className="size-4" /> Copy to…
          </Button>
          {onSwap && (
            <Button variant="outline" onClick={() => (close(), onSwap(item))}>
              <ArrowRightLeft className="size-4" /> Swap
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
