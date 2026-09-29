import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { named } from "../db/named.js";
import { iso } from "../lib/dates.js";
import { decodeCursor, page } from "../http/pagination.js";
import { HttpError } from "../http/problem.js";
import { checkRange, date, parse, rangeQuery } from "../http/validate.js";

/**
 * One-entry-per-day resources (weight, measurements, water, journal): the date is the key,
 * PUT creates or replaces, and the list pages by date.
 */
export function dailyResource<S extends z.ZodType<Record<string, unknown>>>(opts: {
  table: string;
  /** Columns written from the parsed body, as [apiField, column]. */
  columns: [string, string][];
  /** Whether the table has its own id column (weight and measurement entries do). */
  hasId: boolean;
  /** Expose GET /{date} (only the journal has it in the spec). */
  getOne?: boolean;
  input: S;
  /** Called before a delete; throw to refuse it. */
  beforeDelete?: (userId: string, date: string) => void;
}) {
  const { table, columns, hasId } = opts;
  const cols = columns.map(([, c]) => c);
  const select = `SELECT date, ${cols.join(", ")}, updated_at FROM ${table}`;
  const toApi = (row: Record<string, unknown>) => {
    const out: Record<string, unknown> = { date: row.date };
    for (const [field, col] of columns) if (row[col] !== null) out[field] = row[col];
    out.updatedAt = iso(row.updated_at as number);
    return out;
  };

  const exists = db.prepare(`SELECT 1 FROM ${table} WHERE user_id = ? AND date = ?`);
  const getOne = db.prepare(`${select} WHERE user_id = ? AND date = ?`);
  const upsert = named(
    `INSERT INTO ${table} (${hasId ? "id, " : ""}user_id, date, ${cols.join(", ")})
     VALUES (${hasId ? "@id, " : ""}@userId, @date, ${cols.map((c) => "@" + c).join(", ")})
     ON CONFLICT (user_id, date) DO UPDATE SET ${cols.map((c) => `${c} = excluded.${c}`).join(", ")}`,
  );
  const remove = db.prepare(`DELETE FROM ${table} WHERE user_id = ? AND date = ?`);
  const put = db.transaction((userId: string, day: string, values: Record<string, unknown>) => {
    const created = !exists.get(userId, day);
    const params: Record<string, unknown> = { id: randomUUID(), userId, date: day };
    for (const [field, col] of columns) params[col] = values[field] ?? null;
    if (!hasId) delete params.id;
    upsert.run(params);
    return created;
  });

  const listQuery = z.object(rangeQuery).superRefine(checkRange);
  const router = Router();

  router.get("/", (req, res) => {
    const q = parse(listQuery, req.query);
    const after = decodeCursor(q.cursor, 1);
    const where = ["user_id = @userId"];
    if (q.from) where.push("date >= @from");
    if (q.to) where.push("date <= @to");
    if (after) where.push("date > @after");
    const rows = named(`${select} WHERE ${where.join(" AND ")} ORDER BY date LIMIT @limit`).all({ userId: res.locals.userId, from: q.from, to: q.to, after: after?.[0], limit: q.limit + 1 }) as Record<string, unknown>[];
    res.json(page(rows.map(toApi), q.limit, (r) => [r.date as string]));
  });

  const day = (req: Request) => parse(z.object({ date }), req.params).date;

  if (opts.getOne) router.get("/:date", (req, res) => {
    const row = getOne.get(res.locals.userId, day(req)) as Record<string, unknown> | undefined;
    if (!row) throw notFound();
    res.json(toApi(row));
  });

  router.put("/:date", (req: Request, res: Response) => {
    const d = day(req);
    const created = put(res.locals.userId, d, parse(opts.input, req.body));
    res.status(created ? 201 : 200).json(toApi(getOne.get(res.locals.userId, d) as Record<string, unknown>));
  });

  router.delete("/:date", (req, res) => {
    const d = day(req);
    opts.beforeDelete?.(res.locals.userId, d);
    if (!remove.run(res.locals.userId, d).changes) throw notFound();
    res.status(204).end();
  });

  return router;
}

export const notFound = () => new HttpError(404, "not-found", "Not found.");
