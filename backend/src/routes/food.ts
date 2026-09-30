import { randomUUID } from "node:crypto";
import { Router } from "express";
import { SqliteError } from "better-sqlite3";
import { z } from "zod";
import { db } from "../db/index.js";
import { named } from "../db/named.js";
import { iso } from "../lib/dates.js";
import { decodeCursor, page } from "../http/pagination.js";
import { HttpError } from "../http/problem.js";
import { body, checkRange, date, grams, kcal, mealType, parse, rangeQuery, text, uuid } from "../http/validate.js";
import { notFound } from "./daily.js";

export interface FoodRow {
  id: string;
  date: string;
  meal: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
  favorite_id: string | null;
  created_at: number;
  updated_at: number;
}

export const toFood = (r: FoodRow) => ({
  id: r.id,
  date: r.date,
  meal: r.meal,
  name: r.name,
  calories: r.calories,
  protein: r.protein,
  carbs: r.carbs,
  fat: r.fat,
  source: r.source,
  favoriteId: r.favorite_id,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

const nutrition = { calories: kcal, protein: grams, carbs: grams, fat: grams };
// Read-only fields a client may echo back (e.g. when re-posting a deleted entry to undo); ignored.
const echoed = { id: z.unknown().optional(), createdAt: z.unknown().optional(), updatedAt: z.unknown().optional() };

const createInput = body({
  ...echoed,
  date,
  meal: mealType,
  name: text(200, "Name"),
  ...nutrition,
  source: z.enum(["manual", "ai-text", "ai-photo", "favorite"], "Must be manual, ai-text, ai-photo or favorite.").default("manual"),
  favoriteId: uuid.nullable().default(null),
}).superRefine((v, ctx) => {
  if (v.favoriteId && v.source !== "favorite") {
    ctx.addIssue({ code: "custom", path: ["favoriteId"], message: "Only allowed when source is favorite." });
  }
});
const patchInput = body({
  date: date.optional(),
  meal: mealType.optional(),
  name: text(200, "Name").optional(),
  calories: kcal.optional(),
  protein: grams.optional(),
  carbs: grams.optional(),
  fat: grams.optional(),
}).refine((v) => Object.keys(v).length > 0, "Send at least one field.");
const listQuery = z
  .object({ ...rangeQuery, date: date.optional(), meal: mealType.optional() })
  .superRefine((q, ctx) => {
    if (q.date && (q.from || q.to)) ctx.addIssue({ code: "custom", path: ["date"], message: "Use either date, or from and to." });
    checkRange(q, ctx);
  });

const getOne = db.prepare<[string, string], FoodRow>("SELECT * FROM food_entries WHERE id = ? AND user_id = ?");
const ownsFavorite = db.prepare("SELECT 1 FROM favorite_foods WHERE id = ? AND user_id = ?");

export const foodEntries = Router();

foodEntries.get("/", (req, res) => {
  const q = parse(listQuery, req.query);
  const after = decodeCursor(q.cursor, 3);
  const where = ["user_id = @userId"];
  if (q.date) where.push("date = @date");
  if (q.from) where.push("date >= @from");
  if (q.to) where.push("date <= @to");
  if (q.meal) where.push("meal = @meal");
  if (after) where.push("(date, created_at, id) > (@a0, @a1, @a2)");
  const rows = named(`SELECT * FROM food_entries WHERE ${where.join(" AND ")} ORDER BY date, created_at, id LIMIT @limit`).all({ userId: res.locals.userId, ...q, a0: after?.[0], a1: after?.[1], a2: after?.[2], limit: q.limit + 1 }) as FoodRow[];
  const p = page(rows, q.limit, (r) => [r.date, r.created_at, r.id]);
  res.json({ data: p.data.map(toFood), nextCursor: p.nextCursor });
});

foodEntries.post("/", (req, res) => {
  const { id: _i, createdAt: _c, updatedAt: _u, favoriteId, ...input } = parse(createInput, req.body);
  if (favoriteId && !ownsFavorite.get(favoriteId, res.locals.userId)) {
    throw new HttpError(400, "validation-failed", "Your request is not valid.", undefined, [
      { pointer: "/favoriteId", detail: "No favorite with this id." },
    ]);
  }
  const id = randomUUID();
  named(
    `INSERT INTO food_entries (id, user_id, favorite_id, date, meal, name, calories, protein, carbs, fat, source)
     VALUES (@id, @userId, @favoriteId, @date, @meal, @name, @calories, @protein, @carbs, @fat, @source)`,
  ).run({ id, userId: res.locals.userId, favoriteId, ...input });
  res
    .status(201)
    .location(`${req.baseUrl}/${id}`)
    .json(toFood(getOne.get(id, res.locals.userId)!));
});

const idParam = z.object({ foodEntryId: uuid });

foodEntries.get("/:foodEntryId", (req, res) => {
  const { foodEntryId } = parse(idParam, req.params);
  const row = getOne.get(foodEntryId, res.locals.userId);
  if (!row) throw notFound();
  res.json(toFood(row));
});

foodEntries.patch("/:foodEntryId", (req, res) => {
  const { foodEntryId } = parse(idParam, req.params);
  const patch = parse(patchInput, req.body);
  const sets = Object.keys(patch).map((k) => `${k} = @${k}`);
  const { changes } = named(`UPDATE food_entries SET ${sets.join(", ")} WHERE id = @id AND user_id = @userId`).run({ ...patch, id: foodEntryId, userId: res.locals.userId });
  if (!changes) throw notFound();
  res.json(toFood(getOne.get(foodEntryId, res.locals.userId)!));
});

foodEntries.delete("/:foodEntryId", (req, res) => {
  const { foodEntryId } = parse(idParam, req.params);
  const { changes } = db.prepare("DELETE FROM food_entries WHERE id = ? AND user_id = ?").run(foodEntryId, res.locals.userId);
  if (!changes) throw notFound();
  res.status(204).end();
});

/* ---------------- Favorites ---------------- */

interface FavoriteRow {
  id: string;
  name: string;
  meal: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
const toFavorite = ({ id, name, meal, calories, protein, carbs, fat }: FavoriteRow) => ({ id, name, meal, calories, protein, carbs, fat });
const favoriteInput = body({ id: z.unknown().optional(), name: text(200, "Name"), meal: mealType, ...nutrition });

export const favoriteFoods = Router();

favoriteFoods.get("/", (_req, res) => {
  const rows = db.prepare("SELECT * FROM favorite_foods WHERE user_id = ? ORDER BY name COLLATE NOCASE, id").all(res.locals.userId) as FavoriteRow[];
  res.json({ data: rows.map(toFavorite) });
});

favoriteFoods.post("/", (req, res) => {
  const { id: _, ...input } = parse(favoriteInput, req.body);
  const id = randomUUID();
  try {
    named(
      `INSERT INTO favorite_foods (id, user_id, name, meal, calories, protein, carbs, fat)
       VALUES (@id, @userId, @name, @meal, @calories, @protein, @carbs, @fat)`,
    ).run({ id, userId: res.locals.userId, ...input });
  } catch (err) {
    if (err instanceof SqliteError && err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new HttpError(409, "favorite-exists", "You already have a favorite with this name.", undefined, [
        { pointer: "/name", detail: "A favorite with this name already exists." },
      ]);
    }
    throw err;
  }
  res.status(201).location(`${req.baseUrl}/${id}`).json({ id, ...input });
});

favoriteFoods.delete("/:favoriteFoodId", (req, res) => {
  const { favoriteFoodId } = parse(z.object({ favoriteFoodId: uuid }), req.params);
  const { changes } = db.prepare("DELETE FROM favorite_foods WHERE id = ? AND user_id = ?").run(favoriteFoodId, res.locals.userId);
  if (!changes) throw notFound();
  res.status(204).end();
});
