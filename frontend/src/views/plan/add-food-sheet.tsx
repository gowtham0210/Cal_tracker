"use client";

import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { Button, Sheet } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import type { LibraryFood } from "@/lib/api";
import { usePlan } from "@/lib/plan-store";
import type { MealType } from "@/lib/types";
import { MEAL_LABEL } from "@/lib/ui";
import { longDay } from "@/lib/week";
import { FoodLibrary } from "./food-library";

export interface SlotTarget {
  date: string;
  meal: MealType;
}

/** The library, filtered to the meal, for adding foods to one slot. Stays open to add several. */
export function AddFoodSheet({ target, onClose }: { target: SlotTarget | null; onClose: () => void }) {
  const addItem = usePlan((s) => s.addItem);
  const toast = useToast();
  const [added, setAdded] = useState<string | null>(null);
  if (!target) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;

  const add = (f: LibraryFood) => {
    addItem(target.date, target.meal, f);
    setAdded(f.id);
    setTimeout(() => setAdded((a) => (a === f.id ? null : a)), 1200);
    toast(`${f.name} added to ${MEAL_LABEL[target.meal].toLowerCase()}`);
  };

  return (
    <Sheet open onClose={onClose} title={`Add to ${MEAL_LABEL[target.meal].toLowerCase()}`} description={longDay(target.date)} footer={<Button onClick={onClose} className="w-full">Done</Button>}>
      <FoodLibrary
        key={`${target.date}-${target.meal}`}
        meal={target.meal}
        className="h-[55dvh]"
        renderAction={(f) => (
          <Button size="sm" variant={added === f.id ? "secondary" : "primary"} aria-label={`Add ${f.name}`} onClick={() => add(f)}>
            {added === f.id ? <Check className="size-4" /> : <Plus className="size-4" />}
            {added === f.id ? "Added" : "Add"}
          </Button>
        )}
      />
    </Sheet>
  );
}
