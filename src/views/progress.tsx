"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";
import { CaloriesChart, SimpleBars, WeightChart } from "@/components/charts";
import { Card, CardHeader, PageHeader, ProgressBar, Segmented, Stat } from "@/components/ui";
import { averageCalories, currentStreak, dayTotals, fmt1, longestStreak, weightOn, weightOut, weightTrend, wUnit } from "@/lib/calc";
import { addDays, formatDate, lastNDays, todayKey } from "@/lib/date";
import { useStore } from "@/lib/store";

type Range = "7" | "30" | "90";

export function ProgressView() {
  const [range, setRange] = useState<Range>("7");
  const s = useStore();
  const { profile, foods, exercises, weights, water } = s;
  const u = profile.units;
  const n = Number(range);
  const days = useMemo(() => lastNDays(n), [n]);
  const prevDays = useMemo(() => lastNDays(n, addDays(todayKey(), -n)), [n]);

  const avg = averageCalories(foods, exercises, days);
  const prevAvg = averageCalories(foods, exercises, prevDays);
  const logged = days.filter((d) => foods.some((f) => f.date === d));
  const onTarget = logged.filter((d) => {
    const t = dayTotals(d, foods, exercises);
    return t.net <= profile.calorieGoal + 50;
  }).length;
  const wEnd = weightOn(weights, days[days.length - 1]);
  const wStart = weightOn(weights, addDays(days[0], -1)) ?? weights[0]?.weight;
  const wChange = wEnd !== undefined && wStart !== undefined ? wEnd - wStart : 0;
  const workouts = exercises.filter((e) => days.includes(e.date)).length;

  const calData = days.map((d) => {
    const t = dayTotals(d, foods, exercises);
    return {
      date: d,
      label: n === 7 ? formatDate(d, { weekday: "short" }) : formatDate(d, { month: "short", day: "numeric" }),
      intake: t.calories,
      net: t.net,
      burned: t.burned,
    };
  });

  const weightData = weightTrend(weights)
    .filter((p) => p.date >= addDays(days[0], -3))
    .map((p) => ({ ...p, weight: weightOut(p.weight, u), trend: weightOut(p.trend, u) }));

  const macroAvg = (k: "protein" | "carbs" | "fat") =>
    logged.reduce((sum, d) => sum + dayTotals(d, foods, exercises)[k], 0) / Math.max(1, logged.length);

  const waterData = days.map((d) => ({
    date: d,
    label: n === 7 ? formatDate(d, { weekday: "short" }) : formatDate(d, { month: "short", day: "numeric" }),
    value: water[d] ?? 0,
  }));

  // Consistency grid: last 12 weeks, aligned to weeks
  const gridDays = lastNDays(84);
  const intakeDelta = avg.intake - prevAvg.intake;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Progress"
        subtitle="Trends matter more than any single day"
        action={
          <Segmented
            label="Time range"
            value={range}
            onChange={setRange}
            options={[
              { value: "7", label: "Week" },
              { value: "30", label: "Month" },
              { value: "90", label: "3 months" },
            ]}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="!p-4">
          <Stat
            label="Weight change"
            value={`${wChange <= 0 ? "−" : "+"}${fmt1(Math.abs(weightOut(wChange, u)))}`}
            unit={wUnit(u)}
            sub={wChange < 0 ? "Heading the right way" : "Hold steady — it's a trend"}
          />
        </Card>
        <Card className="!p-4">
          <Stat
            label="Avg calories / day"
            value={Math.round(avg.intake).toLocaleString()}
            unit="kcal"
            sub={`${intakeDelta <= 0 ? "▼" : "▲"} ${Math.abs(Math.round(intakeDelta))} vs previous`}
          />
        </Card>
        <Card className="!p-4">
          <Stat label="Days on target" value={`${onTarget}/${logged.length}`} sub={`${days.length - logged.length} unlogged`} />
        </Card>
        <Card className="!p-4">
          <Stat label="Workouts" value={workouts} sub={`${Math.round(avg.burned)} kcal/day avg`} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Net calories" subtitle={`Daily, vs your ${profile.calorieGoal} kcal goal`} />
          <CaloriesChart data={calData} goal={profile.calorieGoal} />
        </Card>
        <Card>
          <CardHeader title="Weight" subtitle="Trend line with daily weigh-ins" />
          {weightData.length > 1 ? (
            <WeightChart data={weightData} unit={wUnit(u)} height={240} showGoal={false} />
          ) : (
            <p className="py-16 text-center text-sm text-muted">Not enough weigh-ins in this range.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {profile.trackMacros && (
          <Card>
            <CardHeader title="Average macros" subtitle="Per logged day" />
            <div className="space-y-4">
              {(
                [
                  ["protein", "Protein", "var(--protein)"],
                  ["carbs", "Carbs", "var(--carbs)"],
                  ["fat", "Fat", "var(--fat)"],
                ] as const
              ).map(([k, label, color]) => {
                const v = Math.round(macroAvg(k));
                const g = profile.macroGoals[k];
                return (
                  <div key={k}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="text-muted">{label}</span>
                      <span className="tabular">
                        <span className="font-semibold">{v} g</span> <span className="text-muted">/ {g} g</span>
                      </span>
                    </div>
                    <ProgressBar value={v} max={g} color={color} label={`${label} average`} />
                  </div>
                );
              })}
            </div>
          </Card>
        )}
        <Card className={clsx(profile.trackMacros ? "lg:col-span-2" : "lg:col-span-3")}>
          <CardHeader title="Water" subtitle={`Glasses per day · goal ${profile.waterGoal}`} />
          <SimpleBars data={waterData} color="var(--water)" unit="glasses" goal={profile.waterGoal} height={180} />
        </Card>
      </div>

      <Card>
        <CardHeader title="Consistency" subtitle={`Current streak ${currentStreak(foods)} days · longest ${longestStreak(foods)} days`} />
        <div className="overflow-x-auto pb-1">
          <div className="grid w-max grid-flow-col grid-rows-7 gap-1" role="img" aria-label="Logging consistency over the last 12 weeks">
            {gridDays.map((d) => {
              const has = foods.some((f) => f.date === d);
              const hit = has && dayTotals(d, foods, exercises).net <= profile.calorieGoal + 50;
              return (
                <div
                  key={d}
                  title={`${formatDate(d, { weekday: "short", month: "short", day: "numeric" })}: ${hit ? "on target" : has ? "logged" : "not logged"}`}
                  className={clsx(
                    "size-4 rounded-[4px] sm:size-5",
                    hit ? "bg-brand" : has ? "bg-brand/35" : "bg-surface-2",
                    d === todayKey() && "ring-2 ring-text/40 ring-offset-1 ring-offset-surface",
                  )}
                />
              );
            })}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-[3px] bg-surface-2" /> Not logged
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-[3px] bg-brand/35" /> Logged
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-[3px] bg-brand" /> On target
          </span>
        </div>
      </Card>
    </div>
  );
}
