import { z } from "zod";
import { isValidTimeZone } from "../lib/dates.js";
import { validationError } from "./problem.js";

/** Parses `data` or throws a 400 problem that points at each invalid field. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw validationError(result.error);
  return result.data;
}

/** A request body object that rejects unknown fields (additionalProperties: false). */
export const body = <T extends z.ZodRawShape>(shape: T) =>
  z.strictObject(shape, {
    error: (issue) => (issue.code === "unrecognized_keys" ? `Unknown field: ${issue.keys.join(", ")}.` : "Send a JSON object."),
  });

// Shared field rules, mirroring components/schemas in api/openapi.yaml.
export const date = z.iso.date("Use a real date in YYYY-MM-DD format.");
export const uuid = z.uuid("Must be a UUID.");
export const kcal = z.number("Must be a number.").min(0, "Must be 0 or more.");
export const grams = z.number("Must be a number.").min(0, "Must be 0 or more.");
export const mealType = z.enum(["breakfast", "lunch", "dinner", "snack"], "Must be breakfast, lunch, dinner or snack.");
export const timeZone = z.string().refine(isValidTimeZone, "Must be an IANA time zone such as Asia/Kolkata.");
export const email = z
  .string({ error: "Email is required." })
  .trim()
  .toLowerCase()
  .max(254, "Email must be at most 254 characters.")
  .pipe(z.email("Enter a valid email address."));
export const personName = z
  .string({ error: "Name is required." })
  .trim()
  .min(1, "Name is required.")
  .max(80, "Name must be at most 80 characters.");
export const text = (max: number, label = "This field") =>
  z.string(`${label} must be text.`).trim().min(1, `${label} is required.`).max(max, `${label} must be at most ${max} characters.`);

/** Query parameters for date-range lists. */
export const rangeQuery = {
  from: date.optional(),
  to: date.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  cursor: z.string().optional(),
};

/** Rejects `from` after `to`. */
export const checkRange = (q: { from?: string; to?: string }, ctx: z.RefinementCtx) => {
  if (q.from && q.to && q.from > q.to) ctx.addIssue({ code: "custom", path: ["from"], message: "`from` must be on or before `to`." });
};
