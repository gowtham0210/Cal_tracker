"use client";

import clsx from "clsx";
import { BatteryFull, BatteryLow, BatteryMedium, Check, Moon, NotebookPen } from "lucide-react";
import { useRef, useState } from "react";
import { DayNav } from "@/components/day-nav";
import { Card, CardHeader, PageHeader, Textarea } from "@/components/ui";
import { MOODS, MoodPicker } from "@/components/widgets";
import { lastNDays, relativeDay, todayKey } from "@/lib/date";
import { useStore } from "@/lib/store";
import type { JournalEntry } from "@/lib/types";

const ENERGY = [
  { value: 1 as const, label: "Low", icon: BatteryLow },
  { value: 2 as const, label: "Okay", icon: BatteryMedium },
  { value: 3 as const, label: "High", icon: BatteryFull },
];
const CRAVINGS = ["None", "Mild", "Strong", "Intense"];

function Choice<T extends number>({
  value,
  options,
  onChange,
  label,
}: {
  value?: T;
  options: { value: T; label: string; icon?: typeof Moon }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            "flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-sm font-medium transition",
            value === o.value ? "border-brand bg-brand-soft text-brand-strong" : "border-border text-muted hover:bg-surface-2",
          )}
        >
          {o.icon && <o.icon className="size-4" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function JournalView() {
  const [date, setDate] = useState(todayKey());
  const journal = useStore((s) => s.journal);

  const recent = lastNDays(14)
    .reverse()
    .map((d) => journal[d])
    .filter((j): j is JournalEntry => !!j && (!!j.note || !!j.mood));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Journal"
        subtitle="A 20-second check-in helps you spot what drives cravings and energy."
        action={<DayNav date={date} onChange={setDate} />}
      />

      <div className="grid gap-5 lg:grid-cols-5">
        <CheckIn key={date} date={date} />
        <Card className="lg:col-span-2">
          <CardHeader icon={<NotebookPen className="size-4" />} title="Recent entries" subtitle="Last 14 days" />
          {recent.length ? (
            <ul className="space-y-3">
              {recent.map((j) => (
                <li key={j.date}>
                  <button
                    onClick={() => setDate(j.date)}
                    className={clsx(
                      "w-full rounded-xl border p-3 text-left transition hover:bg-surface-2",
                      j.date === date ? "border-brand" : "border-border",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{relativeDay(j.date)}</span>
                      <span className="flex items-center gap-2 text-xs text-muted">
                        {j.sleepHours && (
                          <span className="tabular">
                            <Moon className="mr-0.5 inline size-3" />
                            {j.sleepHours}h
                          </span>
                        )}
                        {j.mood && (
                          <span className="text-lg" aria-label={MOODS[j.mood - 1].label}>
                            {MOODS[j.mood - 1].emoji}
                          </span>
                        )}
                      </span>
                    </div>
                    {j.note && <p className="mt-1 line-clamp-2 text-sm text-muted">{j.note}</p>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No entries yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function CheckIn({ date }: { date: string }) {
  const entry = useStore((s) => s.journal[date]);
  const saveJournal = useStore((s) => s.saveJournal);
  const [note, setNote] = useState(entry?.note ?? "");
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const save = (patch: Partial<JournalEntry>) => {
    saveJournal({ date, ...patch });
    setSaved(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(false), 1500);
  };

  // Autosave notes while typing (debounced)
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onNote = (v: string) => {
    setNote(v);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => save({ note: v }), 500);
  };

  const sleep = entry?.sleepHours ?? 7;

  return (
    <Card className="space-y-6 lg:col-span-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Check-in · {relativeDay(date)}</h2>
        <span
          aria-live="polite"
          className={clsx("flex items-center gap-1 text-xs text-brand transition-opacity", saved ? "opacity-100" : "opacity-0")}
        >
          <Check className="size-3.5" /> Saved
        </span>
      </div>

      <section>
        <h3 className="mb-2 text-[13px] font-medium text-muted">Mood</h3>
        <MoodPicker date={date} size="lg" />
      </section>

      <section>
        <h3 className="mb-2 text-[13px] font-medium text-muted">Energy</h3>
        <Choice label="Energy" value={entry?.energy} options={ENERGY} onChange={(v) => save({ energy: v })} />
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <label htmlFor="sleep" className="text-[13px] font-medium text-muted">
            Sleep
          </label>
          <span className="tabular text-sm font-semibold">
            <Moon className="mr-1 inline size-3.5 text-protein" />
            {sleep} h
          </span>
        </div>
        <input
          id="sleep"
          type="range"
          min={3}
          max={12}
          step={0.5}
          value={sleep}
          onChange={(e) => save({ sleepHours: Number(e.target.value) })}
          className="w-full accent-[var(--brand)]"
        />
        <div className="mt-1 flex justify-between text-[10px] text-subtle" aria-hidden>
          <span>3h</span>
          <span>7–9h recommended</span>
          <span>12h</span>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[13px] font-medium text-muted">Cravings</h3>
        <Choice
          label="Cravings"
          value={entry?.cravings}
          options={CRAVINGS.map((l, i) => ({ value: i as 0 | 1 | 2 | 3, label: l }))}
          onChange={(v) => save({ cravings: v })}
        />
      </section>

      <section>
        <label htmlFor="note" className="mb-2 block text-[13px] font-medium text-muted">
          Notes
        </label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => onNote(e.target.value)}
          placeholder="What went well? What was hard? Anything that triggered cravings?"
          rows={4}
        />
      </section>
    </Card>
  );
}
