"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, relativeDay, todayKey } from "@/lib/date";
import { Button } from "./ui";

export function DayNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const today = todayKey();
  const isToday = date === today;
  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1 shadow-card">
      <Button variant="ghost" size="icon" className="size-9" aria-label="Previous day" onClick={() => onChange(addDays(date, -1))}>
        <ChevronLeft className="size-4" />
      </Button>
      <label className="relative min-w-32 cursor-pointer text-center text-sm font-semibold">
        <span aria-live="polite">{relativeDay(date)}</span>
        <input
          type="date"
          aria-label="Choose date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <Button
        variant="ghost"
        size="icon"
        className="size-9"
        aria-label="Next day"
        disabled={isToday}
        onClick={() => onChange(addDays(date, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
      {!isToday && (
        <Button variant="secondary" size="sm" className="h-8" onClick={() => onChange(today)}>
          Today
        </Button>
      )}
    </div>
  );
}
