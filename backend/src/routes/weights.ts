import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";

const weightInput = z.object({
  date: z.iso.date(),
  weight: z.number().positive(),
});

export const weights = Router();

weights.get("/", (_req, res) => {
  res.json(db.prepare("SELECT id, date, weight FROM weight_entries WHERE user_id = ? ORDER BY date").all(res.locals.userId));
});

// One weight per day: logging again for the same date replaces it.
weights.post("/", (req, res) => {
  const parsed = weightInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: z.treeifyError(parsed.error) });
    return;
  }
  const entry = db
    .prepare(
      `INSERT INTO weight_entries (id, user_id, date, weight) VALUES (@id, @userId, @date, @weight)
       ON CONFLICT (user_id, date) DO UPDATE SET weight = excluded.weight
       RETURNING id, date, weight`,
    )
    .get({ id: randomUUID(), userId: res.locals.userId, ...parsed.data });
  res.status(201).json(entry);
});

weights.delete("/:id", (req, res) => {
  const { changes } = db.prepare("DELETE FROM weight_entries WHERE id = ? AND user_id = ?").run(req.params.id, res.locals.userId);
  res.status(changes ? 204 : 404).end();
});
