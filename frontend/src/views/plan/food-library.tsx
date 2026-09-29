"use client";

import clsx from "clsx";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Segmented, Skeleton } from "@/components/ui";
import { api, ApiError, type LibraryFood, type LibraryTab } from "@/lib/api";
import { useStore } from "@/lib/store";
import { CUISINE_LABEL, type MealType } from "@/lib/types";
import { MEAL_EMOJI, MEAL_LABEL, MEALS } from "@/lib/ui";

const TABS: { value: Exclude<LibraryTab, "all" | "new">; label: string }[] = [
  { value: "usual", label: "Usual" },
  { value: "favorites", label: "Favorites" },
];

/** Fetches library foods for the current tab, meal and search, debouncing typing. */
function useLibrary(tab: LibraryTab, meal: MealType | undefined, q: string) {
  const [foods, setFoods] = useState<LibraryFood[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const t = setTimeout(
      () => {
        api
          .library({ tab, meal, q: q.trim() || undefined })
          .then((d) => live && (setFoods(d), setError(null)))
          .catch((e) => live && setError(e instanceof ApiError ? e.problem.title : "Couldn't load your foods."));
      },
      q ? 250 : 0,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [tab, meal, q]);
  return { foods, error };
}

export interface FoodLibraryProps {
  /** Pre-selects a meal filter, e.g. when adding to a specific slot. */
  meal?: MealType;
  /** Rendered on each card, e.g. an Add button or a drag handle. */
  renderAction?: (food: LibraryFood) => ReactNode;
  /** Wraps each card, e.g. to make it draggable. */
  wrapCard?: (food: LibraryFood, card: ReactNode) => ReactNode;
  className?: string;
}

export function FoodLibrary({ meal: initialMeal, renderAction, wrapCard, className }: FoodLibraryProps) {
  const [tab, setTab] = useState<Exclude<LibraryTab, "all" | "new">>("usual");
  const [meal, setMeal] = useState<MealType | undefined>(initialMeal);
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const cuisine = useStore((s) => s.profile?.cuisine ?? "tamil-nadu");
  const { foods, error } = useLibrary(tab, meal, q);

  // Group "usual" into the user's own foods and curated dishes, so it's clear where each comes from.
  const own = foods?.filter((f) => f.useCount > 0 || f.source !== "curated") ?? [];
  const curated = foods?.filter((f) => f.useCount === 0 && f.source === "curated") ?? [];
  const searching = q.trim().length > 0;

  const card = (f: LibraryFood) => {
    const content = (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2.5 transition hover:border-brand/50">
        <span className="text-xl" aria-hidden>
          {MEAL_EMOJI[f.meal]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium leading-snug">{f.name}</p>
          <p className="tabular mt-0.5 text-xs text-muted">
            {f.serving} · {Math.round(f.calories)} kcal
          </p>
        </div>
        {renderAction?.(f)}
      </div>
    );
    return <li key={f.id}>{wrapCard ? wrapCard(f, content) : content}</li>;
  };

  return (
    <div className={clsx("flex min-h-0 flex-col gap-3", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
        <label htmlFor="library-search" className="sr-only">
          Search foods
        </label>
        <input
          ref={searchRef}
          id="library-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search foods"
          className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-9 text-sm outline-none transition placeholder:text-subtle focus:border-brand focus:ring-4 focus:ring-brand/15"
        />
        {searching && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => (setQ(""), searchRef.current?.focus())}
            className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-subtle hover:text-text"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {!searching && <Segmented label="Library" value={tab} onChange={setTab} options={TABS} className="w-full" size="sm" />}

      <div role="group" aria-label="Filter by meal" className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {[undefined, ...MEALS].map((m) => (
          <button
            key={m ?? "all"}
            type="button"
            aria-pressed={meal === m}
            onClick={() => setMeal(m)}
            className={clsx(
              "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition",
              meal === m ? "border-brand bg-brand-soft text-brand-strong" : "border-border text-muted hover:text-text",
            )}
          >
            {m ? MEAL_LABEL[m] : "All meals"}
          </button>
        ))}
      </div>

      {/* Focusable so keyboard users can scroll the list (WCAG 2.1.1). */}
      <div
        role="region"
        aria-label="Foods"
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto rounded-xl focus-visible:outline-2 focus-visible:outline-brand"
        aria-live="polite"
        aria-busy={!foods && !error}
      >
        {error ? (
          <p role="alert" className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
            {error}
          </p>
        ) : !foods ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : foods.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted">
            {searching ? `No foods match "${q.trim()}".` : tab === "favorites" ? "No favorites yet. Star a food in your log to add it here." : "No foods yet."}
          </p>
        ) : tab === "usual" && !searching ? (
          <div className="space-y-4">
            {own.length > 0 && (
              <section aria-label="Your foods">
                <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">Your foods</h3>
                <ul className="space-y-2">{own.map(card)}</ul>
              </section>
            )}
            {curated.length > 0 && (
              <section aria-label="Suggested dishes">
                <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  {cuisine === "any" ? "Popular dishes" : `${CUISINE_LABEL[cuisine]} dishes`}
                </h3>
                <ul className="space-y-2">{curated.map(card)}</ul>
              </section>
            )}
          </div>
        ) : (
          <ul className="space-y-2">{foods.map(card)}</ul>
        )}
      </div>
    </div>
  );
}
