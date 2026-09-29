import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { todayIn } from "../lib/dates.js";
import { dayTotals } from "../lib/stats.js";
import { parse } from "../http/validate.js";
import { getProfile } from "./profile.js";

// Quotes when needed, and defuses values a spreadsheet would run as a formula (CSV injection).
function cell(v: unknown) {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csv = (columns: string[], rows: Record<string, unknown>[]) =>
  [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))].join("\n") + "\n";

const KINDS = {
  food: {
    columns: ["date", "meal", "name", "calories", "protein", "carbs", "fat", "source"],
    sql: "SELECT date, meal, name, calories, protein, carbs, fat, source FROM food_entries WHERE user_id = ? ORDER BY date, created_at, id",
  },
  weight: { columns: ["date", "weight"], sql: "SELECT date, weight FROM weight_entries WHERE user_id = ? ORDER BY date" },
  measurements: { columns: ["date", "waist", "hips", "chest"], sql: "SELECT date, waist, hips, chest FROM measurement_entries WHERE user_id = ? ORDER BY date" },
  exercise: {
    columns: ["date", "name", "minutes", "calories"],
    sql: "SELECT date, name, minutes, calories FROM exercise_entries WHERE user_id = ? ORDER BY date, created_at, id",
  },
  water: { columns: ["date", "glasses"], sql: "SELECT date, glasses FROM water_entries WHERE user_id = ? ORDER BY date" },
  journal: {
    columns: ["date", "mood", "energy", "sleepHours", "cravings", "note"],
    sql: "SELECT date, mood, energy, sleep_hours AS sleepHours, cravings, note FROM journal_entries WHERE user_id = ? ORDER BY date",
  },
} as const;

function dailyRows(userId: string) {
  const days = db
    .prepare(
      `SELECT date FROM food_entries WHERE user_id = @u UNION SELECT date FROM weight_entries WHERE user_id = @u
       UNION SELECT date FROM exercise_entries WHERE user_id = @u UNION SELECT date FROM water_entries WHERE user_id = @u ORDER BY date`,
    )
    .all({ u: userId }) as { date: string }[];
  if (!days.length) return [];
  const map = (sql: string) => new Map((db.prepare(sql).all(userId) as { date: string; v: number }[]).map((r) => [r.date, r.v]));
  const weight = map("SELECT date, weight AS v FROM weight_entries WHERE user_id = ?");
  const water = map("SELECT date, glasses AS v FROM water_entries WHERE user_id = ?");
  const mood = map("SELECT date, mood AS v FROM journal_entries WHERE user_id = ?");
  const logged = new Set(days.map((d) => d.date));
  return dayTotals(userId, days[0].date, days[days.length - 1].date)
    .filter((t) => logged.has(t.date))
    .map((t) => ({
      date: t.date,
      weight_kg: weight.get(t.date),
      calories_in: t.calories,
      calories_burned: t.burned,
      net_calories: t.net,
      protein_g: t.protein,
      carbs_g: t.carbs,
      fat_g: t.fat,
      water_glasses: water.get(t.date),
      mood: mood.get(t.date),
    }));
}

const DAILY_COLUMNS = ["date", "weight_kg", "calories_in", "calories_burned", "net_calories", "protein_g", "carbs_g", "fat_g", "water_glasses", "mood"];

export const exports = Router();

exports.get("/:kind", (req, res) => {
  const { kind } = parse(z.object({ kind: z.enum(["daily", ...Object.keys(KINDS)] as [string, ...string[]], "Unknown export kind.") }), req.params);
  const userId = res.locals.userId;
  const body =
    kind === "daily"
      ? csv(DAILY_COLUMNS, dailyRows(userId))
      : csv([...KINDS[kind as keyof typeof KINDS].columns], db.prepare(KINDS[kind as keyof typeof KINDS].sql).all(userId) as Record<string, unknown>[]);
  const day = todayIn(getProfile(userId)?.timeZone ?? "UTC");
  res
    .type("text/csv; charset=utf-8")
    .set("Content-Disposition", `attachment; filename="lighter-${kind}-${day}.csv"`)
    .set("Cache-Control", "no-store")
    .send(body);
});
