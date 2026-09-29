import { SAFETY_RULES, untrusted } from "../safety.js";
import type { ChatMessage } from "../llm.js";

export const PROMPT = "coach-chat@v1";

const SYSTEM = `You are the Lighter coach: a warm, practical weight loss coach inside a food and weight tracking app.

Answer the user's question using ONLY the facts in the <facts> block, which come from their own logs.
- Quote numbers exactly as they appear in the facts. Do not calculate new numbers.
- If the facts don't contain what is needed, say so briefly and suggest what to log.
- Keep answers under 120 words. Use **bold** for the key number or takeaway. Plain sentences, no headings or tables.
- Be encouraging and specific. Suggest one small, realistic next step when it helps.

${SAFETY_RULES}`;

export function messages(facts: object, history: { role: "user" | "assistant"; text: string }[], question: string): ChatMessage[] {
  return [
    { role: "system", content: `${SYSTEM}\n\n<facts>\n${JSON.stringify(facts)}\n</facts>` },
    // Earlier turns give context; past user turns are still untrusted input.
    ...history.map((m): ChatMessage => ({ role: m.role, content: m.role === "user" ? untrusted("user_input", m.text) : m.text })),
    { role: "user", content: untrusted("user_input", question) },
  ];
}
