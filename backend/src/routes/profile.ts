import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { named } from "../db/named.js";
import { iso } from "../lib/dates.js";
import { HttpError } from "../http/problem.js";
import { body, date, grams, parse, timeZone } from "../http/validate.js";

export interface ProfileRow {
  user_id: string;
  height_cm: number;
  goal_weight: number;
  start_date: string;
  calorie_goal: number;
  protein_goal: number;
  carbs_goal: number;
  fat_goal: number;
  track_macros: number;
  water_goal: number;
  glass_ml: number;
  units: "metric" | "imperial";
  theme: "system" | "light" | "dark";
  time_zone: string;
  updated_at: number;
}

export interface Profile {
  heightCm: number;
  startWeight: number;
  goalWeight: number;
  startDate: string;
  calorieGoal: number;
  macroGoals: { protein: number; carbs: number; fat: number };
  trackMacros: boolean;
  waterGoal: number;
  glassMl: number;
  units: "metric" | "imperial";
  theme: "system" | "light" | "dark";
  timeZone: string;
  updatedAt: string;
}

const selectProfile = db.prepare<[string], ProfileRow>("SELECT * FROM profiles WHERE user_id = ?");
// The start weight is the weigh-in on start_date; fall back to the first weigh-in if it is missing.
const startWeightOf = db.prepare<[string, string], { weight: number }>(
  "SELECT weight FROM weight_entries WHERE user_id = ? ORDER BY (date = ?) DESC, date LIMIT 1",
);
const weightOnDate = db.prepare<[string, string], { weight: number }>("SELECT weight FROM weight_entries WHERE user_id = ? AND date = ?");
const upsertWeight = db.prepare(
  `INSERT INTO weight_entries (id, user_id, date, weight) VALUES (?, ?, ?, ?)
   ON CONFLICT (user_id, date) DO UPDATE SET weight = excluded.weight`,
);

export function getProfile(userId: string): Profile | undefined {
  const r = selectProfile.get(userId);
  if (!r) return undefined;
  return {
    heightCm: r.height_cm,
    startWeight: startWeightOf.get(userId, r.start_date)?.weight ?? r.goal_weight,
    goalWeight: r.goal_weight,
    startDate: r.start_date,
    calorieGoal: r.calorie_goal,
    macroGoals: { protein: r.protein_goal, carbs: r.carbs_goal, fat: r.fat_goal },
    trackMacros: r.track_macros === 1,
    waterGoal: r.water_goal,
    glassMl: r.glass_ml,
    units: r.units,
    theme: r.theme,
    timeZone: r.time_zone,
    updatedAt: iso(r.updated_at),
  };
}

/** The profile, or a 404 telling the client to finish onboarding. */
export function requireProfile(userId: string): Profile {
  const p = getProfile(userId);
  if (!p) throw new HttpError(404, "profile-required", "Set up your profile first.", "Create it with PUT /me/profile.");
  return p;
}

const weight = z.number("Must be a number.").gt(0, "Must be greater than 0.").max(700, "Must be at most 700.");
const fields = {
  heightCm: z.number("Must be a number.").gt(0, "Must be greater than 0.").max(300, "Must be at most 300."),
  startWeight: weight,
  goalWeight: weight,
  startDate: date,
  calorieGoal: z.int("Must be a whole number.").gt(0, "Must be greater than 0.").max(20_000, "Must be at most 20000."),
  macroGoals: body({ protein: grams, carbs: grams, fat: grams }),
  trackMacros: z.boolean("Must be true or false."),
  waterGoal: z.int("Must be a whole number.").min(1, "Must be 1 to 30.").max(30, "Must be 1 to 30."),
  glassMl: z.int("Must be a whole number.").min(1, "Must be 1 to 2000.").max(2000, "Must be 1 to 2000."),
  units: z.enum(["metric", "imperial"], "Must be metric or imperial."),
  theme: z.enum(["system", "light", "dark"], "Must be system, light or dark."),
  timeZone,
};
const profileInput = body({ ...fields, updatedAt: z.unknown().optional() });
const profilePatch = body({
  ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])),
  macroGoals: body({ protein: grams.optional(), carbs: grams.optional(), fat: grams.optional() })
    .refine((m) => Object.keys(m).length > 0, "Send at least one of protein, carbs or fat.")
    .optional(),
}).refine((v) => Object.keys(v).length > 0, "Send at least one field.");

type ProfileInput = Omit<Profile, "updatedAt">;

const writeProfile = named(
  `INSERT INTO profiles (user_id, height_cm, goal_weight, start_date, calorie_goal, protein_goal, carbs_goal, fat_goal,
                         track_macros, water_goal, glass_ml, units, theme, time_zone)
   VALUES (@userId, @heightCm, @goalWeight, @startDate, @calorieGoal, @protein, @carbs, @fat,
           @trackMacros, @waterGoal, @glassMl, @units, @theme, @timeZone)
   ON CONFLICT (user_id) DO UPDATE SET
     height_cm = excluded.height_cm, goal_weight = excluded.goal_weight, start_date = excluded.start_date,
     calorie_goal = excluded.calorie_goal, protein_goal = excluded.protein_goal, carbs_goal = excluded.carbs_goal,
     fat_goal = excluded.fat_goal, track_macros = excluded.track_macros, water_goal = excluded.water_goal,
     glass_ml = excluded.glass_ml, units = excluded.units, theme = excluded.theme, time_zone = excluded.time_zone`,
);

/** Writes the whole profile and its start weigh-in in one transaction. */
export const saveProfile = db.transaction((userId: string, p: ProfileInput) => {
  writeProfile.run({
    userId,
    ...p,
    protein: p.macroGoals.protein,
    carbs: p.macroGoals.carbs,
    fat: p.macroGoals.fat,
    trackMacros: p.trackMacros ? 1 : 0,
  });
  upsertWeight.run(randomUUID(), userId, p.startDate, p.startWeight);
});

export const profile = Router();

profile.get("/", (_req, res) => {
  res.json(requireProfile(res.locals.userId));
});

profile.put("/", (req, res) => {
  const { updatedAt: _, ...input } = parse(profileInput, req.body);
  const existed = !!selectProfile.get(res.locals.userId);
  saveProfile(res.locals.userId, input);
  res.status(existed ? 200 : 201).json(getProfile(res.locals.userId));
});

// JSON Merge Patch. Moving startDate carries the start weight to the new date unless a new one is sent.
profile.patch("/", (req, res) => {
  const patch = parse(profilePatch, req.body) as Partial<ProfileInput> & { macroGoals?: Partial<Profile["macroGoals"]> };
  const { updatedAt: _, ...current } = requireProfile(res.locals.userId);
  // A weigh-in that already exists on the new start date becomes the start weight.
  if (patch.startDate && patch.startWeight === undefined) {
    patch.startWeight = weightOnDate.get(res.locals.userId, patch.startDate)?.weight ?? current.startWeight;
  }
  saveProfile(res.locals.userId, {
    ...current,
    ...patch,
    macroGoals: { ...current.macroGoals, ...patch.macroGoals },
  } as ProfileInput);
  res.json(getProfile(res.locals.userId));
});
