import { Router } from "express";
import { z } from "zod";
import { listLibrary } from "../lib/library.js";
import { acceptNewFood, suggestNewFoods } from "../lib/new-foods.js";
import { body, grams, kcal, mealType, parse, text } from "../http/validate.js";
import { aiRateLimit } from "./coach.js";
import { getProfile, requireProfile } from "./profile.js";

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

/* ---------------- Try new ---------------- */

library.post("/suggestions", aiRateLimit, async (req, res) => {
  const { meal } = parse(body({ meal: mealType.optional() }), req.body ?? {});
  res.json({ data: await suggestNewFoods(res.locals.userId, requireProfile(res.locals.userId), meal) });
});

const newFoodInput = body({
  name: text(60, "Name"),
  meal: mealType,
  serving: text(60, "Serving"),
  calories: kcal.max(5000, "Must be at most 5000."),
  protein: grams.max(500, "Must be at most 500."),
  carbs: grams.max(1000, "Must be at most 1000."),
  fat: grams.max(500, "Must be at most 500."),
  confidence: z.enum(["high", "medium", "low"], "Must be high, medium or low.").optional(),
  cuisine: z.enum(["tamil-nadu", "south-indian", "north-indian"], "Must be tamil-nadu, south-indian or north-indian.").nullable().optional(),
  diet: z.enum(["veg", "eggetarian", "non-veg"], "Must be veg, eggetarian or non-veg.").nullable().optional(),
  allergens: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
});

library.post("/", (req, res) => {
  const food = acceptNewFood(res.locals.userId, requireProfile(res.locals.userId), parse(newFoodInput, req.body));
  res.status(201).location(`${req.baseUrl}/${food.id}`).json(food);
});
