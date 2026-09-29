import { Router } from "express";
import { SqliteError } from "better-sqlite3";
import { db } from "../db/index.js";
import { named } from "../db/named.js";
import { generateDemoData } from "../lib/demo.js";
import { todayIn } from "../lib/dates.js";
import { toUser, type UserRow } from "../lib/users.js";
import { getProfile, saveProfile, type Cuisine } from "./profile.js";
import { HttpError } from "../http/problem.js";
import { body, email, parse, personName } from "../http/validate.js";

const userPatch = body({ email: email.optional(), name: personName.optional() }).refine((v) => Object.keys(v).length > 0, "Send at least one field.");

const getUser = db.prepare<[string], UserRow>("SELECT id, email, name, created_at FROM users WHERE id = ?");
const deleteUser = db.prepare("DELETE FROM users WHERE id = ?");

// Everything the user logged; the account, credentials and profile stay.
const LOG_TABLES = [
  "food_entries",
  "favorite_foods",
  "weight_entries",
  "measurement_entries",
  "exercise_entries",
  "water_entries",
  "journal_entries",
  "coach_messages",
];
const clearLogs = db.transaction((userId: string) => {
  for (const t of LOG_TABLES) {
    // The weigh-in on the profile's start date is the start weight, which belongs to the profile.
    const keep = t === "weight_entries" ? " AND date IS NOT (SELECT start_date FROM profiles WHERE user_id = @userId)" : "";
    named(`DELETE FROM ${t} WHERE user_id = @userId${keep}`).run({ userId });
  }
});

const insertDemo = db.transaction((userId: string, d: ReturnType<typeof generateDemoData>, timeZone: string, cuisine: Cuisine) => {
  for (const t of LOG_TABLES) db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(userId);
  saveProfile(userId, { ...d.profile, timeZone, cuisine });
  const run = (sql: string, rows: object[]) => {
    const stmt = named(sql);
    for (const r of rows) stmt.run({ userId, ...(r as Record<string, unknown>) });
  };
  run("INSERT OR REPLACE INTO weight_entries (id, user_id, date, weight) VALUES (@id, @userId, @date, @weight)", d.weights);
  run("INSERT INTO measurement_entries (id, user_id, date, waist, hips, chest) VALUES (@id, @userId, @date, @waist, @hips, @chest)", d.measurements);
  run("INSERT INTO favorite_foods (id, user_id, name, meal, calories, protein, carbs, fat) VALUES (@id, @userId, @name, @meal, @calories, @protein, @carbs, @fat)", d.favorites);
  run(
    `INSERT INTO food_entries (id, user_id, date, meal, name, calories, protein, carbs, fat, source, created_at, updated_at)
     VALUES (@id, @userId, @date, @meal, @name, @calories, @protein, @carbs, @fat, 'manual', @createdAt, @createdAt)`,
    d.foods,
  );
  run("INSERT INTO exercise_entries (id, user_id, date, name, minutes, calories) VALUES (@id, @userId, @date, @name, @minutes, @calories)", d.exercises);
  run("INSERT INTO water_entries (user_id, date, glasses) VALUES (@userId, @date, @glasses)", d.water);
  run(
    "INSERT INTO journal_entries (user_id, date, mood, energy, sleep_hours, cravings, note) VALUES (@userId, @date, @mood, @energy, @sleepHours, @cravings, @note)",
    d.journal,
  );
});

export const me = Router();

me.get("/", (_req, res) => {
  res.json(toUser(getUser.get(res.locals.userId)!));
});

me.patch("/", (req, res) => {
  const patch = parse(userPatch, req.body);
  const sets = Object.keys(patch).map((k) => `${k} = @${k}`);
  try {
    named(`UPDATE users SET ${sets.join(", ")} WHERE id = @id`).run({ ...patch, id: res.locals.userId });
  } catch (err) {
    if (err instanceof SqliteError && err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new HttpError(409, "email-taken", "This email is already registered.", undefined, [
        { pointer: "/email", detail: "An account with this email already exists." },
      ]);
    }
    throw err;
  }
  res.json(toUser(getUser.get(res.locals.userId)!));
});

me.delete("/", (_req, res) => {
  deleteUser.run(res.locals.userId);
  res.status(204).end();
});

me.delete("/data", (_req, res) => {
  clearLogs(res.locals.userId);
  res.status(204).end();
});

// Replaces the logs and profile goals with the sample journey, keeping the user's time zone.
me.put("/demo-data", (_req, res) => {
  const current = getProfile(res.locals.userId);
  const timeZone = current?.timeZone ?? "UTC";
  insertDemo(res.locals.userId, generateDemoData(todayIn(timeZone)), timeZone, current?.cuisine ?? "tamil-nadu");
  res.status(204).end();
});
