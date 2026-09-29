import { randomUUID } from "node:crypto";
import { Router } from "express";
import { SqliteError } from "better-sqlite3";
import { z } from "zod";
import { db } from "../db/index.js";

const userInput = z.object({
  email: z.email(),
  name: z.string().trim().min(1),
});

export const users = Router();

users.post("/", (req, res) => {
  const parsed = userInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: z.treeifyError(parsed.error) });
    return;
  }
  try {
    const user = db
      .prepare("INSERT INTO users (id, email, name) VALUES (@id, @email, @name) RETURNING id, email, name, created_at AS createdAt")
      .get({ id: randomUUID(), ...parsed.data });
    res.status(201).json(user);
  } catch (err) {
    if (err instanceof SqliteError && err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    throw err;
  }
});
