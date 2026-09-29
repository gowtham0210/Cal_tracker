import { randomUUID } from "node:crypto";
import { Router } from "express";
import { SqliteError } from "better-sqlite3";
import { z } from "zod";
import { hashPassword } from "../auth/password.js";
import { issueAccessToken } from "../auth/tokens.js";
import { db } from "../db/index.js";
import { HttpError, validationError } from "../http/problem.js";

// Mirrors RegisterRequest in api/openapi.yaml (additionalProperties: false).
const registerInput = z.strictObject(
  {
    email: z
      .string({ error: "Email is required." })
      .trim()
      .toLowerCase()
      .max(254, "Email must be at most 254 characters.")
      .pipe(z.email("Enter a valid email address.")),
    name: z
      .string({ error: "Name is required." })
      .trim()
      .min(1, "Name is required.")
      .max(80, "Name must be at most 80 characters."),
    password: z
      .string({ error: "Password is required." })
      .min(8, "Password must be at least 8 characters.")
      .max(128, "Password must be at most 128 characters."),
  },
  { error: (issue) => (issue.code === "unrecognized_keys" ? `Unknown field: ${issue.keys.join(", ")}.` : "Send a JSON object.") },
);

const insertUser = db.prepare<{ id: string; email: string; name: string }, { created_at: number }>(
  "INSERT INTO users (id, email, name) VALUES (@id, @email, @name) RETURNING created_at",
);
const insertCredentials = db.prepare("INSERT INTO user_credentials (user_id, password_hash) VALUES (?, ?)");
const createAccount = db.transaction((user: { id: string; email: string; name: string }, passwordHash: string) => {
  const { created_at } = insertUser.get(user)!;
  insertCredentials.run(user.id, passwordHash);
  return created_at;
});

export const auth = Router();

auth.post("/register", async (req, res) => {
  const parsed = registerInput.safeParse(req.body);
  if (!parsed.success) throw validationError(parsed.error);
  const { password, ...profile } = parsed.data;

  // Hash before touching the database so the write transaction stays short.
  const passwordHash = await hashPassword(password);
  const user = { id: randomUUID(), ...profile };

  let createdAt: number;
  try {
    createdAt = createAccount(user, passwordHash);
  } catch (err) {
    if (err instanceof SqliteError && err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new HttpError(409, "email-taken", "This email is already registered.", undefined, [
        { pointer: "/email", detail: "An account with this email already exists." },
      ]);
    }
    throw err;
  }

  const token = await issueAccessToken(user.id);
  res
    .status(201)
    .set("Cache-Control", "no-store")
    .json({
      ...token,
      tokenType: "Bearer",
      user: { ...user, createdAt: new Date(createdAt).toISOString() },
    });
});
