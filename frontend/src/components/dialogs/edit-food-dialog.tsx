"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { FoodEntry, MealType } from "@/lib/types";
import { MEALS, MEAL_LABEL } from "@/lib/ui";
import { Button, Field, Input, Segmented, Sheet } from "../ui";
import { useToast } from "../ui/toast";

export function EditFoodDialog({ entry, onClose }: { entry: FoodEntry | null; onClose: () => void }) {
  return (
    <Sheet open={!!entry} onClose={onClose} title="Edit food" description="Fix the name, meal, calories or macros.">
      {entry && <EditFoodForm key={entry.id} entry={entry} onDone={onClose} />}
    </Sheet>
  );
}

function EditFoodForm({ entry, onDone }: { entry: FoodEntry; onDone: () => void }) {
  const updateFood = useStore((s) => s.updateFood);
  const trackMacros = useStore((s) => s.profile.trackMacros);
  const toast = useToast();
  const [name, setName] = useState(entry.name);
  const [meal, setMeal] = useState<MealType>(entry.meal);
  const [cal, setCal] = useState(String(entry.calories));
  const [p, setP] = useState(String(entry.protein));
  const [c, setC] = useState(String(entry.carbs));
  const [f, setF] = useState(String(entry.fat));
  const [touched, setTouched] = useState(false);

  const nameErr = touched && !name.trim() ? "Give it a name" : undefined;
  const calErr = touched && !(Number(cal) > 0) ? "Enter calories" : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!name.trim() || !(Number(cal) > 0)) return;
    const next = {
      name: name.trim(),
      meal,
      calories: Math.round(Number(cal)),
      protein: Number(p) || 0,
      carbs: Number(c) || 0,
      fat: Number(f) || 0,
    };
    const patch = Object.fromEntries(Object.entries(next).filter(([k, v]) => entry[k as keyof typeof next] !== v));
    if (Object.keys(patch).length) {
      updateFood(entry.id, patch);
      toast(`${next.name} updated`);
    }
    onDone();
  };

  const num = (v: string) => v.replace(/[^\d.]/g, "");

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Food name" htmlFor="e-name" error={nameErr}>
        <Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-muted">Meal</span>
        <Segmented label="Meal" className="w-full" value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: MEAL_LABEL[m] }))} />
      </div>
      <Field label="Calories" htmlFor="e-cal" error={calErr}>
        <Input id="e-cal" inputMode="numeric" suffix="kcal" value={cal} onChange={(e) => setCal(num(e.target.value))} />
      </Field>
      {trackMacros && (
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-muted">Macros</legend>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Protein" htmlFor="e-p">
              <Input id="e-p" inputMode="decimal" suffix="g" value={p} onChange={(e) => setP(num(e.target.value))} />
            </Field>
            <Field label="Carbs" htmlFor="e-c">
              <Input id="e-c" inputMode="decimal" suffix="g" value={c} onChange={(e) => setC(num(e.target.value))} />
            </Field>
            <Field label="Fat" htmlFor="e-f">
              <Input id="e-f" inputMode="decimal" suffix="g" value={f} onChange={(e) => setF(num(e.target.value))} />
            </Field>
          </div>
        </fieldset>
      )}
      <Button type="submit" size="lg" className="w-full">
        Save changes
      </Button>
    </form>
  );
}
