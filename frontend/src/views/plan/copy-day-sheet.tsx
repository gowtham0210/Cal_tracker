"use client";

import clsx from "clsx";
import { useState } from "react";
import { Button, Segmented, Sheet } from "@/components/ui";
import { fromKey } from "@/lib/date";
import { usePlan } from "@/lib/plan-store";
import { longDay } from "@/lib/week";
import { useUndoable } from "./use-undoable";

/** Copy one day's foods to other days. Replace vs add is only asked when a target has food. */
export function CopyDaySheet({ from, onClose }: { from: string | null; onClose: () => void }) {
  const plan = usePlan((s) => s.plan);
  const copyDay = usePlan((s) => s.copyDay);
  const undoable = useUndoable();
  const [to, setTo] = useState<string[]>([]);
  const [mode, setMode] = useState<"add" | "replace">("add");

  const close = () => {
    setTo([]);
    setMode("add");
    onClose();
  };
  if (!from || !plan) return <Sheet open={false} onClose={close} title="">{null}</Sheet>;

  const others = plan.days.filter((d) => d.date !== from);
  const targetsWithFood = to.filter((d) => plan.days.find((x) => x.date === d)!.status.state !== "empty");
  const weekday = (d: string) => fromKey(d).toLocaleDateString(undefined, { weekday: "long" });

  const confirm = () => {
    const names = to.map((d) => fromKey(d).toLocaleDateString(undefined, { weekday: "short" })).join(", ");
    undoable(to, () => copyDay(from, to, targetsWithFood.length ? mode : "add"), `Copied ${weekday(from)} to ${names}`);
    close();
  };

  return (
    <Sheet
      open
      onClose={close}
      title={`Copy ${weekday(from)} to…`}
      description="Choose the days to fill with this day's meals."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!to.length}>
            Copy to {to.length || ""} {to.length === 1 ? "day" : "days"}
          </Button>
        </div>
      }
    >
      <fieldset className="space-y-2">
        <legend className="sr-only">Days</legend>
        {others.map((d) => {
          const checked = to.includes(d.date);
          return (
            <label
              key={d.date}
              className={clsx("flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition", checked ? "border-brand bg-brand-soft/50" : "border-border hover:border-brand/50")}
            >
              <input
                type="checkbox"
                className="size-4 accent-[var(--brand)]"
                checked={checked}
                onChange={() => setTo((t) => (checked ? t.filter((x) => x !== d.date) : [...t, d.date].sort()))}
              />
              <span className="flex-1 text-sm font-medium">{longDay(d.date)}</span>
              <span className="text-xs tabular text-muted">{d.status.state === "empty" ? "Empty" : `${Math.round(d.calories).toLocaleString()} kcal planned`}</span>
            </label>
          );
        })}
      </fieldset>

      {targetsWithFood.length > 0 && (
        <div className="mt-4 space-y-2 rounded-xl bg-surface-2 p-3">
          <p className="text-sm">
            {targetsWithFood.length === 1 ? "1 chosen day already has food." : `${targetsWithFood.length} chosen days already have food.`} What should happen to it?
          </p>
          <Segmented<"add" | "replace">
            label="When a day already has food"
            value={mode}
            onChange={setMode}
            options={[
              { value: "add", label: "Add to it" },
              { value: "replace", label: "Replace it" },
            ]}
            className="w-full"
          />
        </div>
      )}
    </Sheet>
  );
}
