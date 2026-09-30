"use client";

import { Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { MealPlan } from "@/lib/api";
import { usePlan } from "@/lib/plan-store";

const yours = (s: string) => s === "logged" || s === "favorite";
const names = (foods: Map<string, string>) => [...foods.values()].sort((a, b) => a.localeCompare(b));

/** While a draft is being made or waiting for a decision: where it came from, and Keep, Regenerate or Discard. */
export function DraftBanner({ plan, onRegenerate }: { plan: MealPlan; onRegenerate: () => void }) {
  const toast = useToast();
  const { generating, keepDraft, discardDraft } = usePlan();
  const busy = generating?.weekStart === plan.weekStart ? generating : null;
  if (!busy && plan.status !== "draft") return null;

  const own = new Map<string, string>();
  const others = new Map<string, string>();
  for (const i of plan.items) (yours(i.food.source) || i.food.useCount > 0 ? own : others).set(i.food.id, i.food.name);
  const count = own.size + others.size;
  const rules = plan.source === "rules";
  const off = plan.days.filter((d) => d.status.state === "under" || d.status.state === "over").length;
  const target = off === 0 ? "Every planned day is within your calorie target." : `${off} ${off === 1 ? "day is" : "days are"} off target; adjust portions or regenerate.`;

  return (
    <Card aria-label="Draft plan" className="border-brand/40 bg-brand-soft/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-64 gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
            {busy ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden /> : <Sparkles className="size-5" aria-hidden />}
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold">Draft plan</h2>
            <p role="status" className="mt-0.5 text-sm text-muted">
              {busy
                ? busy.dates.length === 1
                  ? "Planning the day…"
                  : `Planning your week… ${busy.done.length} of ${busy.dates.length} days`
                : `${rules ? "Built from your usual foods by simple rules where the AI wasn't available." : "Planned by AI from your food library."} ${target} Edit anything, then keep or discard it.`}
            </p>
            {!busy && count > 0 && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer font-medium text-brand-strong">
                  Built from {count} foods{own.size ? ` (${own.size} of yours)` : ""}
                </summary>
                <dl className="mt-2 space-y-1.5">
                  {own.size > 0 && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Your foods</dt>
                      <dd>{names(own).join(", ")}</dd>
                    </div>
                  )}
                  {others.size > 0 && (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Suggested dishes</dt>
                      <dd>{names(others).join(", ")}</dd>
                    </div>
                  )}
                </dl>
              </details>
            )}
          </div>
        </div>
        {!busy && (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                await keepDraft();
                toast("Plan kept");
              }}
            >
              Keep
            </Button>
            <Button variant="outline" onClick={onRegenerate}>
              <RotateCcw className="size-4" /> Regenerate
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                await discardDraft();
                toast("Draft discarded", { tone: "info" });
              }}
            >
              Discard
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
