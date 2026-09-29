"use client";

import { Download, FileSpreadsheet, Monitor, Moon, RotateCcw, Sun, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Card, CardHeader, Field, Input, PageHeader, Segmented, Sheet } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { lengthIn, lengthOut, lUnit } from "@/lib/calc";
import { buildCsv, downloadFile, type ExportKind } from "@/lib/csv";
import { todayKey } from "@/lib/date";
import { useStore } from "@/lib/store";
import type { Theme, UnitSystem } from "@/lib/types";

/** Number input that commits on blur/Enter and reverts invalid values. */
function NumberSetting({
  id,
  label,
  value,
  suffix,
  min,
  max,
  onCommit,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  suffix?: string;
  min: number;
  max: number;
  onCommit: (v: number) => void;
  hint?: string;
}) {
  const [v, setV] = useState(String(value));
  const [err, setErr] = useState<string>();
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setV(String(value));
  }
  const commit = () => {
    const n = Number(v);
    if (!(n >= min && n <= max)) {
      setErr(`Enter a value between ${min} and ${max}`);
      return;
    }
    setErr(undefined);
    if (n !== value) onCommit(n);
  };
  return (
    <Field label={label} htmlFor={id} error={err} hint={hint}>
      <Input
        id={id}
        inputMode="decimal"
        suffix={suffix}
        value={v}
        onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
    </Field>
  );
}

const EXPORTS: { kind: ExportKind; label: string; desc: string }[] = [
  { kind: "daily", label: "Daily summary", desc: "One row per day: calories, macros, weight, water, mood" },
  { kind: "food", label: "Food log", desc: "Every food entry with meal and macros" },
  { kind: "weight", label: "Weigh-ins", desc: "Date and weight (kg)" },
  { kind: "measurements", label: "Measurements", desc: "Waist, hips, chest (cm)" },
  { kind: "exercise", label: "Exercise", desc: "Workouts, duration and calories" },
  { kind: "water", label: "Water", desc: "Glasses per day" },
  { kind: "journal", label: "Journal", desc: "Mood, energy, sleep, cravings, notes" },
];

