import { z } from "zod";
import { SAFETY_RULES, untrusted } from "../safety.js";
import type { ChatMessage } from "../llm.js";

export const PROMPT = "food-estimate@v1";

const SYSTEM = `You estimate the nutrition of food the user has eaten, for a calorie tracking app.

For each distinct food or drink:
- name: a short, common name (e.g. "Chapati", "Greek yogurt").
- quantity: how many servings were eaten. Use the amount the user gives; otherwise assume 1 typical serving.
- serving: what one serving is, in words (e.g. "1 medium", "1 cup cooked", "150 g").
- calories, protein, carbs, fat: totals for the whole quantity eaten (not per serving), in kcal and grams.
- confidence: "high" when the food and amount are clear, "medium" when you assumed the amount, "low" when the food itself is unclear.

Use typical values from standard food composition data. Include Indian and other regional dishes.
Combine duplicates. If the input does not describe food or drink, return an empty list.

${SAFETY_RULES}`;

const PHOTO = "Identify each food and drink visible in this meal photo and estimate the portion shown.";

export const jsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "serving", "calories", "protein", "carbs", "fat", "confidence"],
        properties: {
          name: { type: "string" },
          quantity: { type: "number" },
          serving: { type: "string" },
          calories: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
  },
};

// Bounds the model must respect; anything outside is treated as a failed answer.
export const schema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        quantity: z.number().gt(0).max(50),
        serving: z.string().trim().min(1).max(60),
        calories: z.number().min(0).max(5000),
        protein: z.number().min(0).max(500),
        carbs: z.number().min(0).max(1000),
        fat: z.number().min(0).max(500),
        confidence: z.enum(["high", "medium", "low"]),
      }),
    )
    .max(20),
});

export function textMessages(text: string): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: untrusted("user_input", text) },
  ];
}

export function photoMessages(dataUrl: string): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: [
        { type: "text", text: PHOTO },
        { type: "image_url", image_url: { url: dataUrl, detail: "auto" } },
      ],
    },
  ];
}

/**
 * Deterministic clean-up after validation: round for display, and lower confidence when the
 * calories don't agree with the macros (4/4/9 kcal per gram), a sign the estimate is off.
 */
export function finalize(items: z.output<typeof schema>["items"]) {
  return items.map((i) => {
    const fromMacros = i.protein * 4 + i.carbs * 4 + i.fat * 9;
    const inconsistent = i.calories > 50 && Math.abs(fromMacros - i.calories) / i.calories > 0.35;
    return {
      name: i.name,
      quantity: Math.round(i.quantity * 100) / 100,
      serving: i.serving,
      calories: Math.round(i.calories),
      protein: Math.round(i.protein),
      carbs: Math.round(i.carbs),
      fat: Math.round(i.fat),
      confidence: inconsistent ? ("low" as const) : i.confidence,
    };
  });
}
