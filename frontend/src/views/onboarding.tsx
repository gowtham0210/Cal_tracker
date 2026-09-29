"use client";

import { Sparkles, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { signOut, useSessionReady } from "@/components/providers";
import { Button, Card, Field, Input, ProgressBar, Segmented } from "@/components/ui";
import { api } from "@/lib/api";
import { lengthIn, lUnit, weightIn, wUnit } from "@/lib/calc";
import { todayKey } from "@/lib/date";
import { importLocalData, readLocalData } from "@/lib/import-local";
import { useCurrentUser } from "@/lib/session";
import { useStore } from "@/lib/store";
import type { UnitSystem } from "@/lib/types";
import { errorsFrom, FormError } from "./auth-form";

const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

type Form = { height: string; weight: string; goal: string; calories: string };

export function OnboardingView() {
  const ready = useSessionReady();
  const user = useCurrentUser();
  const router = useRouter();
  const [units, setUnits] = useState<UnitSystem>("metric");
  const [values, setValues] = useState<Form>({ height: "", weight: "", goal: "", calories: "1800" });
  const [errors, setErrors] = useState<Partial<Record<keyof Form | "form", string>>>({});
  const [busy, setBusy] = useState<"save" | "demo" | "import" | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  // Local storage is only readable in the browser, which `ready` guarantees.
  const local = useMemo(() => (ready ? readLocalData() : null), [ready]);

  useEffect(() => {
    if (!ready) return;
    if (!user) return router.replace("/login?next=/onboarding");
    // Someone who already has a profile doesn't need onboarding.
    api.profile().then(() => router.replace("/"), () => {});
  }, [ready, user, router]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined, form: undefined }));
  };

  const finish = () => {
    useStore.getState().reset();
    router.replace("/");
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const n = (s: string) => Number(s.replace(",", "."));
    const found: typeof errors = {};
    if (!(n(values.height) > 0)) found.height = "Enter your height.";
    if (!(n(values.weight) > 0)) found.weight = "Enter your current weight.";
    if (!(n(values.goal) > 0)) found.goal = "Enter your goal weight.";
    if (!(Number.isInteger(n(values.calories)) && n(values.calories) >= 1200)) found.calories = "Use a whole number of at least 1200.";
    setErrors(found);
    if (Object.keys(found).length) return;

    const calories = n(values.calories);
    setBusy("save");
    try {
      await api.putProfile({
        heightCm: Math.round(lengthIn(n(values.height), units) * 10) / 10,
        startWeight: Math.round(weightIn(n(values.weight), units) * 10) / 10,
        goalWeight: Math.round(weightIn(n(values.goal), units) * 10) / 10,
        startDate: todayKey(),
        calorieGoal: calories,
        // A balanced 30/40/30 split of the calorie goal (4, 4 and 9 kcal per gram).
        macroGoals: { protein: Math.round((calories * 0.3) / 4), carbs: Math.round((calories * 0.4) / 4), fat: Math.round((calories * 0.3) / 9) },
        trackMacros: true,
        waterGoal: 8,
        glassMl: 250,
        units,
        theme: "system",
        timeZone: browserTimeZone(),
      });
      finish();
    } catch (err) {
      setErrors(errorsFrom(err));
      setBusy(null);
    }
  }

  async function tryDemo() {
    setBusy("demo");
    try {
      await api.loadDemoData();
      await api.updateProfile({ timeZone: browserTimeZone() });
      finish();
    } catch (err) {
      setErrors(errorsFrom(err));
      setBusy(null);
    }
  }

  async function importLocal() {
    if (!local) return;
    setBusy("import");
    try {
      await importLocalData(local, browserTimeZone(), (done, total) => setProgress([done, total]));
      finish();
    } catch (err) {
      setErrors(errorsFrom(err));
      setBusy(null);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-xl font-semibold tracking-tight">Set up your goals{user ? `, ${user.name.split(" ")[0]}` : ""}</h1>
        <p className="mt-1 text-sm text-muted">You can change any of these later in Settings.</p>

        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
          <Segmented
            label="Units"
            value={units}
            onChange={setUnits}
            options={[
              { value: "metric", label: "kg · cm" },
              { value: "imperial", label: "lb · in" },
            ]}
            className="w-full"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Height" htmlFor="o-height" error={errors.height}>
              <Input id="o-height" inputMode="decimal" suffix={lUnit(units)} value={values.height} onChange={set("height")} aria-invalid={!!errors.height} />
            </Field>
            <Field label="Current weight" htmlFor="o-weight" error={errors.weight}>
              <Input id="o-weight" inputMode="decimal" suffix={wUnit(units)} value={values.weight} onChange={set("weight")} aria-invalid={!!errors.weight} />
            </Field>
            <Field label="Goal weight" htmlFor="o-goal" error={errors.goal}>
              <Input id="o-goal" inputMode="decimal" suffix={wUnit(units)} value={values.goal} onChange={set("goal")} aria-invalid={!!errors.goal} />
            </Field>
            <Field label="Daily calories" htmlFor="o-cal" error={errors.calories}>
              <Input id="o-cal" inputMode="numeric" suffix="kcal" value={values.calories} onChange={set("calories")} aria-invalid={!!errors.calories} />
            </Field>
          </div>
          <p className="text-xs text-subtle">About 500 kcal a day below what you burn loses roughly 0.5 kg (1 lb) a week.</p>
          <FormError message={errors.form} />
          <Button type="submit" size="lg" className="w-full" loading={busy === "save"} disabled={!ready || !!busy}>
            Start tracking
          </Button>
        </form>
      </Card>

      {local && (
        <Card>
          <p className="font-medium">Bring your data with you</p>
          <p className="mt-1 text-sm text-muted">This browser has {local.entries} entries from before accounts. Import them into your account.</p>
          {progress ? (
            <div className="mt-4 space-y-1.5" aria-live="polite">
              <ProgressBar value={progress[0]} max={Math.max(1, progress[1])} />
              <p className="text-xs text-muted">
                Imported {progress[0]} of {progress[1]}…
              </p>
            </div>
          ) : (
            <Button variant="outline" className="mt-4 w-full" onClick={() => void importLocal()} loading={busy === "import"} disabled={!!busy}>
              <Upload className="size-4" /> Import from this browser
            </Button>
          )}
        </Card>
      )}

      <div className="flex flex-col items-center gap-2">
        <Button variant="ghost" onClick={() => void tryDemo()} loading={busy === "demo"} disabled={!ready || !!busy}>
          <Sparkles className="size-4" /> Explore with demo data instead
        </Button>
        <button onClick={() => (signOut(), router.replace("/login"))} className="text-xs text-subtle hover:text-text">
          Sign out
        </button>
      </div>
    </div>
  );
}
