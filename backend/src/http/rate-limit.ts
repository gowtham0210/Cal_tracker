import type { RequestHandler } from "express";
import { HttpError } from "./problem.js";

// Fixed-window, in-memory limiter. Good enough for one server process; move to a shared
// store (e.g. Redis) before running several instances.
export function rateLimit(opts: { windowMs: number; max: number; key: (req: Parameters<RequestHandler>[0]) => string; title: string }): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req, res, next) => {
    const now = Date.now();
    const key = opts.key(req);
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + opts.windowMs };
      hits.set(key, entry);
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }
    if (++entry.count > opts.max) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      throw new HttpError(429, "rate-limited", opts.title);
    }
    next();
  };
}
