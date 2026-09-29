"use client";

import clsx from "clsx";
import {
  Activity,
  BookHeart,
  ChevronRight,
  Droplet,
  Dumbbell,
  LineChart,
  MessageCircle,
  Ruler,
  Scale,
  Settings,
  Trophy,
  Utensils,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { bmi, bmiCategory, fmt1, latestWeight, lengthIn, lengthOut, lUnit, weightIn, weightOut, wUnit } from "@/lib/calc";
import { todayKey } from "@/lib/date";
import { EXERCISE_PRESETS } from "@/lib/foods";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui";
import { Button, Chip, Field, Input, Sheet } from "../ui";
import { useToast } from "../ui/toast";

const num = (v: string) => v.replace(/[^\d.]/g, "");

/* ---------------- Weight ---------------- */
export function WeightDialog() {
  const { dialog, close } = useUI();
  return (
    <Sheet
      open={dialog === "weight"}
      onClose={close}
      title="Log weight"
      description="Weigh in at the same time each day for the best trend."
    >
      <WeightForm />
    </Sheet>
  );
}

function WeightForm() {
  const close = useUI((s) => s.close);
  const profile = useStore((s) => s.profile);
  const weights = useStore((s) => s.weights);
  const logWeight = useStore((s) => s.logWeight);
  const toast = useToast();
  const u = profile.units;
  const last = latestWeight(weights, profile);
  const [value, setValue] = useState(() => fmt1(weightOut(last, u)));
  const [date, setDate] = useState(todayKey);
  const [err, setErr] = useState<string>();

  const kg = weightIn(Number(value), u);
  const valid = kg > 25 && kg < 400;
  const delta = valid ? kg - last : 0;
  const b = valid ? bmi(kg, profile.heightCm) : 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return setErr(`Enter a weight between ${Math.round(weightOut(25, u))} and ${Math.round(weightOut(400, u))} ${wUnit(u)}`);
    logWeight(date, Math.round(kg * 10) / 10);
    toast(`Weight logged: ${fmt1(weightOut(kg, u))} ${wUnit(u)}`);
    close();
  };

  const step = (d: number) => setValue(fmt1(Math.max(0, (Number(value) || 0) + d)));

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="flex items-center justify-center gap-3 py-2">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="size-12 rounded-full text-xl"
          onClick={() => step(-0.1)}
          aria-label="Decrease by 0.1"
        >
          −
        </Button>
        <div className="flex items-baseline gap-1">
          <label htmlFor="w-val" className="sr-only">
            Weight in {wUnit(u)}
          </label>
          <input
            id="w-val"
            inputMode="decimal"
            value={value}
            onChange={(e) => {
              setValue(num(e.target.value));
              setErr(undefined);
            }}
            className="tabular w-36 bg-transparent text-center text-5xl font-bold tracking-tight outline-none"
          />
          <span className="text-lg text-muted">{wUnit(u)}</span>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="size-12 rounded-full text-xl"
          onClick={() => step(0.1)}
          aria-label="Increase by 0.1"
        >
          +
        </Button>
      </div>
      {err ? (
        <p role="alert" className="text-center text-sm text-danger">
          {err}
        </p>
      ) : (
        valid && (
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <Chip tone={delta < 0 ? "good" : delta > 0 ? "warn" : "neutral"}>
              {delta === 0 ? "No change" : `${delta < 0 ? "▼" : "▲"} ${fmt1(Math.abs(weightOut(delta, u)))} ${wUnit(u)}`} vs last
            </Chip>
            <Chip tone={bmiCategory(b).tone}>
              BMI {b.toFixed(1)} · {bmiCategory(b).label}
            </Chip>
          </div>
        )
      )}
      <Field label="Date" htmlFor="w-date">
        <Input id="w-date" type="date" max={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" className="w-full">
        Save weigh-in
      </Button>
    </form>
  );
}

/* ---------------- Measurements ---------------- */
export function MeasurementDialog() {
  const { dialog, close } = useUI();
  return (
    <Sheet
      open={dialog === "measurement"}
      onClose={close}
      title="Log measurements"
      description="Measure at the widest point, tape snug but not tight."
    >
      <MeasurementForm />
    </Sheet>
  );
}

