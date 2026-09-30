"use client";

import clsx from "clsx";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Chip, Field, Input, Segmented, Sheet } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, type PlanTemplate } from "@/lib/api";
import { PLAN_MEALS } from "@/lib/plan-math";
import { usePlan } from "@/lib/plan-store";
import { DIET_LABEL } from "@/lib/types";
import { MEAL_LABEL } from "@/lib/ui";
import { weekDates, weekLabel } from "@/lib/week";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** A name for the week on screen, e.g. "Veg week · 1,850 avg" or "Week of 5 – 11 Oct". */
function suggestName(templates: PlanTemplate[], weekStart: string, avg: number, diets: Set<string>) {
  const base =
    diets.size === 1 && avg
      ? `${DIET_LABEL[[...diets][0] as keyof typeof DIET_LABEL]} week · ${Math.round(avg).toLocaleString()} avg`
      : `Week of ${weekLabel(weekStart)}`;
  const taken = new Set(templates.map((t) => t.name.toLowerCase()));
  for (let n = 1; ; n++) {
    const name = n === 1 ? base : `${base} (${n})`;
    if (!taken.has(name.toLowerCase())) return name;
  }
}

/** Seven small columns, one per day, filled per planned meal: a glance at the template's shape. */
function MiniPreview({ t }: { t: PlanTemplate }) {
  return (
    <div className="grid grid-cols-7 gap-1" aria-hidden>
      {t.days.map((d) => (
        <div key={d.offset} className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] text-subtle">{WEEKDAYS[d.offset]}</span>
          {PLAN_MEALS.map((m) => (
            <span key={m} className={clsx("h-1.5 w-full rounded-full", d.meals[m].length ? "bg-brand/70" : "bg-surface-2")} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Save the week as a template, and apply (Replace or Fill empty meals) or delete saved ones. */
export function TemplatesSheet({ open, onClose, templates, onChanged }: { open: boolean; onClose: () => void; templates: PlanTemplate[]; onChanged: () => void }) {
  const toast = useToast();
  const { weekStart, plan, applyTemplate, snapshotDays, restoreDays } = usePlan();
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState<{ id: string; mode: "replace" | "fill" } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  if (!weekStart || !plan) return null;

  const hasFood = plan.items.length > 0;
  const suggested = suggestName(templates, weekStart, plan.week.averageCalories, new Set(plan.items.map((i) => i.food.diet).filter(Boolean) as string[]));
  const value = name ?? suggested;

  const save = async () => {
    setSaving(true);
    try {
      await api.saveTemplate(value.trim(), weekStart);
      toast(`Saved "${value.trim()}"`);
      setName(null);
      onChanged();
    } catch (e) {
      toast(e instanceof ApiError ? (e.problem.errors?.[0]?.detail ?? e.problem.title) : "Couldn't save the template.", { tone: "error" });
    }
    setSaving(false);
  };
  // Undo is offered only once the template is actually applied.
  const apply = async (t: PlanTemplate, mode: "replace" | "fill") => {
    const before = snapshotDays(weekDates(weekStart));
    setApplying(null);
    onClose();
    if (await applyTemplate(t.id, mode)) {
      toast(mode === "replace" ? `Applied "${t.name}" to this week` : `Filled empty meals from "${t.name}"`, { tone: "info", action: { label: "Undo", onClick: () => restoreDays(before) } });
    }
  };
  const draft = plan.status === "draft";
  const remove = async (t: PlanTemplate) => {
    try {
      await api.deleteTemplate(t.id);
      toast(`Deleted "${t.name}"`, { tone: "info" });
      onChanged();
    } catch (e) {
      toast(e instanceof ApiError ? e.problem.title : "Couldn't delete the template.", { tone: "error" });
    }
    setDeleting(null);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Templates" description="Save a good week and reuse it.">
      <div className="space-y-5">
        <form
          className="rounded-xl bg-surface-2 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="flex items-end gap-2">
            <Field label="Save this week as" htmlFor="template-name" className="flex-1" hint={hasFood ? undefined : "Plan something this week to save it."}>
              <Input id="template-name" value={value} maxLength={60} disabled={!hasFood} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Button type="submit" disabled={!hasFood || saving || !value.trim()}>
              Save
            </Button>
          </div>
        </form>

        {draft && templates.length > 0 && <p className="text-sm text-muted">Keep or discard this week&apos;s draft before applying a template.</p>}
        {templates.length === 0 ? (
          <p className="text-center text-sm text-muted">No templates yet.</p>
        ) : (
          <ul className="space-y-3" aria-label="Your templates">
            {templates.map((t) => (
              <li key={t.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{t.name}</p>
                    <p className="mt-0.5 text-xs tabular text-muted">
                      {t.averageCalories.toLocaleString()} kcal/day avg · {t.plannedDays} {t.plannedDays === 1 ? "day" : "days"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {t.dietTags.map((d) => (
                        <Chip key={d}>{DIET_LABEL[d]}</Chip>
                      ))}
                    </div>
                  </div>
                  <div className="w-32 shrink-0">
                    <MiniPreview t={t} />
                    <p className="sr-only">
                      {t.days
                        .filter((d) => PLAN_MEALS.some((m) => d.meals[m].length))
                        .map((d) => `${WEEKDAY_NAMES[d.offset]}: ${PLAN_MEALS.filter((m) => d.meals[m].length).map((m) => MEAL_LABEL[m].toLowerCase()).join(", ")}`)
                        .join(". ")}
                    </p>
                  </div>
                </div>

                {applying?.id === t.id ? (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    <Segmented
                      label={`How to apply ${t.name}`}
                      value={applying.mode}
                      onChange={(mode) => setApplying({ id: t.id, mode })}
                      className="w-full"
                      size="sm"
                      options={[
                        { value: "replace", label: "Replace the week" },
                        { value: "fill", label: "Fill empty meals" },
                      ]}
                    />
                    <p className="text-xs text-muted">{applying.mode === "replace" ? "Everything planned this week is replaced." : "Meals you've already planned stay as they are."}</p>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setApplying(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => apply(t, applying.mode)}>
                        Apply to this week
                      </Button>
                    </div>
                  </div>
                ) : deleting === t.id ? (
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                    <p className="text-sm">Delete &ldquo;{t.name}&rdquo;?</p>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>
                        Cancel
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => remove(t)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex justify-end gap-1">
                    <Button variant="ghost" size="sm" aria-label={`Delete ${t.name}`} onClick={() => setDeleting(t.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={draft} onClick={() => setApplying({ id: t.id, mode: hasFood ? "fill" : "replace" })} aria-label={`Apply ${t.name}`}>
                      Apply
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
