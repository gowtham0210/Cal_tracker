"use client";

import clsx from "clsx";
import { Camera, Check, ImagePlus, PenLine, Sparkles, Star, Trash2, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { aiEstimatePhoto, aiParseFood } from "@/lib/ai";
import { todayKey } from "@/lib/date";
import type { ParsedFood } from "@/lib/foods";
import { useStore } from "@/lib/store";
import type { MealType } from "@/lib/types";
import { MEALS, MEAL_EMOJI, MEAL_LABEL, useUI, type FoodTab } from "@/lib/ui";
import { Button, Chip, EmptyState, Field, Input, Sheet, Skeleton, Textarea } from "../ui";
import { useToast } from "../ui/toast";

const TABS: { value: FoodTab; label: string; icon: typeof Sparkles }[] = [
  { value: "describe", label: "Describe", icon: Sparkles },
  { value: "photo", label: "Photo", icon: Camera },
  { value: "manual", label: "Manual", icon: PenLine },
  { value: "favorites", label: "Favorites", icon: Star },
];

export function FoodDialog() {
  const { dialog, close } = useUI();
  return (
    <Sheet open={dialog === "food"} onClose={close} title="Log food" description="Pick the fastest way to add what you ate." wide>
      <FoodDialogBody />
    </Sheet>
  );
}

function FoodDialogBody() {
  const { foodMeal, foodTab, setFoodTab, date } = useUI();
  // Body mounts fresh each time the sheet opens, so this picks up the requested meal
  const [meal, setMeal] = useState<MealType>(foodMeal);

  return (
    <>
      <div className="mb-4">
        <p className="mb-2 text-[13px] font-medium text-muted">Meal</p>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Meal">
          {MEALS.map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={meal === m}
              onClick={() => setMeal(m)}
              className={clsx(
                "flex flex-col items-center gap-0.5 rounded-xl border py-2 text-xs font-medium transition",
                meal === m ? "border-brand bg-brand-soft text-brand-strong" : "border-border text-muted hover:bg-surface-2",
              )}
            >
              <span className="text-lg" aria-hidden>
                {MEAL_EMOJI[m]}
              </span>
              {MEAL_LABEL[m]}
            </button>
          ))}
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Logging method"
        className="no-scrollbar -mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-border px-1"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={foodTab === t.value}
              onClick={() => setFoodTab(t.value)}
              className={clsx(
                "-mb-px flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-2 py-2.5 text-sm font-medium transition sm:flex-none sm:px-3",
                foodTab === t.value ? "border-brand text-text" : "border-transparent text-muted hover:text-text",
              )}
            >
              <Icon className="hidden size-4 sm:block" />
              {t.label}
              {(t.value === "describe" || t.value === "photo") && (
                <>
                  <Sparkles className="size-3 text-brand sm:hidden" aria-label="AI" />
                  <span className="hidden rounded bg-brand-soft px-1 text-[10px] font-semibold uppercase text-brand-strong sm:inline">
                    AI
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {foodTab === "describe" && <DescribeTab meal={meal} date={date} />}
        {foodTab === "photo" && <PhotoTab meal={meal} date={date} />}
        {foodTab === "manual" && <ManualTab meal={meal} date={date} />}
        {foodTab === "favorites" && <FavoritesTab meal={meal} date={date} />}
      </div>
    </>
  );
}

/* ---------------- AI review list (shared by Describe & Photo) ---------------- */
function ReviewList({
  items,
  setItems,
  meal,
  date,
  source,
  note,
}: {
  items: (ParsedFood & { keep: boolean })[];
  setItems: (i: (ParsedFood & { keep: boolean })[]) => void;
  meal: MealType;
  date?: string;
  source: "ai-text" | "ai-photo";
  note: string;
}) {
  const addFood = useStore((s) => s.addFood);
  const close = useUI((s) => s.close);
  const toast = useToast();
  const kept = items.filter((i) => i.keep);
  const total = kept.reduce((s, i) => s + (Number(i.calories) || 0), 0);

  const update = (idx: number, patch: Partial<ParsedFood & { keep: boolean }>) =>
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const save = () => {
    for (const i of kept) {
      addFood({
        date: date ?? todayKey(),
        meal,
        name: i.quantity !== 1 && !/^\d/.test(i.name) ? `${i.name} ×${i.quantity}` : i.name,
        calories: Math.round(Number(i.calories) || 0),
        protein: i.protein,
        carbs: i.carbs,
        fat: i.fat,
        source,
      });
    }
    toast(`Added ${kept.length} item${kept.length === 1 ? "" : "s"} · ${total} kcal to ${MEAL_LABEL[meal]}`);
    close();
  };

  return (
    <div className="animate-fade-up">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">Review & edit</p>
        <p className="text-xs text-muted">{note}</p>
      </div>
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {items.map((it, idx) => (
          <li key={idx} className={clsx("flex items-center gap-3 p-3 transition", !it.keep && "opacity-45")}>
            <button
              aria-label={it.keep ? `Exclude ${it.name}` : `Include ${it.name}`}
              aria-pressed={it.keep}
              onClick={() => update(idx, { keep: !it.keep })}
              className={clsx(
                "grid size-6 shrink-0 place-items-center rounded-md border transition",
                it.keep ? "border-brand bg-brand text-brand-contrast" : "border-border",
              )}
            >
              {it.keep && <Check className="size-4" />}
            </button>
            <div className="min-w-0 flex-1">
              <input
                aria-label="Food name"
                value={it.name}
                onChange={(e) => update(idx, { name: e.target.value })}
                className="w-full truncate bg-transparent font-medium outline-none focus:underline"
              />
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <span>
                  {it.quantity !== 1 && `${it.quantity} × `}
                  {it.serving}
                </span>
                <span aria-hidden>·</span>
                <span>
                  P {it.protein} · C {it.carbs} · F {it.fat}
                </span>
                {it.confidence !== "high" && <Chip tone={it.confidence === "low" ? "warn" : "neutral"}>{it.confidence} confidence</Chip>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <input
                aria-label={`Calories for ${it.name}`}
                inputMode="numeric"
                value={it.calories}
                onChange={(e) => update(idx, { calories: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                className="tabular h-9 w-16 rounded-lg border border-border bg-surface px-2 text-right text-sm outline-none focus:border-brand"
              />
              <span className="text-xs text-muted">kcal</span>
            </div>
          </li>
        ))}
      </ul>
      <Button className="mt-4 w-full" size="lg" onClick={save} disabled={!kept.length}>
        Add {kept.length} item{kept.length === 1 ? "" : "s"} · {total} kcal
      </Button>
    </div>
  );
}

/* ---------------- Describe (natural language) ---------------- */
const EXAMPLES = ["2 eggs, toast and a coffee", "chicken curry with rice", "3 idli and sambar", "a banana and handful of almonds"];

function DescribeTab({ meal, date }: { meal: MealType; date?: string }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<(ParsedFood & { keep: boolean })[] | null>(null);

  const run = async (value = text) => {
    if (!value.trim()) return;
    setLoading(true);
    setItems(null);
    const res = await aiParseFood(value);
    setItems(res.map((r) => ({ ...r, keep: true })));
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <label htmlFor="nl-food" className="sr-only">
          Describe what you ate
        </label>
        <Textarea
          id="nl-food"
          placeholder="e.g. 2 scrambled eggs, a slice of toast and a latte"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void run();
            }
          }}
          rows={3}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              type="button"
              key={ex}
              onClick={() => {
                setText(ex);
                void run(ex);
              }}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted transition hover:border-brand hover:text-text"
            >
              {ex}
            </button>
          ))}
        </div>
        <Button type="submit" className="mt-4 w-full" size="lg" loading={loading} disabled={!text.trim()}>
          {!loading && <Wand2 className="size-4" />}
          {loading ? "Estimating…" : "Estimate calories"}
        </Button>
      </form>

      {loading && (
        <div className="space-y-2" aria-label="Loading estimate">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      )}
      {items && items.length === 0 && (
        <EmptyState
          icon={<Sparkles className="size-5" />}
          title="Couldn't recognise that"
          description="Try naming foods more simply, or switch to Manual entry."
        />
      )}
      {items && items.length > 0 && (
        <ReviewList items={items} setItems={setItems} meal={meal} date={date} source="ai-text" note="Tap any value to adjust" />
      )}
    </div>
  );
}