function MeasurementForm() {
  const close = useUI((s) => s.close);
  const u = useStore((s) => s.profile.units);
  const measurements = useStore((s) => s.measurements);
  const logMeasurement = useStore((s) => s.logMeasurement);
  const toast = useToast();
  const last = measurements[measurements.length - 1];
  const [vals, setVals] = useState({ waist: "", hips: "", chest: "" });
  const [date, setDate] = useState(todayKey);

  const any = Object.values(vals).some((v) => Number(v) > 0);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!any) return;
    const conv = (v: string) => (Number(v) > 0 ? Math.round(lengthIn(Number(v), u) * 10) / 10 : undefined);
    logMeasurement({ date, waist: conv(vals.waist), hips: conv(vals.hips), chest: conv(vals.chest) });
    toast("Measurements saved");
    close();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {(["waist", "hips", "chest"] as const).map((k) => (
        <Field
          key={k}
          label={k[0].toUpperCase() + k.slice(1)}
          htmlFor={`m-${k}`}
          hint={last?.[k] ? `Last: ${fmt1(lengthOut(last[k]!, u))} ${lUnit(u)}` : undefined}
        >
          <Input
            id={`m-${k}`}
            inputMode="decimal"
            suffix={lUnit(u)}
            placeholder={last?.[k] ? fmt1(lengthOut(last[k]!, u)) : "0"}
            value={vals[k]}
            onChange={(e) => setVals({ ...vals, [k]: num(e.target.value) })}
          />
        </Field>
      ))}
      <Field label="Date" htmlFor="m-date">
        <Input id="m-date" type="date" max={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={!any}>
        Save measurements
      </Button>
    </form>
  );
}

/* ---------------- Exercise ---------------- */
export function ExerciseDialog() {
  const { dialog, close } = useUI();
  return (
    <Sheet
      open={dialog === "exercise"}
      onClose={close}
      title="Log exercise"
      description="Calories burned are subtracted from today's net intake."
    >
      <ExerciseForm />
    </Sheet>
  );
}

