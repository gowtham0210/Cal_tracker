"use client";

import clsx from "clsx";
import { Droplet, Minus, Plus, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { aiSuggestMeals } from "@/lib/ai";
import { dayTotals, fmtInt } from "@/lib/calc";
import type { MealIdea } from "@/lib/foods";
import { useStore } from "@/lib/store";
import type { Mood } from "@/lib/types";
import { MEAL_LABEL } from "@/lib/ui";
import { Button, Card, CardHeader, ProgressBar, Ring, Skeleton } from "./ui";
import { useToast } from "./ui/toast";

/* ---------------- Calorie ring summary ---------------- */
export function CalorieSummary({ date }: { date: string }) {
  const foods = useStore((s) => s.foods);
  const exercises = useStore((s) => s.exercises);
  const goal = useStore((s) => s.profile.calorieGoal);
  const t = dayTotals(date, foods, exercises);
  const remaining = goal - t.net;
  const over = remaining < 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
      <Ring value={t.net} max={goal} size={188} stroke={16} label={`${Math.abs(remaining)} calories ${over ? "over" : "remaining"}`}>
        <div>
          <p className={clsx("tabular text-4xl font-bold tracking-tight", over && "text-danger")}>{fmtInt(Math.abs(remaining))}</p>
          <p className="text-sm text-muted">{over ? "kcal over" : "kcal left"}</p>
        </div>
      </Ring>
      <dl className="grid w-full flex-1 grid-cols-3 gap-2 sm:grid-cols-1 sm:gap-3">
        {[
          { label: "Goal", value: goal, sign: "", color: "var(--subtle)" },
          { label: "Food", value: t.calories, sign: "−", color: "var(--brand)" },
          { label: "Exercise", value: t.burned, sign: "+", color: "var(--burn)" },
        ].map((r) => (
          <div
            key={r.label}
            className="flex flex-col items-center rounded-xl bg-surface-2 px-2 py-2.5 sm:flex-row sm:justify-between sm:px-3.5"
          >
            <dt className="flex items-center gap-2 text-xs text-muted sm:text-sm">
              <span className="size-2 rounded-full" style={{ background: r.color }} aria-hidden />
              {r.label}
            </dt>
            <dd className="tabular font-semibold">
              <span className="text-subtle">{r.sign}</span>
              {fmtInt(r.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ---------------- Macros ---------------- */
export function MacroBars({ date, compact }: { date: string; compact?: boolean }) {
  const foods = useStore((s) => s.foods);
  const exercises = useStore((s) => s.exercises);
  const goals = useStore((s) => s.profile.macroGoals);
  const t = dayTotals(date, foods, exercises);
  const rows = [
    { key: "protein", label: "Protein", color: "var(--protein)" },
    { key: "carbs", label: "Carbs", color: "var(--carbs)" },
    { key: "fat", label: "Fat", color: "var(--fat)" },
  ] as const;
  return (
    <div className={clsx("grid gap-4", compact ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-3")}>
      {rows.map((r) => {
        const v = Math.round(t[r.key]);
        const g = goals[r.key];
        return (
          <div key={r.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-muted">{r.label}</span>
              <span className="tabular text-xs text-muted">
                <span className="font-semibold text-text">{v}</span>/{g}g
              </span>
            </div>
            <ProgressBar value={v} max={g} color={r.color} label={`${r.label} ${v} of ${g} grams`} />
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Water ---------------- */
export function WaterTracker({ date }: { date: string }) {
  const glasses = useStore((s) => s.water[date] ?? 0);
  const goal = useStore((s) => s.profile.waterGoal);
  const glassMl = useStore((s) => s.profile.glassMl);
  const setWater = useStore((s) => s.setWater);
  const toast = useToast();
  const [popped, setPopped] = useState<number | null>(null);
  const slots = Math.max(goal, glasses);

  const set = (n: number) => {
    const next = Math.max(0, n);
    setWater(date, next);
    setPopped(next - 1);
    if (next === goal && glasses < goal) toast("💧 Water goal reached — nice!");
  };

  return (
    <Card>
      <CardHeader
        icon={<Droplet className="size-4 text-water" />}
        title="Water"
        subtitle={`${glasses} of ${goal} glasses · ${((glasses * glassMl) / 1000).toFixed(2)} L`}
        action={
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="icon"
              className="size-9 rounded-full"
              aria-label="Remove a glass"
              onClick={() => set(glasses - 1)}
              disabled={!glasses}
            >
              <Minus className="size-4" />
            </Button>
            <Button
              size="icon"
              className="size-9 rounded-full !bg-water !text-white"
              aria-label="Add a glass"
              onClick={() => set(glasses + 1)}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        }
      />
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${Math.min(slots, 10)}, minmax(0, 1fr))` }}
        role="group"
        aria-label="Glasses of water, tap to set"
      >
        {Array.from({ length: slots }).map((_, i) => {
          const filled = i < glasses;
          return (
            <button
              key={i}
              onClick={() => set(filled && i === glasses - 1 ? i : i + 1)}
              aria-label={`${i + 1} glass${i ? "es" : ""}`}
              aria-pressed={filled}
              className={clsx(
                "relative grid h-11 w-full max-w-10 place-items-end justify-self-center overflow-hidden rounded-b-xl rounded-t-md border-2 transition",
                filled ? "border-water" : "border-border hover:border-water/60",
                popped === i && "animate-pop",
              )}
            >
              <span
                className="absolute inset-x-0 bottom-0 bg-water/80 transition-[height] duration-300"
                style={{ height: filled ? "78%" : "0%" }}
              />
            </button>
          );
        })}
      </div>
      <ProgressBar className="mt-4" value={glasses} max={goal} color="var(--water)" label="Water progress" height={6} />
    </Card>
  );
}

/* ---------------- Mood quick pick ---------------- */
export const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 1, emoji: "😣", label: "Rough" },
  { value: 2, emoji: "😕", label: "Meh" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
];

export function MoodPicker({ date, size = "md" }: { date: string; size?: "md" | "lg" }) {
  const mood = useStore((s) => s.journal[date]?.mood);
  const saveJournal = useStore((s) => s.saveJournal);
  return (
    <div role="radiogroup" aria-label="Mood" className="grid grid-cols-5 gap-1.5">
      {MOODS.map((m) => (
        <button
          key={m.value}
          role="radio"
          aria-checked={mood === m.value}
          onClick={() => saveJournal({ date, mood: m.value })}
          className={clsx(
            "flex flex-col items-center gap-1 rounded-xl border py-2 transition",
            mood === m.value ? "border-brand bg-brand-soft" : "border-transparent hover:bg-surface-2",
          )}
        >
          <span className={clsx(size === "lg" ? "text-3xl" : "text-2xl", mood && mood !== m.value && "opacity-40 grayscale")}>
            {m.emoji}
          </span>
          <span className={clsx("text-[11px] font-medium", mood === m.value ? "text-brand-strong" : "text-muted")}>{m.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------------- Smart meal suggestions ---------------- */
export function SuggestionsCard({ date }: { date: string }) {
  const foods = useStore((s) => s.foods);
  const exercises = useStore((s) => s.exercises);
  const profile = useStore((s) => s.profile);
  const addFood = useStore((s) => s.addFood);
  const toast = useToast();
  const t = dayTotals(date, foods, exercises);
  const remaining = Math.round(profile.calorieGoal - t.net);
  const proteinLeft = Math.round(profile.macroGoals.protein - t.protein);
  const [ideas, setIdeas] = useState<MealIdea[] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchIdeas = useCallback(async () => {
    const res = await aiSuggestMeals({ remaining, proteinLeft });
    setIdeas(res);
    setLoading(false);
  }, [remaining, proteinLeft]);

  const load = () => {
    setLoading(true);
    void fetchIdeas();
  };

  useEffect(() => {
    let active = true;
    // Fetch once on mount; the refresh button re-fetches with the latest numbers
    aiSuggestMeals({ remaining, proteinLeft }).then((res) => {
      if (!active) return;
      setIdeas(res);
      setLoading(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardHeader
        icon={<Sparkles className="size-4 text-brand" />}
        title="Smart suggestions"
        subtitle={
          remaining > 0
            ? `Ideas that fit your ${remaining} kcal left${proteinLeft > 20 ? ` and ${proteinLeft} g protein to go` : ""}`
            : "You're at your goal — here are light options if you're hungry"
        }
        action={
          <Button variant="ghost" size="icon" aria-label="Refresh suggestions" onClick={load} disabled={loading}>
            <RefreshCw className={clsx("size-4", loading && "animate-spin")} />
          </Button>
        }
      />
      {loading ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[74px]" />
          ))}
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {ideas?.map((m) => (
            <li key={m.name} className="group flex items-center gap-3 rounded-xl border border-border p-3 transition hover:border-brand/50">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.name}</p>
                <p className="tabular mt-0.5 text-xs text-muted">
                  {m.calories} kcal · {m.protein} g protein
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {m.tags.map((tag) => (
                    <span key={tag} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <Button
                size="icon"
                variant="secondary"
                className="size-9 rounded-full"
                aria-label={`Log ${m.name}`}
                onClick={() => {
                  addFood({
                    date,
                    meal: m.meal,
                    name: m.name,
                    calories: m.calories,
                    protein: m.protein,
                    carbs: m.carbs,
                    fat: m.fat,
                    source: "manual",
                  });
                  toast(`${m.name} added to ${MEAL_LABEL[m.meal]}`);
                }}
              >
                <Plus className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
