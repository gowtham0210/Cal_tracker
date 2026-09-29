"use client";

import clsx from "clsx";
import { Camera, Plus, Sparkles, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { DayNav } from "@/components/day-nav";
import { Card, EmptyState, PageHeader, ProgressBar } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { MacroBars, SuggestionsCard } from "@/components/widgets";
import { dayTotals, fmtInt } from "@/lib/calc";
import { todayKey } from "@/lib/date";
import { useStore } from "@/lib/store";
import type { FoodEntry } from "@/lib/types";
import { MEALS, MEAL_EMOJI, MEAL_LABEL, useUI } from "@/lib/ui";

const SOURCE_LABEL: Record<NonNullable<FoodEntry["source"]>, string> = {
  manual: "",
  favorite: "Favorite",
  "ai-text": "AI",
  "ai-photo": "Photo",
};

export function FoodView() {
  const [date, setDate] = useState(todayKey());
  const foods = useStore((s) => s.foods);
  const exercises = useStore((s) => s.exercises);
  const favorites = useStore((s) => s.favorites);
  const profile = useStore((s) => s.profile);
  const removeFood = useStore((s) => s.removeFood);
  const restoreFood = useStore((s) => s.restoreFood);
  const addFavorite = useStore((s) => s.addFavorite);
  const removeFavorite = useStore((s) => s.removeFavorite);
  const updateFood = useStore((s) => s.updateFood);
  const open = useUI((s) => s.open);
  const toast = useToast();

  const t = dayTotals(date, foods, exercises);
  const remaining = profile.calorieGoal - t.net;
  const dayFoods = foods.filter((f) => f.date === date);
  const isFav = (name: string) => favorites.find((f) => f.name.toLowerCase() === name.toLowerCase());

  const del = (f: FoodEntry) => {
    removeFood(f.id);
    toast(`Removed ${f.name}`, { tone: "info", action: { label: "Undo", onClick: () => restoreFood(f) } });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Food log"
        subtitle="Log meals in seconds — type it, snap it, or pick a favorite."
        action={<DayNav date={date} onChange={setDate} />}
      />

      {/* Quick methods */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "Describe it", sub: "AI fills calories", icon: Sparkles, tab: "describe" as const },
          { label: "Snap a photo", sub: "AI estimate", icon: Camera, tab: "photo" as const },
          { label: "Favorites", sub: `${favorites.length} saved`, icon: Star, tab: "favorites" as const },
        ].map((m) => (
          <button
            key={m.label}
            onClick={() => open("food", { tab: m.tab, date })}
            className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-surface p-3 text-left shadow-card transition hover:border-brand/60 active:scale-[0.98] sm:flex-row sm:items-center sm:p-4"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
              <m.icon className="size-[18px]" />
            </span>
            <span>
              <span className="block text-sm font-semibold">{m.label}</span>
              <span className="block text-xs text-muted">{m.sub}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Summary */}
      <Card>
        <div className="grid grid-cols-3 gap-3 text-center sm:text-left">
          <div>
            <p className="text-xs text-muted">Eaten</p>
            <p className="tabular text-xl font-semibold">{fmtInt(t.calories)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Burned</p>
            <p className="tabular text-xl font-semibold text-burn">{fmtInt(t.burned)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">{remaining >= 0 ? "Remaining" : "Over"}</p>
            <p className={clsx("tabular text-xl font-semibold", remaining < 0 ? "text-danger" : "text-brand")}>
              {fmtInt(Math.abs(remaining))}
            </p>
          </div>
        </div>
        <ProgressBar
          className="mt-4"
          value={t.net}
          max={profile.calorieGoal}
          color={remaining < 0 ? "var(--danger)" : "var(--brand)"}
          label="Net calories vs goal"
        />
        {profile.trackMacros && (
          <div className="mt-5 border-t border-border pt-4">
            <MacroBars date={date} compact />
          </div>
        )}
      </Card>

      {/* Meals */}
      <div className="grid gap-4 md:grid-cols-2">
        {MEALS.map((meal) => {
          const items = dayFoods.filter((f) => f.meal === meal).sort((a, b) => a.createdAt - b.createdAt);
          const kcal = items.reduce((s, f) => s + f.calories, 0);
          return (
            <Card key={meal} className="!p-0">
              <div className="flex items-center gap-3 px-4 pb-2 pt-4 sm:px-5">
                <span className="text-xl" aria-hidden>
                  {MEAL_EMOJI[meal]}
                </span>
                <h2 className="flex-1 font-semibold">{MEAL_LABEL[meal]}</h2>
                <span className="tabular text-sm text-muted">{kcal} kcal</span>
              </div>
              {items.length ? (
                <ul className="divide-y divide-border">
                  {items.map((f) => {
                    const fav = isFav(f.name);
                    return (
                      <li key={f.id} className="group flex items-center gap-2 px-4 py-2.5 sm:px-5">
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                            <span className="truncate">{f.name}</span>
                            {f.source && SOURCE_LABEL[f.source] && (
                              <span className="shrink-0 rounded bg-surface-2 px-1 text-[10px] font-semibold uppercase text-muted">
                                {SOURCE_LABEL[f.source]}
                              </span>
                            )}
                          </p>
                          {profile.trackMacros && (
                            <p className="tabular text-xs text-muted">
                              P {f.protein}g · C {f.carbs}g · F {f.fat}g
                            </p>
                          )}
                        </div>
                        <input
                          aria-label={`Calories for ${f.name}`}
                          inputMode="numeric"
                          defaultValue={f.calories}
                          key={f.calories}
                          onBlur={(e) => {
                            const v = Number(e.target.value.replace(/\D/g, ""));
                            if (v > 0 && v !== f.calories) {
                              updateFood(f.id, { calories: v });
                              toast("Calories updated");
                            } else e.target.value = String(f.calories);
                          }}
                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                          className="tabular h-8 w-14 rounded-lg border border-transparent bg-transparent px-1.5 text-right text-sm font-semibold outline-none transition hover:border-border focus:border-brand focus:bg-surface"
                        />
                        <button
                          aria-label={fav ? `Remove ${f.name} from favorites` : `Save ${f.name} as favorite`}
                          aria-pressed={!!fav}
                          onClick={() => {
                            if (fav) {
                              removeFavorite(fav.id);
                              toast("Removed from favorites", { tone: "info" });
                            } else {
                              addFavorite({
                                name: f.name,
                                calories: f.calories,
                                protein: f.protein,
                                carbs: f.carbs,
                                fat: f.fat,
                                meal: f.meal,
                              });
                              toast("Saved to favorites");
                            }
                          }}
                          className="grid size-8 place-items-center rounded-lg text-subtle transition hover:bg-surface-2 hover:text-amber-500"
                        >
                          <Star className={clsx("size-4", fav && "fill-amber-400 text-amber-400")} />
                        </button>
                        <button
                          aria-label={`Delete ${f.name}`}
                          onClick={() => del(f)}
                          className="grid size-8 place-items-center rounded-lg text-subtle transition hover:bg-surface-2 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-4 pb-1 text-sm text-subtle sm:px-5">Nothing logged yet</p>
              )}
              <div className="p-2">
                <button
                  onClick={() => open("food", { meal, date })}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium text-brand transition hover:bg-brand-soft"
                >
                  <Plus className="size-4" /> Add to {MEAL_LABEL[meal].toLowerCase()}
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {!dayFoods.length && date !== todayKey() && (
        <Card>
          <EmptyState
            icon={<Sparkles className="size-5" />}
            title="No food logged this day"
            description="Missed a day? Backfill it now so your trends stay accurate."
          />
        </Card>
      )}

      {date === todayKey() && <SuggestionsCard date={date} />}
      {date === todayKey() && (
        <p className="text-center text-xs text-subtle">Tip: tap a calorie number to edit it. Star an item to save it as a favorite.</p>
      )}
    </div>
  );
}