function ExerciseForm() {
  const { close, date: presetDate } = useUI();
  const addExercise = useStore((s) => s.addExercise);
  const toast = useToast();
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [calInput, setCalInput] = useState("");
  const [calEdited, setCalEdited] = useState(false);
  const [preset, setPreset] = useState<string | null>(null);

  // Auto-estimate calories from the preset until the user types their own number
  const presetRate = EXERCISE_PRESETS.find((x) => x.name === preset)?.calPerMin;
  const cal = !calEdited && presetRate ? String(Math.round(presetRate * (Number(minutes) || 0))) : calInput;

  const valid = name.trim() && Number(cal) > 0;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    addExercise({ date: presetDate ?? todayKey(), name: name.trim(), minutes: Number(minutes) || 0, calories: Math.round(Number(cal)) });
    toast(`${name} logged · ${cal} kcal burned`);
    close();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <p className="mb-2 text-[13px] font-medium text-muted">Quick pick</p>
        <div className="grid grid-cols-4 gap-2">
          {EXERCISE_PRESETS.map((p) => (
            <button
              type="button"
              key={p.name}
              aria-pressed={preset === p.name}
              onClick={() => {
                setPreset(p.name);
                setName(p.name);
                setCalEdited(false);
              }}
              className={clsx(
                "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-medium leading-tight transition",
                preset === p.name ? "border-brand bg-brand-soft text-brand-strong" : "border-border text-muted hover:bg-surface-2",
              )}
            >
              <span className="text-lg" aria-hidden>
                {p.emoji}
              </span>
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <Field label="Activity" htmlFor="e-name">
        <Input id="e-name" value={name} placeholder="e.g. Morning walk" onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duration" htmlFor="e-min">
          <Input id="e-min" inputMode="numeric" suffix="min" value={minutes} onChange={(e) => setMinutes(num(e.target.value))} />
        </Field>
        <Field label="Calories burned" htmlFor="e-cal" hint={preset && !calEdited ? "Auto-estimated" : undefined}>
          <Input
            id="e-cal"
            inputMode="numeric"
            suffix="kcal"
            value={cal}
            onChange={(e) => {
              setCalInput(num(e.target.value));
              setCalEdited(true);
            }}
          />
        </Field>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={!valid}>
        Save workout
      </Button>
    </form>
  );
}

/* ---------------- Quick add ---------------- */
export function QuickAddDialog() {
  const { dialog, close, open: openDialog } = useUI();
  const water = useStore((s) => s.water);
  const setWater = useStore((s) => s.setWater);
  const goal = useStore((s) => s.profile.waterGoal);
  const toast = useToast();
  const today = todayKey();

  const actions = [
    { label: "Food", desc: "Describe, snap or enter", icon: Utensils, color: "var(--brand)", onClick: () => openDialog("food") },
    { label: "Weight", desc: "Daily weigh-in", icon: Scale, color: "var(--protein)", onClick: () => openDialog("weight") },
    {
      label: "Water",
      desc: `+1 glass (${water[today] ?? 0}/${goal})`,
      icon: Droplet,
      color: "var(--water)",
      onClick: () => {
        const n = (water[today] ?? 0) + 1;
        setWater(today, n);
        toast(n >= goal ? `💧 ${n}/${goal} glasses — goal reached!` : `💧 ${n}/${goal} glasses`);
        close();
      },
    },
    { label: "Exercise", desc: "Burned calories", icon: Dumbbell, color: "var(--burn)", onClick: () => openDialog("exercise") },
    { label: "Measurements", desc: "Waist, hips, chest", icon: Ruler, color: "var(--carbs)", onClick: () => openDialog("measurement") },
  ];

  return (
    <Sheet open={dialog === "quick"} onClose={close} title="Quick add">
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              onClick={a.onClick}
              className="flex flex-col items-start gap-3 rounded-2xl border border-border p-4 text-left transition hover:bg-surface-2 active:scale-[0.98]"
            >
              <span
                className="grid size-10 place-items-center rounded-xl"
                style={{ background: `color-mix(in oklab, ${a.color} 15%, transparent)`, color: a.color }}
              >
                <Icon className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">{a.label}</span>
                <span className="block text-xs text-muted">{a.desc}</span>
              </span>
            </button>
          );
        })}
        <Link
          href="/journal"
          onClick={close}
          className="flex flex-col items-start gap-3 rounded-2xl border border-border p-4 text-left transition hover:bg-surface-2 active:scale-[0.98]"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-rose-500/15 text-rose-500">
            <BookHeart className="size-5" />
          </span>
          <span>
            <span className="block font-semibold">Mood & notes</span>
            <span className="block text-xs text-muted">How are you feeling?</span>
          </span>
        </Link>
      </div>
    </Sheet>
  );
}

/* ---------------- More (mobile nav overflow) ---------------- */
export const MORE_LINKS = [
  { href: "/body", label: "Body", desc: "Weight, BMI & measurements", icon: Scale },
  { href: "/exercise", label: "Exercise", desc: "Workouts & calories burned", icon: Activity },
  { href: "/journal", label: "Journal", desc: "Mood, sleep & notes", icon: BookHeart },
  { href: "/goals", label: "Goals & badges", desc: "Milestones and achievements", icon: Trophy },
  { href: "/coach", label: "AI Coach", desc: "Chat & weekly summary", icon: MessageCircle },
  { href: "/progress", label: "Progress", desc: "Weekly & monthly charts", icon: LineChart },
  { href: "/settings", label: "Settings", desc: "Goals, units & export", icon: Settings },
];

export function MoreDialog() {
  const { dialog, close } = useUI();
  return (
    <Sheet open={dialog === "more"} onClose={close} title="More">
      <nav aria-label="More pages">
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {MORE_LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <li key={l.href}>
                <Link href={l.href} onClick={close} className="flex items-center gap-3 p-3.5 transition hover:bg-surface-2">
                  <span className="grid size-9 place-items-center rounded-lg bg-surface-2 text-muted">
                    <Icon className="size-[18px]" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-medium">{l.label}</span>
                    <span className="block text-xs text-muted">{l.desc}</span>
                  </span>
                  <ChevronRight className="size-4 text-subtle" />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </Sheet>
  );
}
