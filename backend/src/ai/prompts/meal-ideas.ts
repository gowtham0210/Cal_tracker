import { z } from "zod";
import { SAFETY_RULES } from "../safety.js";
import type { ChatMessage } from "../llm.js";

export const PROMPT = "meal-ideas@v1";

const SYSTEM = `You suggest simple, healthy meal ideas for a weight loss app.

Given the calories and protein the user has left today, suggest exactly "count" different ideas:
- Each idea must be at most "maxCalories" kcal. Prefer high-protein ideas when "proteinLeft_g" is above 30.
- If "meal" is given, every idea must be for that meal.
- Take inspiration from foods the user already eats ("usualFoods"), but vary them.
- name: short and appetising (max 60 characters). tags: 1–3 short labels such as "high protein", "5 min", "vegetarian".
- calories, protein, carbs and fat are for the whole idea, in kcal and grams, from typical food composition data.

${SAFETY_RULES}`;

export const jsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ideas"],
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "meal", "calories", "protein", "carbs", "fat", "tags"],
        properties: {
          name: { type: "string" },
          meal: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
          calories: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
          tags: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

export const schema = z.object({
  ideas: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        meal: z.enum(["breakfast", "lunch", "dinner", "snack"]),
        calories: z.number().min(0).max(3000),
        protein: z.number().min(0).max(300),
        carbs: z.number().min(0).max(500),
        fat: z.number().min(0).max(300),
        tags: z.array(z.string().trim().min(1).max(24)).max(3),
      }),
    )
    .max(10),
});

export const messages = (facts: object): ChatMessage[] => [
  { role: "system", content: SYSTEM },
  { role: "user", content: `<facts>\n${JSON.stringify(facts)}\n</facts>` },
];
