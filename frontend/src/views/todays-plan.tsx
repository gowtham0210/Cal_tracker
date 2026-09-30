"use client";

import { Check, ClipboardList } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, Card, CardHeader, Skeleton } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { todayKey } from "@/lib/date";
import { formatQuantity, PLAN_MEALS } from "@/lib/plan-math";
import type { MealType } from "@/lib/types";
import { MEAL_EMOJI, MEAL_LABEL } from "@/lib/ui";
import { loggedMessage, usePlannedDay } from "@/lib/use-planned-day";

/** Dashboard card: today's planned meals, each logged with one tap. */
export function TodaysPlan() {
  const today = todayKey();
  const { error, loading, items, log } = usePlannedDay(today);
  const toast = useToast();
  const [busy, setBusy] = useState<MealType | null>(null);
  const planned = items();

  const logMeal = async (meal: MealType) => {
    setBusy(meal);
    try {
      toast(loggedMessage(meal, await log(meal)));
    } catch (e) {
      toast(e instanceof ApiError ? e.problem.title : "Couldn't log that meal.", { tone: "error" });
    }
    setBusy(null);
  };

  return (
    <Card aria-labelledby="todays-plan-title">
      <CardHeader
        title={<span id="todays-plan-title">Today&apos;s plan</span>}
        icon={<ClipboardList className="size-4" />}
        action={
          <Link href="/plan" className="text-sm font-medium text-brand-strong hover:underline">
            Open plan
          </Link>
        }
      />
      {error ? (
        <p role="alert" className="text-sm text-muted">
          {error}
        </p>
      ) : loading ? (
        <Skeleton className="h-24" />
      ) : planned.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing planned for today.{" "}
          <Link href="/plan" className="font-medium text-brand-strong hover:underline">
            Plan your week
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {PLAN_MEALS.map((meal) => {
            const foods = items(meal);
            if (!foods.length) return null;
            const done = foods.every((f) => f.logged);
            const kcal = Math.round(foods.reduce((s, f) => s + f.calories, 0));
            return (
              <li key={meal} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="text-xl" aria-hidden>
                  {MEAL_EMOJI[meal]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {MEAL_LABEL[meal]} <span className="tabular font-normal text-muted">· {kcal} kcal</span>
                  </p>
                  <p className="truncate text-xs text-muted">{foods.map((f) => `${f.food.name}${f.quantity === 1 ? "" : ` ×${formatQuantity(f.quantity)}`}`).join(", ")}</p>
                </div>
                {done ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-strong">
                    <Check className="size-4" aria-hidden /> Logged
                  </span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => logMeal(meal)} disabled={busy !== null} aria-label={`Log ${MEAL_LABEL[meal].toLowerCase()} from your plan`}>
                    Log
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
