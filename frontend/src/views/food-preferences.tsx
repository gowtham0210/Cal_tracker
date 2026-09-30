"use client";

import clsx from "clsx";
import { Check, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button, Card, CardHeader, Field, Input, Segmented } from "@/components/ui";
import { useStore } from "@/lib/store";
import { COMMON_ALLERGENS, DIET_LABEL, type Budget, type DietType } from "@/lib/types";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
type BudgetChoice = Budget | "amount";

/** Common allergy chips, the user's own allergies, and a box to add one. Saves as it changes. */
export function AllergyEditor({ idPrefix, className }: { idPrefix: string; className?: string }) {
  const allergies = useStore((s) => s.profile.allergies);
  const updateProfile = useStore((s) => s.updateProfile);
  const [other, setOther] = useState("");
  const custom = allergies.filter((a) => !(COMMON_ALLERGENS as readonly string[]).includes(a));
  const setAllergies = (next: string[]) => updateProfile({ allergies: next });
  const toggle = (a: string) => setAllergies(allergies.includes(a) ? allergies.filter((x) => x !== a) : [...allergies, a]);
  const addOther = () => {
    const a = other.trim().toLowerCase();
    if (!a || a.length > 40) return;
    if (!allergies.includes(a)) setAllergies([...allergies, a]);
    setOther("");
  };

  return (
    <div className={className}>
      <div role="group" aria-label="Common allergies" className="flex flex-wrap gap-1.5">
        {COMMON_ALLERGENS.map((a) => {
          const on = allergies.includes(a);
          return (
            <button
              key={a}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(a)}
              className={clsx(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium transition",
                on ? "border-brand bg-brand-soft text-brand-strong" : "border-border text-muted hover:text-text",
              )}
            >
              {on && <Check className="size-3.5" aria-hidden />}
              {capitalize(a)}
            </button>
          );
        })}
      </div>
      {custom.length > 0 && (
        <ul aria-label="Your other allergies" className="mt-2 flex flex-wrap gap-1.5">
          {custom.map((a) => (
            <li key={a} className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-1 pl-3 pr-1 text-sm font-medium text-brand-strong">
              {capitalize(a)}
              <button type="button" aria-label={`Remove ${a}`} onClick={() => setAllergies(allergies.filter((x) => x !== a))} className="grid size-5 place-items-center rounded-full hover:bg-brand/15">
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-end gap-2">
        <Field label="Other allergy" htmlFor={`${idPrefix}-other-allergy`} className="flex-1">
          <Input
            id={`${idPrefix}-other-allergy`}
            value={other}
            maxLength={40}
            placeholder="e.g. brinjal"
            onChange={(e) => setOther(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              addOther();
            }}
          />
        </Field>
        <Button variant="outline" onClick={addOther} disabled={!other.trim()}>
          <Plus className="size-4" /> Add
        </Button>
      </div>
    </div>
  );
}

/** Settings card for diet type, allergies and budget, which shape the planner. */
export function FoodPreferences() {
  const profile = useStore((s) => s.profile);
  const updateProfile = useStore((s) => s.updateProfile);
  const { dietType, budget, dailyBudget } = profile;
  // "Daily amount" can be picked before an amount is typed.
  const [amountMode, setAmountMode] = useState(dailyBudget !== null);
  const [amount, setAmount] = useState(dailyBudget === null ? "" : String(dailyBudget));
  const [amountError, setAmountError] = useState<string>();
  // Follow the saved amount when it changes underneath (a failed save rolls back).
  const [prevBudget, setPrevBudget] = useState(dailyBudget);
  if (prevBudget !== dailyBudget) {
    setPrevBudget(dailyBudget);
    setAmount(dailyBudget === null ? "" : String(dailyBudget));
    if (dailyBudget !== null) setAmountMode(true);
  }

  const choice: BudgetChoice = amountMode ? "amount" : budget;
  const chooseBudget = (v: BudgetChoice) => {
    setAmountMode(v === "amount");
    if (v !== "amount") updateProfile({ budget: v, dailyBudget: null });
  };
  const commitAmount = () => {
    const n = Number(amount);
    if (!amount || !Number.isInteger(n) || n < 1 || n > 100_000) {
      setAmountError("Enter a whole number of rupees, 1 to 100000");
      return;
    }
    setAmountError(undefined);
    if (n !== dailyBudget) updateProfile({ dailyBudget: n });
  };

  return (
    <Card aria-labelledby="food-prefs-title">
      <CardHeader title={<span id="food-prefs-title">Food preferences</span>} subtitle="Shape meal plans and suggestions" />
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Diet type</p>
            <p className="text-xs text-muted">For meal plan suggestions</p>
          </div>
          <Segmented<DietType>
            label="Diet type"
            value={dietType}
            onChange={(v) => updateProfile({ dietType: v })}
            options={(Object.keys(DIET_LABEL) as DietType[]).map((v) => ({ value: v, label: DIET_LABEL[v] }))}
          />
        </div>

        <div>
          <p className="text-sm font-medium">Allergies</p>
          <p className="text-xs text-muted">Foods with these are flagged in your plan and library</p>
          <AllergyEditor idPrefix="s" className="mt-2" />
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Budget</p>
              <p className="text-xs text-muted">A guide for suggestions, not a cost calculation</p>
            </div>
            <Segmented<BudgetChoice>
              label="Budget"
              value={choice}
              onChange={chooseBudget}
              options={[
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
                { value: "amount", label: "Daily amount" },
              ]}
            />
          </div>
          {amountMode && (
            <Field label="Daily budget" htmlFor="s-daily-budget" error={amountError} className="mt-3 sm:max-w-56">
              <Input
                id="s-daily-budget"
                inputMode="numeric"
                suffix="₹ / day"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                onBlur={commitAmount}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              />
            </Field>
          )}
        </div>
      </div>
    </Card>
  );
}
