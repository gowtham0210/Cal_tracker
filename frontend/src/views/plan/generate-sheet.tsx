"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Button, Chip, Segmented, Select, Sheet } from "@/components/ui";
import type { GenerateRequest } from "@/lib/api";
import { fromKey } from "@/lib/date";
import { usePlan } from "@/lib/plan-store";
import { useStore } from "@/lib/store";
import { CUISINE_LABEL, DIET_LABEL, type Cuisine, type DietType } from "@/lib/types";
import { weekDates } from "@/lib/week";
import { AllergyEditor } from "../food-preferences";

const weekday = (d: string, style: "short" | "long") => fromKey(d).toLocaleDateString(undefined, { weekday: style });

/**
 * Asks for a draft of the week or one day, from mostly the user's usual foods or a mix with new
 * dishes. The preferences the plan will respect are shown, and can be changed right here.
 */
export function GenerateSheet({ open, onClose, defaultDay }: { open: boolean; onClose: () => void; defaultDay: string }) {
  const { weekStart, plan, generate } = usePlan();
  const profile = useStore((s) => s.profile);
  const updateProfile = useStore((s) => s.updateProfile);
  const [scope, setScope] = useState<GenerateRequest["scope"]>("week");
  const [day, setDay] = useState(defaultDay);
  const [mode, setMode] = useState<GenerateRequest["mode"]>("usual");
  const [editing, setEditing] = useState(false);
  if (!weekStart) return null;

  const days = weekDates(weekStart);
  const date = days.includes(day) ? day : days[0];
  const replacing = plan?.status !== "draft" && (plan?.items.some((i) => scope === "week" || i.date === date) ?? false);
  const start = () => {
    void generate(scope === "week" ? { scope, mode } : { scope, date, mode });
    setEditing(false);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Plan with AI"
      description="Every number comes from your food library."
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">{replacing ? "Your current plan stays until you keep the draft." : "You'll get a draft to keep or discard."}</p>
          <Button onClick={start} className="shrink-0 whitespace-nowrap">
            <Sparkles className="size-4" /> Generate {scope === "week" ? "week" : weekday(date, "long")}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium">What to plan</p>
          <Segmented
            label="What to plan"
            value={scope}
            onChange={setScope}
            className="w-full"
            options={[
              { value: "week", label: "Whole week" },
              { value: "day", label: "One day" },
            ]}
          />
          {scope === "day" && (
            <Segmented
              label="Day"
              value={date}
              onChange={setDay}
              className="w-full"
              size="sm"
              options={days.map((d) => ({
                value: d,
                label: (
                  <>
                    <span aria-hidden>{weekday(d, "short")}</span>
                    <span className="sr-only">{weekday(d, "long")}</span>
                  </>
                ),
              }))}
            />
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Foods to use</p>
          <Segmented
            label="Foods to use"
            value={mode}
            onChange={setMode}
            className="w-full"
            options={[
              { value: "usual", label: "Mostly my usual foods" },
              { value: "mix", label: "Mix in new foods" },
            ]}
          />
        </div>

        <div className="rounded-xl bg-surface-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">The plan will respect</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Chip>{DIET_LABEL[profile.dietType]}</Chip>
                <Chip>{CUISINE_LABEL[profile.cuisine]}</Chip>
                <Chip tone={profile.allergies.length ? "warn" : "neutral"}>
                  {profile.allergies.length ? `No ${profile.allergies.join(", ")}` : "No allergies"}
                </Chip>
              </div>
            </div>
            <Button variant="ghost" size="sm" aria-expanded={editing} onClick={() => setEditing(!editing)}>
              {editing ? "Done" : "Change"}
            </Button>
          </div>
          {editing && (
            <div className="mt-4 space-y-4 border-t border-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Diet type</p>
                <Segmented<DietType>
                  label="Diet type"
                  value={profile.dietType}
                  onChange={(v) => updateProfile({ dietType: v })}
                  size="sm"
                  options={(Object.keys(DIET_LABEL) as DietType[]).map((v) => ({ value: v, label: DIET_LABEL[v] }))}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="g-cuisine" className="text-sm font-medium">
                  Food style
                </label>
                <Select id="g-cuisine" className="w-44" value={profile.cuisine} onChange={(e) => updateProfile({ cuisine: e.target.value as Cuisine })}>
                  {Object.entries(CUISINE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Allergies</p>
                <AllergyEditor idPrefix="g" />
              </div>
            </div>
          )}
          {!editing && profile.allergies.length > 0 && (
            <p className="mt-2 text-xs text-muted">Foods with {profile.allergies.join(", ")} are never planned.</p>
          )}
        </div>
      </div>
    </Sheet>
  );
}
