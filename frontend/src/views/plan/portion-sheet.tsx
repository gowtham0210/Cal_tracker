"use client";

import clsx from "clsx";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button, Sheet } from "@/components/ui";
import type { PlanItem } from "@/lib/api";
import { formatQuantity, itemNutrition } from "@/lib/plan-math";
import { usePlan } from "@/lib/plan-store";
import { useStore } from "@/lib/store";
import { MEAL_LABEL } from "@/lib/ui";
import { longDay } from "@/lib/week";

const SHORTCUTS = [0.5, 1, 1.5, 2];
const clamp = (q: number) => Math.min(10, Math.max(0.25, Math.round(q * 4) / 4));

/** Adjust a planned food's portion; the numbers recalculate as you tap and save immediately. */
export function PortionSheet({ item, onClose }: { item: PlanItem | null; onClose: () => void }) {
  const updateItem = usePlan((s) => s.updateItem);
  const removeItem = usePlan((s) => s.removeItem);
  const trackMacros = useStore((s) => s.profile?.trackMacros ?? true);
  if (!item) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;

  const n = itemNutrition(item.food, item.quantity);
  const set = (q: number) => clamp(q) !== item.quantity && updateItem(item.id, { quantity: clamp(q) });

  return (
    <Sheet
      open
      onClose={onClose}
      title={item.food.name}
      description={`${MEAL_LABEL[item.meal]} · ${longDay(item.date)}`}
      footer={
        <div className="flex justify-between gap-2">
          <Button variant="ghost" className="text-danger" onClick={() => (removeItem(item.id), onClose())}>
            <Trash2 className="size-4" /> Remove
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      }
    >
      <div className="space-y-5">
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
      </div>
    </Sheet>
  );
}
