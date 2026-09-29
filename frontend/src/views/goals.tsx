"use client";

import clsx from "clsx";
import { Flag, Lock, Pencil, Target } from "lucide-react";
import { useState } from "react";
import { Button, Card, CardHeader, Field, Input, PageHeader, ProgressBar, Sheet } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { computeBadges, fmt1, goalProgress, latestWeight, projectedGoalDate, weightIn, weightOut, wUnit } from "@/lib/calc";
import { daysBetween, formatDate, todayKey } from "@/lib/date";
import { useStore } from "@/lib/store";

export function GoalsView() {
  const s = useStore();
  const { profile, weights, updateProfile } = s;
  const toast = useToast();
  const u = profile.units;
  const current = latestWeight(weights, profile);
  const pct = goalProgress(current, profile);
  const eta = projectedGoalDate(weights, profile);
  const badges = computeBadges(s);
  const earned = badges.filter((b) => b.earned).length;
  const [edit, setEdit] = useState(false);
  const [startV, setStartV] = useState("");
  const [goalV, setGoalV] = useState("");

  const total = profile.startWeight - profile.goalWeight;
  const milestones = [25, 50, 75, 100].map((p) => ({
    p,
    weight: profile.startWeight - (total * p) / 100,
    reached: pct >= p,
  }));

  const openEdit = () => {
    setStartV(fmt1(weightOut(profile.startWeight, u)));
    setGoalV(fmt1(weightOut(profile.goalWeight, u)));
    setEdit(true);
  };

  const sv = weightIn(Number(startV), u);
  const gv = weightIn(Number(goalV), u);
  const valid = sv > 25 && gv > 25 && gv < sv;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Goals & milestones"
        subtitle={`${earned} of ${badges.length} badges earned`}
        action={
          <Button variant="outline" onClick={openEdit}>
            <Pencil className="size-4" /> Edit goal
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm text-muted">
              <Target className="size-4" /> Journey progress
            </p>
            <p className="tabular mt-1 text-5xl font-bold tracking-tight">
              {Math.round(pct)}
              <span className="text-2xl text-muted">%</span>
            </p>
            <p className="mt-1 text-sm text-muted">
              {fmt1(weightOut(profile.startWeight - current, u))} of {fmt1(weightOut(total, u))} {wUnit(u)} lost ·{" "}
              {daysBetween(profile.startDate, todayKey())} days in
            </p>
          </div>
          <div className="rounded-2xl bg-brand-soft px-5 py-4 text-brand-strong">
            <p className="text-xs font-medium opacity-80">Projected goal date</p>
            <p className="mt-0.5 text-lg font-semibold">
              {eta ? formatDate(eta, { month: "long", day: "numeric", year: "numeric" }) : "Keep logging to project"}
            </p>
          </div>
        </div>

        {/* Milestone track */}
        <div className="relative mx-3 mb-2 mt-10">
          <ProgressBar value={pct} max={100} height={10} label="Goal progress" />
          {milestones.map((m) => (
            <div key={m.p} className="absolute top-[5px] -translate-x-1/2 -translate-y-1/2" style={{ left: `${m.p}%` }}>
              <div
                className={clsx(
                  "grid size-6 place-items-center rounded-full border-[3px] border-surface text-[10px] shadow-sm",
                  m.reached ? "bg-brand text-brand-contrast" : "bg-surface-2 text-subtle",
                )}
                aria-hidden
              >
                {m.p === 100 ? <Flag className="size-3" /> : "✓"}
              </div>
            </div>
          ))}
        </div>
        <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {milestones.map((m) => (
            <li key={m.p} className={clsx("rounded-xl border p-3", m.reached ? "border-brand/40 bg-brand-soft/50" : "border-border")}>
              <p className="text-xs text-muted">{m.p}% milestone</p>
              <p className="tabular font-semibold">
                {fmt1(weightOut(m.weight, u))} {wUnit(u)}
              </p>
              <p className={clsx("text-xs", m.reached ? "text-brand-strong" : "text-subtle")}>{m.reached ? "Reached 🎉" : "Upcoming"}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardHeader title="Badges" subtitle="Earned by staying consistent" />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {badges.map((b) => (
            <li
              key={b.id}
              className={clsx(
                "flex flex-col items-center rounded-2xl border p-4 text-center transition",
                b.earned ? "border-brand/30 bg-gradient-to-b from-brand-soft/70 to-transparent" : "border-border",
              )}
            >
              <div
                className={clsx(
                  "relative grid size-14 place-items-center rounded-full text-3xl",
                  b.earned ? "bg-surface shadow-card" : "bg-surface-2 grayscale",
                )}
              >
                <span className={clsx(!b.earned && "opacity-40")} aria-hidden>
                  {b.emoji}
                </span>
                {!b.earned && (
                  <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-surface text-subtle shadow">
                    <Lock className="size-3" />
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm font-semibold">{b.title}</p>
              <p className="mt-0.5 text-xs text-muted">{b.description}</p>
              {!b.earned && b.progress !== undefined && (
                <ProgressBar className="mt-3" value={b.progress * 100} max={100} height={4} label={`${b.title} progress`} />
              )}
              <span className="sr-only">{b.earned ? "Earned" : "Not yet earned"}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Sheet
        open={edit}
        onClose={() => setEdit(false)}
        title="Edit goal"
        description="Adjusting your goal recalculates progress and milestones."
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            updateProfile({ startWeight: Math.round(sv * 10) / 10, goalWeight: Math.round(gv * 10) / 10 });
            toast("Goal updated");
            setEdit(false);
          }}
        >
          <Field label="Starting weight" htmlFor="g-start">
            <Input id="g-start" inputMode="decimal" suffix={wUnit(u)} value={startV} onChange={(e) => setStartV(e.target.value)} />
          </Field>
          <Field
            label="Goal weight"
            htmlFor="g-goal"
            error={startV && goalV && !valid ? "Goal must be lower than your starting weight" : undefined}
          >
            <Input id="g-goal" inputMode="decimal" suffix={wUnit(u)} value={goalV} onChange={(e) => setGoalV(e.target.value)} />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={!valid}>
            Save goal
          </Button>
        </form>
      </Sheet>
    </div>
  );
}