/* ---------------- Photo ---------------- */
function PhotoTab({ meal, date }: { meal: MealType; date?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<(ParsedFood & { keep: boolean })[] | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const onFile = async (file?: File) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setItems(null);
    setLoading(true);
    const res = await aiEstimatePhoto(file);
    setItems(res.map((r) => ({ ...r, keep: true })));
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Upload a meal photo"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {!preview ? (
        <button
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void onFile(e.dataTransfer.files?.[0]);
          }}
          className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border px-6 py-10 text-center transition hover:border-brand hover:bg-brand-soft/40"
        >
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand-strong">
            <ImagePlus className="size-7" />
          </span>
          <span className="font-medium">Snap or upload your plate</span>
          <span className="max-w-xs text-sm text-muted">
            We&apos;ll identify each item and estimate calories. You can edit everything before saving.
          </span>
        </button>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Your meal" className="h-52 w-full object-cover" />
          {loading && (
            <div className="absolute inset-0 grid place-items-center bg-black/45 text-white">
              <div className="flex flex-col items-center gap-2">
                <Sparkles className="size-6 animate-pulse" />
                <span className="text-sm font-medium">Analyzing your plate…</span>
              </div>
            </div>
          )}
          {!loading && (
            <Button
              size="sm"
              variant="secondary"
              className="absolute right-3 top-3 bg-surface/90 backdrop-blur"
              onClick={() => fileRef.current?.click()}
            >
              Retake
            </Button>
          )}
        </div>
      )}
      {items && (
        <ReviewList items={items} setItems={setItems} meal={meal} date={date} source="ai-photo" note="Estimates — adjust portions" />
      )}
    </div>
  );
}

