import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { daysBetween, todayIn } from "../lib/dates.js";
import { badges, dayTotals, overview } from "../lib/stats.js";
import { date, parse } from "../http/validate.js";
import { requireProfile } from "./profile.js";

export const asOfQuery = z.object({ asOf: date.optional() });

export const insights = Router();

insights.get("/overview", (req, res) => {
  const p = requireProfile(res.locals.userId);
  const { asOf = todayIn(p.timeZone) } = parse(asOfQuery, req.query);
  res.json(overview(res.locals.userId, p, asOf));
});

const dailyQuery = z
  .object({ from: date, to: date })
  .superRefine((q, ctx) => {
    if (q.from > q.to) ctx.addIssue({ code: "custom", path: ["from"], message: "`from` must be on or before `to`." });
    else if (daysBetween(q.from, q.to) > 365) ctx.addIssue({ code: "custom", path: ["to"], message: "The range can be at most 366 days." });
  });

insights.get("/daily", (req, res) => {
  const { from, to } = parse(dailyQuery, req.query);
  const userId = res.locals.userId;
  const lookup = (sql: string) => new Map((db.prepare(sql).all(userId, from, to) as { date: string; v: number }[]).map((r) => [r.date, r.v]));
  const weight = lookup("SELECT date, weight AS v FROM weight_entries WHERE user_id = ? AND date BETWEEN ? AND ?");
  const water = lookup("SELECT date, glasses AS v FROM water_entries WHERE user_id = ? AND date BETWEEN ? AND ?");
  const mood = lookup("SELECT date, mood AS v FROM journal_entries WHERE user_id = ? AND date BETWEEN ? AND ? AND mood IS NOT NULL");
  res.json({
    data: dayTotals(userId, from, to).map((t) => ({
      ...t,
      weight: weight.get(t.date) ?? null,
      waterGlasses: water.get(t.date) ?? null,
      mood: mood.get(t.date) ?? null,
    })),
  });
});

insights.get("/badges", (_req, res) => {
  const p = requireProfile(res.locals.userId);
  res.json({ data: badges(res.locals.userId, p, todayIn(p.timeZone)) });
});
