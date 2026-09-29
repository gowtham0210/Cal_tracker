import { z } from "zod";
import { SAFETY_RULES } from "../safety.js";
import type { ChatMessage } from "../llm.js";

export const PROMPT = "meal-ideas@v2";

const SYSTEM = `You suggest simple, healthy meal ideas for a weight loss app.

Given the calories and protein the user has left today, suggest exactly "count" different ideas:
- Every idea must be a dish from the food style in "cuisine" (see below), made the everyday home way, with a realistic portion.
- Each idea must be at most "maxCalories" kcal. Prefer high-protein ideas when "proteinLeft_g" is above 30.
- If "meal" is given, every idea must be for that meal.
- Take inspiration from foods the user already eats ("usualFoods"), but vary them.
- name: short and appetising (max 60 characters). tags: 1–3 short labels such as "high protein", "5 min", "vegetarian".
- calories, protein, carbs and fat are for the whole idea, in kcal and grams, from typical food composition data.

Food styles:
- tamil-nadu: Tamil Nadu home food. Breakfast/dinner tiffin such as idli, dosa (plain, ragi, wheat, adai), ven pongal, upma, idiyappam, paniyaram, with sambar or chutney. Lunch "meals": rice or millet rice (varagu, samai, thinai, kuthiraivali) with sambar, rasam, kuzhambu (vatha, mor, meen), kootu, poriyal, keerai and curd; chettinad or Madurai-style chicken, mutton, egg or fish curries. Snacks such as sundal, neer mor, roasted peanuts, sprouts, fruit, ragi koozh. Use Tamil dish names.
- south-indian: home food from Tamil Nadu, Kerala, Karnataka and Andhra Pradesh.
- north-indian: home food such as roti, dal, sabzi, rajma, chole, paneer, poha, paratha.
- any: no preference; vary cuisines.

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
