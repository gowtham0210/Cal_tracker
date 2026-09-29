import type { SeedData } from "./mock";

const esc = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: Record<string, unknown>[], columns: string[]) {
  return [columns.join(","), ...rows.map((r) => columns.map((c) => esc(r[c])).join(","))].join("\n");
}

export type ExportKind = "food" | "weight" | "measurements" | "exercise" | "water" | "journal" | "daily";

export function buildCsv(kind: ExportKind, d: SeedData): string {
  switch (kind) {
    case "food":
      return toCsv([...d.foods].sort((a, b) => a.date.localeCompare(b.date)) as unknown as Record<string, unknown>[], [
        "date",
        "meal",
        "name",
        "calories",
        "protein",
        "carbs",
        "fat",
        "source",
      ]);
    case "weight":
      return toCsv(d.weights as unknown as Record<string, unknown>[], ["date", "weight"]);
    case "measurements":
      return toCsv(d.measurements as unknown as Record<string, unknown>[], ["date", "waist", "hips", "chest"]);
    case "exercise":
      return toCsv([...d.exercises].sort((a, b) => a.date.localeCompare(b.date)) as unknown as Record<string, unknown>[], [
        "date",
        "name",
        "minutes",
        "calories",
      ]);
    case "water":
      return toCsv(
        Object.entries(d.water)
          .sort()
          .map(([date, glasses]) => ({ date, glasses })),
        ["date", "glasses"],
      );
    case "journal":
      return toCsv(Object.values(d.journal).sort((a, b) => a.date.localeCompare(b.date)) as unknown as Record<string, unknown>[], [
        "date",
        "mood",
        "energy",
        "sleepHours",
        "cravings",
        "note",
      ]);
    case "daily": {
      const dates = new Set<string>([
        ...d.foods.map((f) => f.date),
        ...d.weights.map((w) => w.date),
        ...d.exercises.map((e) => e.date),
        ...Object.keys(d.water),
      ]);
      const rows = [...dates].sort().map((date) => {
        const f = d.foods.filter((x) => x.date === date);
        const sum = (k: "calories" | "protein" | "carbs" | "fat") => f.reduce((s, x) => s + x[k], 0);
        const burned = d.exercises.filter((e) => e.date === date).reduce((s, e) => s + e.calories, 0);
        return {
          date,
          weight_kg: d.weights.find((w) => w.date === date)?.weight,
          calories_in: sum("calories"),
          calories_burned: burned,
          net_calories: sum("calories") - burned,
          protein_g: sum("protein"),
          carbs_g: sum("carbs"),
          fat_g: sum("fat"),
          water_glasses: d.water[date],
          mood: d.journal[date]?.mood,
        };
      });
      return toCsv(rows, [
        "date",
        "weight_kg",
        "calories_in",
        "calories_burned",
        "net_calories",
        "protein_g",
        "carbs_g",
        "fat_g",
        "water_glasses",
        "mood",
      ]);
    }
  }
}

export function downloadFile(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
