import { randomUUID } from "node:crypto";
import { Router } from "express";
import { SqliteError } from "better-sqlite3";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { config } from "../config.js";
import { issueAccessToken } from "../auth/tokens.js";
import { db } from "../db/index.js";
import { HttpError } from "../http/problem.js";
import { rateLimit } from "../http/rate-limit.js";
import { body, email, parse, personName } from "../http/validate.js";
import { toUser, type UserRow } from "../lib/users.js";

// Mirror RegisterRequest and LoginRequest in api/openapi.yaml.
const registerInput = body({
  email,
  name: personName,
  password: z
    .string({ error: "Password is required." })
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password must be at most 128 characters."),
});
const loginInput = body({
  email,
  password: z.string({ error: "Password is required." }).min(1, "Password is required.").max(128, "Password is incorrect."),
});

const insertUser = db.prepare<{ id: string; email: string; name: string }, UserRow>(
  "INSERT INTO users (id, email, name) VALUES (@id, @email, @name) RETURNING id, email, name, created_at",
);
const insertCredentials = db.prepare("INSERT INTO user_credentials (user_id, password_hash) VALUES (?, ?)");
const createAccount = db.transaction((user: { id: string; email: string; name: string }, passwordHash: string) => {
  const row = insertUser.get(user)!;
  insertCredentials.run(user.id, passwordHash);
  return row;
});
const findLogin = db.prepare<[string], UserRow & { password_hash: string }>(
  `SELECT u.id, u.email, u.name, u.created_at, c.password_hash
   FROM users u JOIN user_credentials c ON c.user_id = u.id WHERE u.email = ?`,
);

// Verified against when the email is unknown, so both paths take the same time.
const dummyHash = hashPassword(randomUUID());

async function session(user: UserRow) {
  return { ...(await issueAccessToken(user.id)), tokenType: "Bearer", user: toUser(user) };
}

const limitByIp = (max: number) =>
  rateLimit({ windowMs: 15 * 60_000, max, key: (req) => req.ip ?? "unknown", title: "Too many attempts. Try again later." });
const limitByEmail = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  key: (req) => `login:${String(req.body?.email ?? "").trim().toLowerCase()}`,
  title: "Too many sign-in attempts for this email. Try again later.",
});

export const auth = Router();

auth.post("/register", limitByIp(config.registerLimit), async (req, res) => {
  const { password, ...profile } = parse(registerInput, req.body);

  // Hash before touching the database so the write transaction stays short.
  const passwordHash = await hashPassword(password);
  let user: UserRow;
  try {
    user = createAccount({ id: randomUUID(), ...profile }, passwordHash);
  } catch (err) {
    if (err instanceof SqliteError && err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new HttpError(409, "email-taken", "This email is already registered.", undefined, [
        { pointer: "/email", detail: "An account with this email already exists." },
      ]);
    }
    throw err;
  }
  res.status(201).set("Cache-Control", "no-store").json(await session(user));
});

auth.post("/login", limitByIp(50), limitByEmail, async (req, res) => {
  const { email, password } = parse(loginInput, req.body);
  const row = findLogin.get(email);
  const ok = await verifyPassword(password, row?.password_hash ?? (await dummyHash));
  if (!row || !ok) throw new HttpError(401, "invalid-credentials", "Email or password is incorrect.");
  res.set("Cache-Control", "no-store").json(await session(row));
});
