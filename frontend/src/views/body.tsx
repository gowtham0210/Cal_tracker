"use client";

import { Pencil, Ruler, Scale, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { LineMini, WeightChart } from "@/components/charts";
import { Button, Card, CardHeader, Chip, EmptyState, Input, PageHeader, Segmented, Stat } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import {
  bmi,
  bmiCategory,
  fmt1,
  latestWeight,
  lengthIn,
  lengthOut,
  lUnit,
  sortedWeights,
  weeklyRate,
  weightOut,
  weightTrend,
  wUnit,
} from "@/lib/calc";
import { addDays, relativeDay, todayKey } from "@/lib/date";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui";

type Range = "30" | "90" | "all";

function BmiScale({ value }: { value: number }) {
  const min = 15;
  const max = 40;
  const pos = ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100;
  const seg = (a: number, b: number) => `${((b - a) / (max - min)) * 100}%`;
  return (
    <div className="mt-3">
      <div className="relative">
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
          <div className="bg-sky-400/70" style={{ width: seg(15, 18.5) }} />
          <div className="bg-green-500/80" style={{ width: seg(18.5, 25) }} />
          <div className="bg-amber-400/80" style={{ width: seg(25, 30) }} />
          <div className="bg-red-400/80" style={{ width: seg(30, 40) }} />
        </div>
        <div
          className="absolute -top-1 size-[18px] -translate-x-1/2 rounded-full border-[3px] border-surface bg-text shadow transition-[left] duration-700"
          style={{ left: `${pos}%` }}
          aria-hidden
        />
      </div>
      <div className="relative mt-1.5 h-3 text-[10px] text-subtle" aria-hidden>
        {[15, 18.5, 25, 30, 40].map((t, i, arr) => (
          <span
            key={t}
            className="tabular absolute"
            style={{
              left: `${((t - min) / (max - min)) * 100}%`,
              transform: i === 0 ? undefined : i === arr.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BodyView() {
  const profile = useStore((s) => s.profile);
  const weights = useStore((s) => s.weights);
  const measurements = useStore((s) => s.measurements);
  const removeWeight = useStore((s) => s.removeWeight);
  const logWeight = useStore((s) => s.logWeight);
  const removeMeasurement = useStore((s) => s.removeMeasurement);
  const updateProfile = useStore((s) => s.updateProfile);
  const open = useUI((s) => s.open);
  const toast = useToast();
  const u = profile.units;
  const [range, setRange] = useState<Range>("90");
  const [editHeight, setEditHeight] = useState(false);
  const [heightVal, setHeightVal] = useState("");
  const [showAll, setShowAll] = useState(false);

  const current = latestWeight(weights, profile);
  const b = bmi(current, profile.heightCm);
  const cat = bmiCategory(b);
  const rate = weeklyRate(weights);

  const chartData = useMemo(() => {
    const t = weightTrend(weights);
    if (range === "all") return t.map((p) => ({ ...p, weight: weightOut(p.weight, u), trend: weightOut(p.trend, u) }));
    const from = addDays(todayKey(), -Number(range));
    return t.filter((p) => p.date >= from).map((p) => ({ ...p, weight: weightOut(p.weight, u), trend: weightOut(p.trend, u) }));
  }, [weights, range, u]);

  const history = sortedWeights(weights).reverse();
  const shown = showAll ? history : history.slice(0, 8);

  const heightDisplay =
    u === "imperial"
      ? `${Math.floor(lengthOut(profile.heightCm, u) / 12)}′ ${Math.round(lengthOut(profile.heightCm, u) % 12)}″`
      : `${profile.heightCm} cm`;

  const saveHeight = () => {
    const cm = lengthIn(Number(heightVal), u);
    if (cm > 100 && cm < 250) {
      updateProfile({ heightCm: Math.round(cm) });
      toast("Height updated — BMI recalculated");
      setEditHeight(false);
    }
  };

  const mKeys = [
    { key: "waist" as const, label: "Waist", color: "var(--brand)" },
    { key: "hips" as const, label: "Hips", color: "var(--protein)" },
    { key: "chest" as const, label: "Chest", color: "var(--carbs)" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Body"
        subtitle="Weight trend, BMI and measurements"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => open("measurement")}>
              <Ruler className="size-4" /> Measure
            </Button>
            <Button onClick={() => open("weight")}>
              <Scale className="size-4" /> Log weight
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="!p-4">
          <Stat label="Current" value={fmt1(weightOut(current, u))} unit={wUnit(u)} />
        </Card>
        <Card className="!p-4">
          <Stat
            label="Total lost"
            value={fmt1(weightOut(profile.startWeight - current, u))}
            unit={wUnit(u)}
            sub={`from ${fmt1(weightOut(profile.startWeight, u))} ${wUnit(u)}`}
          />
        </Card>
        <Card className="!p-4">
          <Stat
            label="Weekly pace"
            value={`${rate <= 0 ? "−" : "+"}${fmt1(Math.abs(weightOut(rate, u)))}`}
            unit={`${wUnit(u)}/wk`}
            sub={rate < -1 ? "Fast — make sure you're eating enough" : rate < 0 ? "Healthy, sustainable pace" : "Holding steady"}
          />
        </Card>
        <Card className="!p-4">
          <Stat
            label="To goal"
            value={fmt1(weightOut(Math.max(0, current - profile.goalWeight), u))}
            unit={wUnit(u)}
            sub={`goal ${fmt1(weightOut(profile.goalWeight, u))}`}
          />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Weight trend"
            subtitle="Smoothed trend line filters out daily water swings"
            action={
              <Segmented
                label="Range"
                size="sm"
                value={range}
                onChange={setRange}
                options={[
                  { value: "30", label: "1M" },
                  { value: "90", label: "3M" },
                  { value: "all", label: "All" },
                ]}
              />
            }
          />
          {chartData.length > 1 ? (
            <>
              <WeightChart data={chartData} goal={weightOut(profile.goalWeight, u)} unit={wUnit(u)} showGoal={range === "all"} />
              <div className="mt-3 flex items-center gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded bg-brand" /> Trend
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-subtle" /> Daily weigh-in
                </span>
                {range === "all" && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 border-t-2 border-dashed border-brand/60" /> Goal
                  </span>
                )}
              </div>
            </>
          ) : (
            <EmptyState
              icon={<Scale className="size-5" />}
              title="Not enough weigh-ins"
              description="Log at least two weigh-ins to see your trend."
            />
          )}
        </Card>

        <Card>
          <CardHeader title="BMI" subtitle="Updates automatically with each weigh-in" />
          <div className="flex items-baseline gap-3">
            <p className="tabular text-4xl font-bold tracking-tight">{b.toFixed(1)}</p>
            <Chip tone={cat.tone}>{cat.label}</Chip>
          </div>
          <BmiScale value={b} />
          <div className="mt-5 flex items-center justify-between rounded-xl bg-surface-2 p-3">
            {editHeight ? (
              <form
                className="flex w-full items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveHeight();
                }}
              >
                <Input
                  aria-label={`Height in ${lUnit(u)}`}
                  inputMode="decimal"
                  autoFocus
                  suffix={lUnit(u)}
                  value={heightVal}
                  onChange={(e) => setHeightVal(e.target.value.replace(/[^\d.]/g, ""))}
                  className="h-9"
                />
                <Button size="sm" type="submit">
                  Save
                </Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setEditHeight(false)}>
                  Cancel
                </Button>
              </form>
            ) : (
              <>
                <div>
                  <p className="text-xs text-muted">Height</p>
                  <p className="font-semibold">{heightDisplay}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setHeightVal(String(Math.round(lengthOut(profile.heightCm, u))));
                    setEditHeight(true);
                  }}
                >
                  <Pencil className="size-3.5" /> Edit
                </Button>
              </>
            )}
          </div>
          <p className="mt-3 text-xs text-subtle">BMI is a screening tool, not a diagnosis. Waist size is a useful companion measure.</p>
        </Card>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        {/* Measurements */}
        <Card className="lg:col-span-2">
          <CardHeader
            icon={<Ruler className="size-4" />}
            title="Measurements"
            subtitle="Often shows progress when the scale doesn't"
            action={
              <Button size="sm" variant="secondary" onClick={() => open("measurement")}>
                Add
              </Button>
            }
          />
          {measurements.length ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {mKeys.map((m) => {
                  const pts = measurements.filter((x) => x[m.key]).map((x) => ({ date: x.date, value: lengthOut(x[m.key]!, u) }));
                  const first = pts[0]?.value ?? 0;
                  const last = pts[pts.length - 1]?.value ?? 0;
                  return (
                    <div key={m.key} className="rounded-xl bg-surface-2 p-3">
                      <div className="flex items-baseline justify-between">
                        <p className="text-sm font-medium">{m.label}</p>
                        <p className="tabular text-xs font-medium text-brand">
                          {last - first <= 0 ? "−" : "+"}
                          {fmt1(Math.abs(last - first))} {lUnit(u)}
                        </p>
                      </div>
                      <p className="tabular mt-1 text-2xl font-semibold">
                        {fmt1(last)} <span className="text-sm font-normal text-muted">{lUnit(u)}</span>
                      </p>
                      {pts.length > 1 && <LineMini data={pts} color={m.color} unit={lUnit(u)} height={70} />}
                    </div>
                  );
                })}
              </div>
              <details className="group mt-4">
                <summary className="cursor-pointer select-none text-sm font-medium text-muted hover:text-text">
                  Show all entries ({measurements.length})
                </summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted">
                        <th className="py-2 font-medium">Date</th>
                        <th className="py-2 text-right font-medium">Waist</th>
                        <th className="py-2 text-right font-medium">Hips</th>
                        <th className="py-2 text-right font-medium">Chest</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="tabular divide-y divide-border">
                      {[...measurements].reverse().map((m) => (
                        <tr key={m.id}>
                          <td className="py-2">{relativeDay(m.date)}</td>
                          <td className="py-2 text-right">{m.waist ? fmt1(lengthOut(m.waist, u)) : "—"}</td>
                          <td className="py-2 text-right">{m.hips ? fmt1(lengthOut(m.hips, u)) : "—"}</td>
                          <td className="py-2 text-right">{m.chest ? fmt1(lengthOut(m.chest, u)) : "—"}</td>
                          <td className="py-1 text-right">
                            <button
                              aria-label="Delete measurement"
                              onClick={() => removeMeasurement(m.id)}
                              className="grid size-8 place-items-center rounded-lg text-subtle hover:bg-surface-2 hover:text-danger"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : (
            <EmptyState
              icon={<Ruler className="size-5" />}
              title="No measurements yet"
              description="Log waist, hips and chest every couple of weeks."
            />
          )}
        </Card>

        {/* History */}
        <Card>
          <CardHeader title="Weigh-ins" subtitle={`${weights.length} entries`} />
          <ul className="divide-y divide-border">
            {shown.map((w, i) => {
              const prev = history[i + 1];
              const d = prev ? w.weight - prev.weight : 0;
              return (
                <li key={w.id} className="group flex items-center gap-3 py-2.5">
                  <span className="flex-1 text-sm">{relativeDay(w.date)}</span>
                  {prev && (
                    <span
                      className={
                        d < 0 ? "tabular text-xs text-brand" : d > 0 ? "tabular text-xs text-warning" : "tabular text-xs text-muted"
                      }
                    >
                      {d <= 0 ? "▼" : "▲"} {fmt1(Math.abs(weightOut(d, u)))}
                    </span>
                  )}
                  <span className="tabular w-16 text-right text-sm font-semibold">{fmt1(weightOut(w.weight, u))}</span>
                  <button
                    aria-label={`Delete weigh-in from ${relativeDay(w.date)}`}
                    onClick={() => {
                      removeWeight(w.id);
                      toast("Weigh-in deleted", { tone: "info", action: { label: "Undo", onClick: () => logWeight(w.date, w.weight) } });
                    }}
                    className="grid size-8 place-items-center rounded-lg text-subtle hover:bg-surface-2 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          {history.length > 8 && (
            <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show less" : `Show all ${history.length}`}
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
