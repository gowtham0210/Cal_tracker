"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Sheet, Skeleton } from "@/components/ui";
import { api, ApiError, type PlanItem, type PlanSwap } from "@/lib/api";
import { formatQuantity } from "@/lib/plan-math";
import { usePlan } from "@/lib/plan-store";
import { useUndoable } from "./use-undoable";

const signed = (n: number, unit: string) => (n === 0 ? `same ${unit === "kcal" ? "calories" : "protein"}` : `${n > 0 ? "+" : "−"}${Math.abs(Math.round(n))} ${unit}`);

/** Similar foods for a planned one, portioned to about the same calories. Choosing one swaps it in, with Undo. */
export function SwapSheet({ item, onClose }: { item: PlanItem | null; onClose: () => void }) {
  const weekStart = usePlan((s) => s.weekStart);
  const updateItem = usePlan((s) => s.updateItem);
  const undoable = useUndoable();
  const [result, setResult] = useState<{ for: string; source: "ai" | "rules"; data: PlanSwap[] } | { for: string; error: string } | null>(null);

  // Fetched once per planned food and portion (a swap keeps the item's id but changes its food).
  const saving = !!item?.id.startsWith("tmp-");
  const key = item && !saving ? `${item.id}|${item.food.id}|${item.quantity}` : null;
  const itemId = item?.id;
  useEffect(() => {
    if (!key || !itemId || !weekStart) return;
    let live = true;
    api
      .planSwaps(weekStart, itemId)
      .then((r) => live && setResult({ for: key, ...r }))
      .catch((e) => live && setResult({ for: key, error: e instanceof ApiError ? e.problem.title : "Couldn't find alternatives." }));
    return () => {
      live = false;
    };
  }, [key, itemId, weekStart]);

  if (!item) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;
  const current = saving ? { for: "", error: "This food is still saving. Try again in a moment." } : result?.for === key ? result : null;

  const choose = (s: PlanSwap) => {
    undoable([item.date], () => updateItem(item.id, { foodId: s.food.id, quantity: s.quantity }, s.food), `Swapped ${item.food.name} for ${s.food.name}`);
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={`Swap ${item.food.name}`} description={`${Math.round(item.calories)} kcal · similar foods from your library, portioned to match`}>
      <div aria-live="polite" aria-busy={!current}>
        {!current ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : "error" in current ? (
          <p role="alert" className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
            {current.error}
          </p>
        ) : current.data.length === 0 ? (
          <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">No similar foods in your library fit this portion yet.</p>
        ) : (
          <>
            <p className="mb-2 flex items-center gap-1.5 text-xs text-muted">
              {current.source === "ai" && <Sparkles className="size-3.5" aria-hidden />}
              {current.source === "ai" ? "Similar foods from your library, picked by AI" : "Similar foods from your library"}
            </p>
            <ul className="space-y-2">
              {current.data.map((s) => (
                <li key={s.food.id}>
                  <button
                    type="button"
                    data-food-name={s.food.name}
                    onClick={() => choose(s)}
                    className="w-full rounded-xl border border-border bg-surface p-3 text-left transition hover:border-brand/60"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{s.food.name}</span>
                        <span className="mt-0.5 block text-xs text-muted">{s.reason}</span>
                      </span>
                      <span className="shrink-0 text-right text-xs tabular">
                        <span className="block font-semibold">{Math.round(s.calories)} kcal</span>
                        <span className="block text-muted">{formatQuantity(s.quantity)} × {s.food.serving}</span>
                      </span>
                    </span>
                    <span className="mt-2 flex gap-3 text-xs tabular text-muted">
                      <span>{signed(s.calorieDifference, "kcal")}</span>
                      <span>{signed(s.proteinDifference, "g protein")}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Keep {item.food.name.length > 24 ? "the original" : item.food.name}
        </Button>
      </div>
    </Sheet>
  );
}
