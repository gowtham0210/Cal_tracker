"use client";

import { BookOpen, ChevronLeft, ChevronRight, PencilLine } from "lucide-react";
import { useState } from "react";
import { Button, Card, PageHeader, Sheet } from "@/components/ui";
import { todayKey, addDays } from "@/lib/date";
import { mondayOf, weekLabel } from "@/lib/week";
import { FoodLibrary } from "./food-library";

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

function StartCards({ onBuild }: { onBuild: () => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <button
        type="button"
        onClick={onBuild}
        className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-surface p-5 text-left shadow-card transition hover:border-brand/60 focus-visible:border-brand"
      >
        <span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-muted">
          <PencilLine className="size-5" />
        </span>
        <span className="font-semibold">Build my own</span>
        <span className="text-sm text-muted">Add foods to each meal yourself. Totals update as you go.</span>
      </button>
    </div>
  );
}

export function PlanView() {
  const [monday, setMonday] = useState(() => mondayOf(todayKey()));
  const [libraryOpen, setLibraryOpen] = useState(false);

  return (
    <div className="lg:flex lg:gap-6">
      {/* Desktop: the library sits on the left, where the eye starts and drags are shortest. */}
      <aside aria-label="Food library" className="sticky top-8 hidden h-[calc(100dvh-4rem)] w-72 shrink-0 lg:flex lg:flex-col">
        <h2 className="mb-3 text-[15px] font-semibold">Food library</h2>
        <FoodLibrary className="flex-1" />
      </aside>

      <div className="min-w-0 flex-1">
        <PageHeader
          title="Plan"
          subtitle="Plan your meals for the week"
          action={
            <div className="flex items-center gap-2">
              <WeekSwitcher monday={monday} onChange={setMonday} />
              <Button variant="outline" className="lg:hidden" onClick={() => setLibraryOpen(true)}>
                <BookOpen className="size-4" /> Food library
              </Button>
            </div>
          }
        />
        <Card>
          <p className="mb-4 text-sm text-muted">This week is empty. How would you like to start?</p>
          <StartCards onBuild={() => {}} />
        </Card>
      </div>

      <Sheet open={libraryOpen} onClose={() => setLibraryOpen(false)} title="Food library">
        <FoodLibrary className="h-[60dvh]" />
      </Sheet>
    </div>
  );
}
