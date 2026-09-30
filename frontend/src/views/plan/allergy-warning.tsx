import clsx from "clsx";
import { TriangleAlert } from "lucide-react";
import type { LibraryFood } from "@/lib/api";

/** "Contains peanut" or "Contains peanut and brinjal", or null when the food is safe. */
export function allergyText(food: Pick<LibraryFood, "allergyConflicts">): string | null {
  const c = food.allergyConflicts;
  if (!c.length) return null;
  return `Contains ${c.length === 1 ? c[0] : `${c.slice(0, -1).join(", ")} and ${c.at(-1)}`}`;
}

/** A warning that a food conflicts with the user's allergies, with an icon so it doesn't rely on colour. */
export function AllergyWarning({ food, className, compact }: { food: Pick<LibraryFood, "allergyConflicts">; className?: string; compact?: boolean }) {
  const text = allergyText(food);
  if (!text) return null;
  return (
    <span className={clsx("flex items-center gap-1 font-medium text-warning", compact ? "text-[11px]" : "text-xs", className)}>
      <TriangleAlert className={clsx("shrink-0", compact ? "size-3" : "size-3.5")} aria-hidden />
      {text}
    </span>
  );
}