/* ---------------- Manual ---------------- */
function ManualTab({ meal, date }: { meal: MealType; date?: string }) {
  const addFood = useStore((s) => s.addFood);
  const addFavorite = useStore((s) => s.addFavorite);
  const trackMacros = useStore((s) => s.profile.trackMacros);
  const close = useUI((s) => s.close);
  const toast = useToast();
  const [name, setName] = useState("");
  const [cal, setCal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  const [fav, setFav] = useState(false);
  const [touched, setTouched] = useState(false);

  const nameErr = touched && !name.trim() ? "Give it a name" : undefined;
  const calErr = touched && !(Number(cal) > 0) ? "Enter calories" : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!name.trim() || !(Number(cal) > 0)) return;
    const entry = {
      name: name.trim(),
      calories: Math.round(Number(cal)),
      protein: Number(p) || 0,
      carbs: Number(c) || 0,
      fat: Number(f) || 0,
    };
    addFood({ ...entry, date: date ?? todayKey(), meal, source: "manual" });
    if (fav) addFavorite({ ...entry, meal });
    toast(`${entry.name} added to ${MEAL_LABEL[meal]}${fav ? " and favorites" : ""}`);
    close();
  };

  const num = (v: string) => v.replace(/[^\d.]/g, "");

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Food name" htmlFor="m-name" error={nameErr}>
        <Input id="m-name" placeholder="e.g. Chicken wrap" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </Field>
      <Field label="Calories" htmlFor="m-cal" error={calErr}>
        <Input id="m-cal" inputMode="numeric" placeholder="0" suffix="kcal" value={cal} onChange={(e) => setCal(num(e.target.value))} />
      </Field>
      {trackMacros && (
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-muted">
            Macros <span className="font-normal text-subtle">(optional)</span>
          </legend>
          <div className="grid grid-cols-3 gap-2">
            <Input
              aria-label="Protein grams"
              inputMode="decimal"
              placeholder="Protein"
              suffix="g"
              value={p}
              onChange={(e) => setP(num(e.target.value))}
            />
            <Input
              aria-label="Carbs grams"
              inputMode="decimal"
              placeholder="Carbs"
              suffix="g"
              value={c}
              onChange={(e) => setC(num(e.target.value))}
            />
            <Input
              aria-label="Fat grams"
              inputMode="decimal"
              placeholder="Fat"
              suffix="g"
              value={f}
              onChange={(e) => setF(num(e.target.value))}
            />
          </div>
        </fieldset>
      )}
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-sm">
        <input type="checkbox" checked={fav} onChange={(e) => setFav(e.target.checked)} className="size-4 accent-[var(--brand)]" />
        <Star className={clsx("size-4", fav ? "fill-amber-400 text-amber-400" : "text-subtle")} />
        Save to favorites for one-tap logging
      </label>
      <Button type="submit" size="lg" className="w-full">
        Add to {MEAL_LABEL[meal]}
      </Button>
    </form>
  );
}

/* ---------------- Favorites ---------------- */
function FavoritesTab({ meal, date }: { meal: MealType; date?: string }) {
  const favorites = useStore((s) => s.favorites);
  const addFood = useStore((s) => s.addFood);
  const removeFavorite = useStore((s) => s.removeFavorite);
  const setFoodTab = useUI((s) => s.setFoodTab);
  const toast = useToast();
  const [q, setQ] = useState("");
  const [added, setAdded] = useState<string | null>(null);

  const list = useMemo(
    () =>
      [...favorites]
        .filter((f) => f.name.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => Number(b.meal === meal) - Number(a.meal === meal)),
    [favorites, q, meal],
  );

  if (!favorites.length)
    return (
      <EmptyState
        icon={<Star className="size-5" />}
        title="No favorites yet"
        description="Save foods you eat often and re-log them with one tap."
        action={
          <Button variant="secondary" size="sm" onClick={() => setFoodTab("manual")}>
            Add a food
          </Button>
        }
      />
    );

  return (
    <div className="space-y-3">
      <Input aria-label="Search favorites" placeholder="Search favorites" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {list.map((f) => (
          <li key={f.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{f.name}</p>
              <p className="tabular text-xs text-muted">
                {f.calories} kcal · P {f.protein} · C {f.carbs} · F {f.fat}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove ${f.name} from favorites`}
              onClick={() => {
                removeFavorite(f.id);
                toast(`Removed ${f.name} from favorites`, { tone: "info" });
              }}
            >
              <Trash2 className="size-4" />
            </Button>
            <Button
              size="sm"
              variant={added === f.id ? "secondary" : "primary"}
              onClick={() => {
                addFood({
                  date: date ?? todayKey(),
                  meal,
                  name: f.name,
                  calories: f.calories,
                  protein: f.protein,
                  carbs: f.carbs,
                  fat: f.fat,
                  source: "favorite",
                });
                setAdded(f.id);
                toast(`${f.name} added to ${MEAL_LABEL[meal]}`);
                setTimeout(() => setAdded(null), 1200);
              }}
              aria-label={`Add ${f.name}`}
            >
              {added === f.id ? <Check className="size-4" /> : "Add"}
            </Button>
          </li>
        ))}
        {!list.length && <li className="p-4 text-center text-sm text-muted">No matches for “{q}”</li>}
      </ul>
    </div>
  );
}
