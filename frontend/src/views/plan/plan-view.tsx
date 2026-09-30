"use client";

import clsx from "clsx";
import { BookOpen, Check, ChevronLeft, ChevronRight, Copy, Eraser, Loader2, PanelLeftClose, PencilLine, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, PageHeader, Sheet, Skeleton } from "@/components/ui";
import type { MenuItem } from "@/components/ui/menu";
import type { PlanItem } from "@/lib/api";
import { addDays, todayKey } from "@/lib/date";
import { usePlan } from "@/lib/plan-store";
import { useMediaQuery } from "@/lib/use-media-query";
import { longDay, mondayOf, weekLabel } from "@/lib/week";
import { AddFoodSheet, type SlotTarget } from "./add-food-sheet";
import { CopyDaySheet } from "./copy-day-sheet";
import { DayView } from "./day-view";
import { DraftBanner } from "./draft-banner";
import { FoodLibrary } from "./food-library";
import { GenerateSheet } from "./generate-sheet";
import { ItemSheet } from "./item-sheet";
import { SwapSheet } from "./swap-sheet";
import { DraggableFood, PlanDnd } from "./plan-dnd";
import { useUndoable } from "./use-undoable";
import { WeekGrid } from "./week-grid";
import { WeekSummary } from "./week-summary";

function WeekSwitcher({ monday, onChange }: { monday: string; onChange: (m: string) => void }) {
  const current = mondayOf(todayKey());
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" aria-label="Previous week" onClick={() => onChange(addDays(monday, -7))}>
        <ChevronLeft className="size-5" />
      </Button>
      <p className="min-w-36 text-center text-sm font-semibold tabular" aria-live="polite">
        <span className="sr-only">Week of </span>
        {weekLabel(monday)}
      </p>
      <Button variant="ghost" size="icon" aria-label="Next week" onClick={() => onChange(addDays(monday, 7))}>
        <ChevronRight className="size-5" />
      </Button>
      {monday !== current && (
        <Button variant="outline" size="sm" onClick={() => onChange(current)}>
          This week
        </Button>
      )}
    </div>
  );
}

function SaveState() {
  const pending = usePlan((s) => s.pending);
  const touched = usePlan((s) => s.touched);
  if (!touched) return null;
  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-xs">
      {pending > 0 ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5 text-brand" aria-hidden />}
      {pending > 0 ? "Saving…" : "Saved"}
    </span>
  );
}

function StartCards({ onBuild, onGenerate }: { onBuild: () => void; onGenerate: () => void }) {
  return (
    <Card>
      <h2 className="font-semibold">This week is empty</h2>
      <p className="mt-1 text-sm text-muted">How would you like to start?</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <button
          type="button"
          onClick={onGenerate}
          className="flex flex-col items-start gap-2 rounded-2xl border border-brand/40 bg-brand-soft/40 p-5 text-left transition hover:border-brand"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-strong">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <span className="font-semibold">Generate with AI</span>
          <span className="text-sm text-muted">A draft week from your usual foods and calorie goal, ready in moments.</span>
        </button>
        <button
          type="button"
          onClick={onBuild}
          className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-surface p-5 text-left transition hover:border-brand/60"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-muted">
            <PencilLine className="size-5" aria-hidden />
          </span>
          <span className="font-semibold">Build my own</span>
          <span className="text-sm text-muted">Add foods to each meal yourself. Totals update as you go.</span>
        </button>
      </div>
    </Card>
  );
}

