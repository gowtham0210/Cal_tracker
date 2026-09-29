import { Router, type Request } from "express";
import { z } from "zod";
import { addItem, buildPlan, removeItem, updateItem } from "../lib/plan.js";
import { body, date, mealType, parse, uuid } from "../http/validate.js";
import { requireProfile } from "./profile.js";

export const monday = date.refine((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 1, "Must be a Monday.");
export const quantity = z
  .number("Must be a number.")
  .min(0.25, "Must be at least 0.25.")
  .max(10, "Must be at most 10.")
  .refine((q) => Number.isInteger(q * 4), "Use quarter servings (0.25 steps).");

export const weekParam = (req: Request) => parse(z.object({ weekStart: monday }), { weekStart: req.params.weekStart }).weekStart;
const itemParam = (req: Request) => parse(z.object({ itemId: uuid }), { itemId: req.params.itemId }).itemId;

/** The plan response for the current user and week. */
export const planResponse = (userId: string, weekStart: string) => buildPlan(userId, weekStart, requireProfile(userId).calorieGoal);

const itemInput = body({ date, meal: mealType, foodId: uuid, quantity: quantity.default(1) });
const itemPatch = body({ date: date.optional(), meal: mealType.optional(), foodId: uuid.optional(), quantity: quantity.optional(), position: z.int().min(0).optional() }).refine(
  (v) => Object.keys(v).length > 0,
  "Send at least one field.",
);

export const plans = Router();

plans.get("/:weekStart", (req, res) => {
  res.json(planResponse(res.locals.userId, weekParam(req)));
});

plans.post("/:weekStart/items", (req, res) => {
  const weekStart = weekParam(req);
  requireProfile(res.locals.userId);
  addItem(res.locals.userId, weekStart, parse(itemInput, req.body));
  res.status(201).json(planResponse(res.locals.userId, weekStart));
});

plans.patch("/:weekStart/items/:itemId", (req, res) => {
  const weekStart = weekParam(req);
  updateItem(res.locals.userId, weekStart, itemParam(req), parse(itemPatch, req.body));
  res.json(planResponse(res.locals.userId, weekStart));
});

plans.delete("/:weekStart/items/:itemId", (req, res) => {
  const weekStart = weekParam(req);
  removeItem(res.locals.userId, weekStart, itemParam(req));
  res.json(planResponse(res.locals.userId, weekStart));
});