export function SettingsView() {
  const s = useStore();
  const { profile, updateProfile, resetDemo, clearAll } = s;
  const toast = useToast();
  const u = profile.units;
  const [confirm, setConfirm] = useState<"reset" | "clear" | null>(null);
  const saved = (msg = "Saved") => toast(msg);

  const exportOne = (kind: ExportKind) => {
    downloadFile(`lighter-${kind}-${todayKey()}.csv`, buildCsv(kind, useStore.getState()));
    toast(`Exported ${kind} CSV`);
  };
  const exportAll = () => {
    EXPORTS.forEach((e, i) =>
      setTimeout(() => downloadFile(`lighter-${e.kind}-${todayKey()}.csv`, buildCsv(e.kind, useStore.getState())), i * 250),
    );
    toast("Exporting all data as CSV files");
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Changes save automatically" />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="s-name">
              <Input
                id="s-name"
                defaultValue={profile.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== profile.name) {
                    updateProfile({ name: v });
                    saved();
                  }
                }}
              />
            </Field>
            <NumberSetting
              id="s-height"
              label="Height"
              value={Math.round(lengthOut(profile.heightCm, u))}
              suffix={lUnit(u)}
              min={u === "imperial" ? 40 : 100}
              max={u === "imperial" ? 98 : 250}
              hint="Used to calculate BMI automatically"
              onCommit={(v) => {
                updateProfile({ heightCm: Math.round(lengthIn(v, u)) });
                saved("Height saved — BMI updated");
              }}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Preferences" />
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Units</p>
                <p className="text-xs text-muted">Weight and body measurements</p>
              </div>
              <Segmented<UnitSystem>
                label="Units"
                value={u}
                onChange={(v) => updateProfile({ units: v })}
                options={[
                  { value: "metric", label: "kg · cm" },
                  { value: "imperial", label: "lb · in" },
                ]}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Appearance</p>
                <p className="text-xs text-muted">Match your device or pick one</p>
              </div>
              <Segmented<Theme>
                label="Theme"
                value={profile.theme}
                onChange={(v) => updateProfile({ theme: v })}
                options={[
                  { value: "system", label: <Monitor className="mx-auto size-4" aria-label="System" /> },
                  { value: "light", label: <Sun className="mx-auto size-4" aria-label="Light" /> },
                  { value: "dark", label: <Moon className="mx-auto size-4" aria-label="Dark" /> },
                ]}
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Daily targets" />
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberSetting
              id="s-cal"
              label="Calorie goal"
              value={profile.calorieGoal}
              suffix="kcal"
              min={1000}
              max={5000}
              hint="Most people lose ~0.5 kg/week at 500 kcal below maintenance"
              onCommit={(v) => {
                updateProfile({ calorieGoal: Math.round(v) });
                saved("Calorie goal updated");
              }}
            />
            <NumberSetting
              id="s-water"
              label="Water goal"
              value={profile.waterGoal}
              suffix="glasses"
              min={1}
              max={20}
              hint={`${profile.glassMl} ml per glass`}
              onCommit={(v) => {
                updateProfile({ waterGoal: Math.round(v) });
                saved("Water goal updated");
              }}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Macros"
            subtitle="Optional — track protein, carbs and fat"
            action={
              <button
                role="switch"
                aria-checked={profile.trackMacros}
                aria-label="Track macros"
                onClick={() => updateProfile({ trackMacros: !profile.trackMacros })}
                className={`relative h-7 w-12 rounded-full transition ${profile.trackMacros ? "bg-brand" : "bg-border"}`}
              >
                <span
                  className={`absolute top-1 size-5 rounded-full bg-white shadow transition-[left] ${profile.trackMacros ? "left-6" : "left-1"}`}
                />
              </button>
            }
          />
          {profile.trackMacros ? (
            <div className="grid grid-cols-3 gap-3">
              {(["protein", "carbs", "fat"] as const).map((k) => (
                <NumberSetting
                  key={k}
                  id={`s-${k}`}
                  label={k[0].toUpperCase() + k.slice(1)}
                  value={profile.macroGoals[k]}
                  suffix="g"
                  min={0}
                  max={600}
                  onCommit={(v) => {
                    updateProfile({ macroGoals: { ...profile.macroGoals, [k]: Math.round(v) } });
                    saved();
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Macro tracking is off. Calories are still tracked everywhere.</p>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          icon={<FileSpreadsheet className="size-4" />}
          title="Export data"
          subtitle="Download your history as CSV — opens in Excel, Numbers or Google Sheets"
          action={
            <Button onClick={exportAll}>
              <Download className="size-4" /> Export all
            </Button>
          }
        />
        <ul className="grid gap-2 sm:grid-cols-2">
          {EXPORTS.map((e) => (
            <li key={e.kind} className="flex min-w-0 items-center gap-3 rounded-xl border border-border p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{e.label}</p>
                <p className="truncate text-xs text-muted">{e.desc}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => exportOne(e.kind)} aria-label={`Download ${e.label} CSV`}>
                <Download className="size-4" /> CSV
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Data" subtitle="Everything is stored locally in this browser" />
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setConfirm("reset")}>
            <RotateCcw className="size-4" /> Reload demo data
          </Button>
          <Button variant="outline" className="text-danger" onClick={() => setConfirm("clear")}>
            <Trash2 className="size-4" /> Start fresh
          </Button>
        </div>
      </Card>

      <Sheet
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm === "reset" ? "Reload demo data?" : "Delete all data?"}
        description={
          confirm === "reset"
            ? "This replaces everything with the sample journey. Your current entries will be lost."
            : "This permanently deletes all your logs. Export a CSV first if you want a backup."
        }
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm === "reset") resetDemo();
              else clearAll();
              toast(confirm === "reset" ? "Demo data reloaded" : "All data cleared", { tone: "info" });
              setConfirm(null);
            }}
          >
            {confirm === "reset" ? "Reload demo" : "Delete everything"}
          </Button>
        </div>
      </Sheet>
      <p className="pb-2 text-center text-xs text-subtle">
        {s.foods.length} food entries · {s.weights.length} weigh-ins stored
      </p>
    </div>
  );
}