export function PlanView() {
  const [monday, setMonday] = useState(() => mondayOf(todayKey()));
  const [day, setDay] = useState(() => todayKey());
  const [building, setBuilding] = useState<Record<string, boolean>>({});
  const [portionFor, setPortionFor] = useState<string | null>(null);
  const [addTo, setAddTo] = useState<SlotTarget | null>(null);
  const [librarySheet, setLibrarySheet] = useState(false);
  const [copyFrom, setCopyFrom] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const undoable = useUndoable();
  const setDayItems = usePlan((s) => s.setDay);
  const wide = useMediaQuery("(min-width: 1024px)");
  const roomy = useMediaQuery("(min-width: 1536px)");
  const [libraryPanel, setLibraryPanel] = useState<boolean | null>(null);
  const showPanel = wide && (libraryPanel ?? roomy);

  const { plan, loading, error, load, generating, lastGenerate, generate } = usePlan();
  useEffect(() => void load(monday), [monday, load]);
  // Once a week has had food in it, keep showing the planner even if it's cleared, so the user
  // keeps their place (and the Undo toast still makes sense).
  const hasItems = !!plan && plan.weekStart === monday && plan.items.length > 0;
  useEffect(() => {
    // Syncing from the server's plan into local UI state; runs at most once per week.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hasItems) setBuilding((b) => (b[monday] ? b : { ...b, [monday]: true }));
  }, [hasItems, monday]);

  const changeWeek = (m: string) => {
    setMonday(m);
    // Keep the same weekday when moving between weeks on the day view.
    const offset = Math.round((Date.parse(day) - Date.parse(mondayOf(day))) / 86_400_000);
    setDay(addDays(m, Math.min(6, Math.max(0, offset))));
  };

  const portionItem: PlanItem | null = plan?.items.find((i) => i.id === portionFor) ?? null;
  const dayActions = (date: string): MenuItem[] => {
    const hasFood = plan?.items.some((i) => i.date === date) ?? false;
    return [
      { label: "Copy day to…", icon: <Copy className="size-4" />, onSelect: () => setCopyFrom(date), disabled: !hasFood },
      { label: "Clear day", icon: <Eraser className="size-4" />, danger: true, disabled: !hasFood, onSelect: () => undoable([date], () => setDayItems(date, []), `Cleared ${longDay(date)}`) },
    ];
  };
  const empty = plan && plan.items.length === 0 && !building[monday] && generating?.weekStart !== monday;
  const regenerate = () => (lastGenerate ? void generate(lastGenerate) : setGenerateOpen(true));

  return (
    <PlanDnd>
      <div className={clsx(showPanel && "lg:flex lg:gap-6")}>
        {showPanel && (
          <aside aria-label="Food library" className="sticky top-8 flex h-[calc(100dvh-4rem)] w-72 shrink-0 flex-col">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Food library</h2>
              <Button variant="ghost" size="icon" aria-label="Hide food library" onClick={() => setLibraryPanel(false)}>
                <PanelLeftClose className="size-4" />
              </Button>
            </div>
            <FoodLibrary className="flex-1" wrapCard={(food, card) => <DraggableFood food={food}>{card}</DraggableFood>} />
          </aside>
        )}

        <div className="min-w-0 flex-1 space-y-4">
          <PageHeader
            title="Plan"
            subtitle={<SaveState />}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <WeekSwitcher monday={monday} onChange={changeWeek} />
              {!empty && (
                <Button variant="outline" onClick={() => setGenerateOpen(true)} disabled={!!generating}>
                  <Sparkles className="size-4" /> Generate
                </Button>
              )}
                {!showPanel && (
                  <Button variant="outline" aria-expanded={false} onClick={() => (wide ? setLibraryPanel(true) : setLibrarySheet(true))}>
                    <BookOpen className="size-4" /> Food library
                  </Button>
                )}
              </div>
            }
          />

          {error ? (
            <Card role="alert">
              <p className="font-medium">Couldn&apos;t load this week</p>
              <p className="mt-1 text-sm text-muted">{error}</p>
              <Button className="mt-3" onClick={() => void load(monday)}>
                Try again
              </Button>
            </Card>
          ) : loading || !plan ? (
            <div aria-busy="true" aria-label="Loading your plan" className="space-y-3">
              <Skeleton className="h-12" />
              <Skeleton className="h-96" />
            </div>
          ) : empty ? (
            <StartCards onBuild={() => setBuilding((b) => ({ ...b, [monday]: true }))} onGenerate={() => setGenerateOpen(true)} />
          ) : (
            <>
              <DraftBanner plan={plan} onRegenerate={regenerate} />
            <WeekSummary plan={plan} />
              {wide ? (
                <WeekGrid plan={plan} onOpen={(i) => setPortionFor(i.id)} onAdd={setAddTo} dayActions={dayActions} />
              ) : (
                <DayView plan={plan} day={day} onDay={setDay} onOpen={(i) => setPortionFor(i.id)} onAdd={setAddTo} dayActions={dayActions} />
              )}
            </>
          )}
        </div>

        <Sheet open={librarySheet} onClose={() => setLibrarySheet(false)} title="Food library">
          <FoodLibrary className="h-[60dvh]" />
        </Sheet>
        <AddFoodSheet target={addTo} onClose={() => setAddTo(null)} />
        <ItemSheet item={portionItem} onClose={() => setPortionFor(null)} onSwap={(i) => setSwapFor(i.id)} />
        <SwapSheet item={plan?.items.find((i) => i.id === swapFor) ?? null} onClose={() => setSwapFor(null)} />
        <CopyDaySheet from={copyFrom} onClose={() => setCopyFrom(null)} />
        <GenerateSheet open={generateOpen} onClose={() => setGenerateOpen(false)} defaultDay={day} />
      </div>
    </PlanDnd>
  );
}
