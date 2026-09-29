import { z } from "zod";
import { db } from "../db/index.js";
import { HttpError } from "../http/problem.js";
import { body } from "../http/validate.js";
import { dailyResource } from "./daily.js";

// Read-only fields a client may echo back from a GET; accepted and ignored.
const echoed = { date: z.unknown().optional(), updatedAt: z.unknown().optional() };
const positive = (max: number) => z.number("Must be a number.").gt(0, "Must be greater than 0.").max(max, `Must be at most ${max}.`);

const startDateOf = db.prepare<[string], { start_date: string }>("SELECT start_date FROM profiles WHERE user_id = ?");

export const weightEntries = dailyResource({
  table: "weight_entries",
  columns: [["weight", "weight"]],
  hasId: true,
  input: body({ ...echoed, weight: positive(700) }),
  beforeDelete: (userId, date) => {
    if (startDateOf.get(userId)?.start_date === date) {
      throw new HttpError(409, "start-weight", "This weigh-in is your start weight.", "Change startWeight on your profile instead.");
    }
  },
});

export const measurementEntries = dailyResource({
  table: "measurement_entries",
  columns: [
    ["waist", "waist"],
    ["hips", "hips"],
    ["chest", "chest"],
  ],
  hasId: true,
  input: body({ ...echoed, waist: positive(300).optional(), hips: positive(300).optional(), chest: positive(300).optional() }).refine(
    (v) => v.waist !== undefined || v.hips !== undefined || v.chest !== undefined,
    "Send at least one of waist, hips or chest.",
  ),
});

export const waterEntries = dailyResource({
  table: "water_entries",
  columns: [["glasses", "glasses"]],
  hasId: false,
  input: body({ ...echoed, glasses: z.int("Must be a whole number.").min(0, "Must be 0 or more.").max(30, "Must be at most 30.") }),
});

const journalFields = ["mood", "energy", "sleepHours", "cravings", "note"] as const;
export const journalEntries = dailyResource({
  table: "journal_entries",
  getOne: true,
  columns: [
    ["mood", "mood"],
    ["energy", "energy"],
    ["sleepHours", "sleep_hours"],
    ["cravings", "cravings"],
    ["note", "note"],
  ],
  hasId: false,
  input: body({
    ...echoed,
    mood: z.int("Must be a whole number.").min(1, "Must be 1 to 5.").max(5, "Must be 1 to 5.").optional(),
    energy: z.int("Must be a whole number.").min(1, "Must be 1 to 3.").max(3, "Must be 1 to 3.").optional(),
    sleepHours: z.number("Must be a number.").min(0, "Must be 0 to 24.").max(24, "Must be 0 to 24.").optional(),
    cravings: z.int("Must be a whole number.").min(0, "Must be 0 to 3.").max(3, "Must be 0 to 3.").optional(),
    note: z.string("Must be text.").max(2000, "Must be at most 2000 characters.").optional(),
  }).refine((v) => journalFields.some((f) => v[f] !== undefined), "Send at least one of mood, energy, sleepHours, cravings or note."),
});

