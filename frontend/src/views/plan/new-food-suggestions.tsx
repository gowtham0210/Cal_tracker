"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Button, Chip, Field, Input, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, type NewFoodSuggestion } from "@/lib/api";
import { DIET_LABEL, type MealType } from "@/lib/types";

const CONFIDENCE = { high: "High confidence", medium: "Medium confidence", low: "Low confidence: check it" } as const;
type Draft = Record<"name" | "serving" | "calories" | "protein" | "carbs" | "fat", string>;
const NUMBERS = ["calories", "protein", "carbs", "fat"] as const;
const MAX = { calories: 5000, protein: 500, carbs: 1000, fat: 500 };

/**
 * "Try new": AI suggestions close to what the user eats. Each is reviewed (and can be edited)
 * before it's saved to the library; nothing is added without the user saying so.
 */
export function NewFoodSuggestions({ meal, onAdded }: { meal?: MealType; onAdded: () => void }) {
  const toast = useToast();
  const [state, setState] = useState<{ loading: boolean; error?: string; items?: NewFoodSuggestion[] }>({ loading: false });
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const ask = async () => {
    setOpen(null);
    setState({ loading: true });
    try {
      setState({ loading: false, items: await api.suggestNewFoods(meal) });
    } catch (e) {
      setState({ loading: false, error: e instanceof ApiError ? e.problem.title : "Couldn't get suggestions." });
    }
  };
  const review = (s: NewFoodSuggestion) => {
    setOpen(s.name);
    setDraft({ name: s.name, serving: s.serving, calories: String(s.calories), protein: String(s.protein), carbs: String(s.carbs), fat: String(s.fat) });
  };
  const invalid = draft && (!draft.name.trim() || !draft.serving.trim() || NUMBERS.some((k) => draft[k] === "" || !(Number(draft[k]) >= 0) || Number(draft[k]) > MAX[k]));
  const save = async (s: NewFoodSuggestion) => {
    if (!draft || invalid) return;
    setSaving(true);
    try {
      await api.addLibraryFood({
        name: draft.name.trim(),
        serving: draft.serving.trim(),
        meal: s.meal,
        calories: Number(draft.calories),
        protein: Number(draft.protein),
        carbs: Number(draft.carbs),
        fat: Number(draft.fat),
        confidence: s.confidence,
        cuisine: s.cuisine,
        diet: s.diet,
        allergens: s.allergens,
      });
      toast(`Added ${draft.name.trim()} to your library`);
      setState((st) => ({ ...st, items: st.items?.filter((x) => x !== s) }));
      setOpen(null);
      onAdded();
    } catch (e) {
      toast(e instanceof ApiError ? (e.problem.errors?.[0]?.detail ?? e.problem.title) : "Couldn't save that food.", { tone: "error" });
    }
    setSaving(false);
  };

  return (
    <section aria-label="Suggestions" className="space-y-2">
      <Button variant="outline" size="sm" className="w-full" onClick={ask} disabled={state.loading}>
        {state.loading ? <Spinner className="size-4" /> : <Sparkles className="size-4" />} {state.items ? "Suggest others" : "Suggest foods to try"}
      </Button>
      {state.error && (
        <p role="alert" className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
          {state.error}
        </p>
      )}
      {state.items?.length === 0 && <p className="px-1 text-sm text-muted">No new ideas this time. Try again, or pick a different meal.</p>}
      <ul className="space-y-2">
        {state.items?.map((s) => (
          <li key={s.name} className="rounded-xl border border-dashed border-brand/50 bg-surface p-2.5">
            <p className="text-sm font-medium leading-snug">{s.name}</p>
            <p className="mt-0.5 text-xs text-muted">{s.basedOn ? `You eat ${s.basedOn}, so try this. ${s.reason}` : s.reason}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="tabular text-xs text-muted">
                {s.serving} · {Math.round(s.calories)} kcal · P {s.protein} g · C {s.carbs} g · F {s.fat} g
              </span>
              <Chip tone={s.confidence === "low" ? "warn" : "neutral"}>{CONFIDENCE[s.confidence]}</Chip>
              <Chip>{DIET_LABEL[s.diet]}</Chip>
              {s.allergens.length > 0 && <Chip>Contains {s.allergens.join(", ")}</Chip>}
            </div>
            {open === s.name && draft ? (
              <form
                className="mt-3 space-y-2 border-t border-border pt-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save(s);
                }}
              >
                <p className="text-xs text-muted">Estimated by AI. Check the numbers for one serving before saving.</p>
                <Field label="Name" htmlFor={`nf-name-${s.name}`}>
                  <Input id={`nf-name-${s.name}`} value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </Field>
                <Field label="Serving" htmlFor={`nf-serving-${s.name}`}>
                  <Input id={`nf-serving-${s.name}`} value={draft.serving} maxLength={60} onChange={(e) => setDraft({ ...draft, serving: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  {NUMBERS.map((k) => (
                    <Field key={k} label={k === "calories" ? "Calories" : `${k[0].toUpperCase()}${k.slice(1)}`} htmlFor={`nf-${k}-${s.name}`}>
                      <Input
                        id={`nf-${k}-${s.name}`}
                        inputMode="decimal"
                        suffix={k === "calories" ? "kcal" : "g"}
                        value={draft[k]}
                        onChange={(e) => setDraft({ ...draft, [k]: e.target.value.replace(/[^\d.]/g, "") })}
                      />
                    </Field>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={saving || !!invalid}>
                    Save to library
                  </Button>
                </div>
              </form>
            ) : (
              <Button variant="ghost" size="sm" className="mt-1 -ml-2" onClick={() => review(s)} aria-label={`Review ${s.name}`}>
                Review and add
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
