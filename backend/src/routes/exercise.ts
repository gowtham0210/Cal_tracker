import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { named } from "../db/named.js";
import { iso } from "../lib/dates.js";
import { decodeCursor, page } from "../http/pagination.js";
import { body, checkRange, date, kcal, parse, rangeQuery, text, uuid } from "../http/validate.js";
import { notFound } from "./daily.js";

interface ExerciseRow {
  id: string;
  date: string;
  name: string;
  minutes: number;
  calories: number;
  created_at: number;
}
const toExercise = (r: ExerciseRow) => ({ id: r.id, date: r.date, name: r.name, minutes: r.minutes, calories: r.calories, createdAt: iso(r.created_at) });

const input = body({
  id: z.unknown().optional(),
  createdAt: z.unknown().optional(),
  date,
  name: text(100, "Name"),
  minutes: z.int("Must be a whole number.").min(1, "Must be 1 to 1440.").max(1440, "Must be 1 to 1440."),
  calories: kcal,
});
const listQuery = z
  .object({ ...rangeQuery, date: date.optional() })
  .superRefine((q, ctx) => {
    if (q.date && (q.from || q.to)) ctx.addIssue({ code: "custom", path: ["date"], message: "Use either date, or from and to." });
    checkRange(q, ctx);
  });
const getOne = db.prepare<[string, string], ExerciseRow>("SELECT * FROM exercise_entries WHERE id = ? AND user_id = ?");

export const exerciseEntries = Router();

exerciseEntries.get("/", (req, res) => {
  const q = parse(listQuery, req.query);
  const after = decodeCursor(q.cursor, 3);
  const where = ["user_id = @userId"];
  if (q.date) where.push("date = @date");
  if (q.from) where.push("date >= @from");
  if (q.to) where.push("date <= @to");
  if (after) where.push("(date, created_at, id) > (@a0, @a1, @a2)");
  const rows = named(`SELECT * FROM exercise_entries WHERE ${where.join(" AND ")} ORDER BY date, created_at, id LIMIT @limit`).all({ userId: res.locals.userId, date: q.date, from: q.from, to: q.to, a0: after?.[0], a1: after?.[1], a2: after?.[2], limit: q.limit + 1 }) as ExerciseRow[];
  const p = page(rows, q.limit, (r) => [r.date, r.created_at, r.id]);
  res.json({ data: p.data.map(toExercise), nextCursor: p.nextCursor });
});

exerciseEntries.post("/", (req, res) => {
  const { id: _i, createdAt: _c, ...e } = parse(input, req.body);
  const id = randomUUID();
  named("INSERT INTO exercise_entries (id, user_id, date, name, minutes, calories) VALUES (@id, @userId, @date, @name, @minutes, @calories)").run({
    id,
    userId: res.locals.userId,
    ...e,
  });
  res.status(201).location(`${req.baseUrl}/${id}`).json(toExercise(getOne.get(id, res.locals.userId)!));
});

exerciseEntries.delete("/:exerciseEntryId", (req, res) => {
  const { exerciseEntryId } = parse(z.object({ exerciseEntryId: uuid }), req.params);
  const { changes } = db.prepare("DELETE FROM exercise_entries WHERE id = ? AND user_id = ?").run(exerciseEntryId, res.locals.userId);
  if (!changes) throw notFound();
  res.status(204).end();
});
