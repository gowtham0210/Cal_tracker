"use client";

import { Activity, Dumbbell, Plus, Trash2 } from "lucide-react";
import { SimpleBars } from "@/components/charts";
import { Button, Card, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { formatDate, lastNDays, relativeDay } from "@/lib/date";
import { EXERCISE_PRESETS } from "@/lib/foods";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui";

export function ExerciseView() {
  const exercises = useStore((s) => s.exercises);
  const removeExercise = useStore((s) => s.removeExercise);
  const addExercise = useStore((s) => s.addExercise);
  const open = useUI((s) => s.open);
  const toast = useToast();

  const week = lastNDays(7);
  const thisWeek = exercises.filter((e) => week.includes(e.date));
  const kcal = thisWeek.reduce((s, e) => s + e.calories, 0);
  const mins = thisWeek.reduce((s, e) => s + e.minutes, 0);
  const activeDays = new Set(thisWeek.map((e) => e.date)).size;

  const days14 = lastNDays(14);
  const chart = days14.map((d) => ({
    date: d,
    label: formatDate(d, { weekday: "narrow" }),
    value: exercises.filter((e) => e.date === d).reduce((s, e) => s + e.calories, 0),
  }));

  const recentDays = lastNDays(21)
    .reverse()
    .filter((d) => exercises.some((e) => e.date === d));
  const emoji = (name: string) => EXERCISE_PRESETS.find((p) => p.name === name)?.emoji ?? "💪";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Exercise"
        subtitle="Calories burned are added back to your daily budget"
        action={
          <Button onClick={() => open("exercise")}>
            <Plus className="size-4" /> Log workout
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <Card className="!p-4">
          <Stat label="Burned this week" value={kcal.toLocaleString()} unit="kcal" />
        </Card>
        <Card className="!p-4">
          <Stat label="Active time" value={Math.floor(mins / 60) ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`} />
        </Card>
        <Card className="!p-4">
          <Stat label="Active days" value={activeDays} unit="/ 7" />
        </Card>
      </div>

      <Card>
        <CardHeader icon={<Activity className="size-4" />} title="Calories burned" subtitle="Last 14 days" />
        <SimpleBars data={chart} color="var(--burn)" unit="kcal burned" />
      </Card>

      <Card>
        <CardHeader title="Recent workouts" />
        {recentDays.length ? (
          <div className="space-y-4">
            {recentDays.map((d) => (
              <section key={d}>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">{relativeDay(d)}</h3>
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {exercises
                    .filter((e) => e.date === d)
                    .map((e) => (
                      <li key={e.id} className="group flex items-center gap-3 px-3 py-2.5">
                        <span className="grid size-9 place-items-center rounded-lg bg-surface-2 text-lg" aria-hidden>
                          {emoji(e.name)}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{e.name}</p>
                          <p className="text-xs text-muted">{e.minutes} min</p>
                        </div>
                        <span className="tabular text-sm font-semibold text-burn">−{e.calories} kcal</span>
                        <button
                          aria-label={`Delete ${e.name}`}
                          onClick={() => {
                            removeExercise(e.id);
                            const { id: _id, ...rest } = e;
                            void _id;
                            toast(`Removed ${e.name}`, { tone: "info", action: { label: "Undo", onClick: () => addExercise(rest) } });
                          }}
                          className="grid size-8 place-items-center rounded-lg text-subtle hover:bg-surface-2 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Dumbbell className="size-5" />}
            title="No workouts in the last 3 weeks"
            description="Every bit of movement counts — log a walk to get started."
            action={<Button onClick={() => open("exercise")}>Log a workout</Button>}
          />
        )}
      </Card>
    </div>
  );
}
