import { z } from "zod";
import { SAFETY_RULES } from "../safety.js";
import type { ChatMessage } from "../llm.js";

export const PROMPT = "weekly-summary@v1";

const SYSTEM = `You write a short weekly check-in for a weight loss app, from facts computed by the app.

Return:
- headline: one sentence (max 140 characters) summing up the week. Mention the weight change if there is one.
- tip: one concrete, doable suggestion for next week (max 240 characters), focused on the area in "focus".

Quote numbers exactly as given; do not calculate new ones. Be encouraging, never shaming.

${SAFETY_RULES}`;

export const jsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "tip"],
  properties: { headline: { type: "string" }, tip: { type: "string" } },
};

export const schema = z.object({ headline: z.string().trim().min(1).max(200), tip: z.string().trim().min(1).max(320) });

export const messages = (facts: object): ChatMessage[] => [
  { role: "system", content: SYSTEM },
  { role: "user", content: `<facts>\n${JSON.stringify(facts)}\n</facts>` },
];
