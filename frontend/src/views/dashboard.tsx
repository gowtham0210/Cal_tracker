"use client";

import { ArrowRight, Dumbbell, Flame, MessageCircle, Plus, Scale, Sparkles, Target, Utensils } from "lucide-react";
import Link from "next/link";
import { Sparkline } from "@/components/charts";
import { Button, Card, CardHeader, Chip, ProgressBar } from "@/components/ui";
import { CalorieSummary, MacroBars, MoodPicker, SuggestionsCard, WaterTracker } from "@/components/widgets";
import {
  bmi,
  bmiCategory,
  currentStreak,
  dayTotals,
  fmt1,
  goalProgress,
  latestWeight,
  sortedWeights,
  weightOn,
  weightOut,
  wUnit,
} from "@/lib/calc";
import { addDays, formatDate, greeting, lastNDays, todayKey } from "@/lib/date";
import { useStore } from "@/lib/store";
import { MEALS, MEAL_EMOJI, MEAL_LABEL, useUI } from "@/lib/ui";

export function DashboardView() {
  const today = todayKey();
  const profile = useStore((s) => s.profile);
  const foods = useStore((s) => s.foods);
  const weights = useStore((s) => s.weights);
  const exercises = useStore((s) => s.exercises);
  const open = useUI((s) => s.open);
  const u = profile.units;

  const streak = currentStreak(foods);
  const current = latestWeight(weights, profile);
  const weekAgo = weightOn(weights, addDays(today, -7));
  const weekDelta = weekAgo !== undefined ? current - weekAgo : 0;
  const pct = goalProgress(current, profile);
  const b = bmi(current, profile.heightCm);
  const cat = bmiCategory(b);
  const recent = sortedWeights(weights)
    .slice(-21)
    .map((w) => w.weight);
  const loggedToday = foods.some((f) => f.date === today);
  const weighedToday = weights.some((w) => w.date === today);
  const todayEx = exercises.filter((e) => e.date === today);
  const week = lastNDays(7);

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="animate-fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{formatDate(today, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">
            {greeting()}, {profile.name.split(" ")[0]}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 shadow-card"
            title="Consecutive days with food logged"
          >
            <Flame className="size-4 text-burn" />
            <span className="tabular text-sm font-semibold">{streak}</span>
            <span className="text-sm text-muted">day streak</span>
          </div>
        </div>
      </header>

      {/* Nudges: gentle next-best-actions */}
      {(!loggedToday || !weighedToday) && (
        <div className="animate-fade-up flex flex-wrap gap-2">
          {!weighedToday && (
            <button
              onClick={() => open("weight")}
              className="flex items-center gap-2 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted transition hover:border-brand hover:text-text"
            >
              <Scale className="size-4" /> Log today&apos;s weigh-in
            </button>
          )}
          {!loggedToday && (
            <button
              onClick={() => open("food")}
              className="flex items-center gap-2 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted transition hover:border-brand hover:text-text"
            >
              <Utensils className="size-4" /> Log your first meal to keep the streak
            </button>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Calories */}
        <Card className="animate-fade-up lg:col-span-2">
          <CardHeader
            title="Calories today"
            subtitle="Remaining = goal − food + exercise"
            action={
              <Button size="sm" onClick={() => open("food")}>
                <Plus className="size-4" /> Log food
              </Button>
            }
          />
          <CalorieSummary date={today} />
          {profile.trackMacros && (
            <div className="mt-6 border-t border-border pt-5">
              <MacroBars date={today} />
            </div>
          )}
        </Card>

        {/* Weight */}
        <Card className="animate-fade-up flex flex-col">
          <CardHeader
            icon={<Scale className="size-4" />}
            title="Weight"
            subtitle={weighedToday ? "Logged today" : "Not logged today"}
            action={
              <Button size="sm" variant="secondary" onClick={() => open("weight")}>
                Log
              </Button>
            }
          />
          <div className="flex items-end justify-between gap-3">
            <p className="tabular text-4xl font-bold tracking-tight">
              {fmt1(weightOut(current, u))}
              <span className="ml-1 text-base font-normal text-muted">{wUnit(u)}</span>
            </p>
            <Chip tone={weekDelta < 0 ? "good" : weekDelta > 0 ? "warn" : "neutral"}>
              {weekDelta <= 0 ? "▼" : "▲"} {fmt1(Math.abs(weightOut(weekDelta, u)))} this week
            </Chip>
          </div>
          <div className="my-3 flex flex-1 flex-col justify-center">
            <Sparkline data={recent} height={80} />
            <p className="mt-1 text-xs text-subtle">Last {recent.length} weigh-ins</p>
          </div>
          <div className="mt-auto grid grid-cols-2 gap-3 border-t border-border pt-4">
            <div>
              <p className="text-xs text-muted">BMI</p>
              <p className="mt-0.5 flex items-center gap-2 font-semibold">
                <span className="tabular">{b.toFixed(1)}</span>
                <Chip tone={cat.tone}>{cat.label}</Chip>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Total lost</p>
              <p className="tabular mt-0.5 font-semibold">
                {fmt1(weightOut(profile.startWeight - current, u))} {wUnit(u)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Meals */}
        <Card className="animate-fade-up lg:col-span-2">
          <CardHeader
            icon={<Utensils className="size-4" />}
            title="Meals"
            action={
              <Link href="/food" className="flex items-center gap-1 text-sm font-medium text-brand hover:underline">
                Food log <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <ul className="grid gap-2 sm:grid-cols-2">
            {MEALS.map((m) => {
              const items = foods.filter((f) => f.date === today && f.meal === m);
              const kcal = items.reduce((s, f) => s + f.calories, 0);
              return (
                <li key={m} className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
                  <span className="text-2xl" aria-hidden>
                    {MEAL_EMOJI[m]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{MEAL_LABEL[m]}</p>
                    <p className="truncate text-xs text-muted">
                      {items.length ? items.map((i) => i.name).join(", ") : "Nothing logged yet"}
                    </p>
                  </div>
                  {kcal > 0 && <span className="tabular text-sm font-semibold">{kcal}</span>}
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-8 rounded-full"
                    aria-label={`Add to ${MEAL_LABEL[m]}`}
                    onClick={() => open("food", { meal: m })}
                  >
                    <Plus className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="animate-fade-up">
          <WaterTracker date={today} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Goal */}
        <Card className="animate-fade-up">
          <CardHeader
            icon={<Target className="size-4" />}
            title="Goal progress"
            action={
              <Link href="/goals" className="text-sm font-medium text-brand hover:underline">
                Badges
              </Link>
            }
          />
          <p className="tabular text-3xl font-bold tracking-tight">{Math.round(pct)}%</p>
          <p className="mt-0.5 text-sm text-muted">
            {fmt1(weightOut(Math.max(0, current - profile.goalWeight), u))} {wUnit(u)} to go
          </p>
          <ProgressBar className="mt-4" value={pct} max={100} height={10} label="Goal progress" />
          <div className="mt-2 flex justify-between text-xs text-muted">
            <span className="tabular">
              {fmt1(weightOut(profile.startWeight, u))} {wUnit(u)}
            </span>
            <span className="tabular">
              {fmt1(weightOut(profile.goalWeight, u))} {wUnit(u)}
            </span>
          </div>
        </Card>

        {/* Exercise */}
        <Card className="animate-fade-up">
          <CardHeader
            icon={<Dumbbell className="size-4" />}
            title="Exercise"
            action={
              <Button size="sm" variant="secondary" onClick={() => open("exercise")}>
                Add
              </Button>
            }
          />
          {todayEx.length ? (
            <ul className="space-y-2">
              {todayEx.map((e) => (
                <li key={e.id} className="flex items-center justify-between text-sm">
                  <span>
                    {e.name} <span className="text-muted">· {e.minutes} min</span>
                  </span>
                  <span className="tabular font-semibold text-burn">−{e.calories}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No workout yet. Even a 15-minute walk counts.</p>
          )}
          <div className="mt-4 flex items-end gap-1" aria-label="Calories burned in the last 7 days">
            {week.map((d) => {
              const burned = dayTotals(d, [], exercises).burned;
              return (
                <div key={d} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-12 w-full items-end">
                    <div
                      className="w-full rounded-t-[4px] bg-burn/80"
                      style={{ height: `${Math.min(100, (burned / 500) * 100)}%`, minHeight: burned ? 3 : 0 }}
                      title={`${burned} kcal`}
                    />
                  </div>
                  <span className="text-[10px] text-subtle">{formatDate(d, { weekday: "narrow" })}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Mood */}
        <Card className="animate-fade-up">
          <CardHeader
            title="How are you feeling?"
            action={
              <Link href="/journal" className="text-sm font-medium text-brand hover:underline">
                Journal
              </Link>
            }
          />
          <MoodPicker date={today} />
        </Card>
      </div>

      <SuggestionsCard date={today} />

      <Link
        href="/coach"
        className="animate-fade-up group flex items-center gap-4 rounded-2xl border border-brand/30 bg-gradient-to-br from-brand-soft to-surface p-4 transition hover:border-brand sm:p-5"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-brand-contrast">
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Your weekly AI coach summary is ready</p>
          <p className="text-sm text-muted">See this week&apos;s trends and one tip — or ask anything about your progress.</p>
        </div>
        <MessageCircle className="hidden size-5 text-brand transition group-hover:translate-x-0.5 sm:block" />
        <ArrowRight className="size-5 text-brand transition group-hover:translate-x-0.5 sm:hidden" />
      </Link>
    </div>
  );
}
