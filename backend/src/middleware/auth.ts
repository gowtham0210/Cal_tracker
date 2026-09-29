import type { RequestHandler } from "express";
import { verifyAccessToken } from "../auth/tokens.js";
import { db } from "../db/index.js";
import { HttpError } from "../http/problem.js";

const userExists = db.prepare<[string], { id: string }>("SELECT id FROM users WHERE id = ?");

/** Requires `Authorization: Bearer <token>` and puts the user id in res.locals.userId. */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const match = /^Bearer (\S+)$/i.exec(req.header("authorization") ?? "");
  let userId: string | undefined;
  if (match) {
    try {
      userId = await verifyAccessToken(match[1]);
    } catch {}
  }
  // A token for a deleted account is as invalid as a forged one.
  if (!userId || !userExists.get(userId)) {
    res.set("WWW-Authenticate", 'Bearer realm="lighter"');
    throw new HttpError(401, "unauthorized", "Sign in to continue.", "The bearer token is missing, invalid or expired.");
  }
  res.locals.userId = userId;
  next();
};

declare module "express-serve-static-core" {
  interface Locals {
    userId: string;
  }
}
