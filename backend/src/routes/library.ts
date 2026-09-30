import { Router } from "express";
import { z } from "zod";
import { listLibrary } from "../lib/library.js";
import { mealType, parse } from "../http/validate.js";
import { getProfile } from "./profile.js";

export const library = Router();

const listQuery = z.object({
  tab: z.enum(["usual", "favorites", "new", "all"], "Must be usual, favorites, new or all.").default("usual"),
  meal: mealType.optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

library.get("/", (req, res) => {
  const q = parse(listQuery, req.query);
  const p = getProfile(res.locals.userId);
  res.json({ data: listLibrary(res.locals.userId, { ...q, cuisine: p?.cuisine ?? "tamil-nadu", allergies: p?.allergies ?? [] }) });
});
