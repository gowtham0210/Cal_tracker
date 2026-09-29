import type { NextFunction, Request, Response } from "express";
import { db } from "../db/index.js";

// TEMPORARY: identifies the user from the X-User-Id header until real auth exists.
// Anyone who knows a user id can act as that user. Replace before deploying.
export function currentUser(req: Request, res: Response, next: NextFunction) {
  const id = req.header("x-user-id");
  const user = id && db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!user) {
    res.status(401).json({ error: "Unknown or missing X-User-Id" });
    return;
  }
  res.locals.userId = id;
  next();
}
