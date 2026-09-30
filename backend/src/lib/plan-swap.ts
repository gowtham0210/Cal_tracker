import * as swapPrompt from "../ai/prompts/swap.js";
import { llm } from "../ai/llm.js";
import { db } from "../db/index.js";
import { HttpError } from "../http/problem.js";
import type { Profile } from "../routes/profile.js";
import { CUISINE_STYLES } from "./curated-foods.js";
import { syncLibrary, toLibraryFood, type LibraryRow } from "./library.js";
import { findItem } from "./plan.js";
import { isSafe, isYours, snap } from "./plan-generate.js";

// Swap alternatives: safe library foods portioned to the original's calories (within ±10%),
// ranked by similarity. When the AI is available it picks and explains the most similar from
// that shortlist; the server still chooses every portion and keeps only valid picks.

const r1 = (n: number) => Math.round(n * 10) / 10;
const libraryRows = db.prepare<[string], LibraryRow>("SELECT * FROM library_foods WHERE user_id = ?");

// How much each kind of similarity counts when ranking. Protein and calorie gaps count against.
const WEIGHT = { sameMeal: 3, sameCuisine: 1.5, userStyle: 1, yours: 1, easyPortion: 0.5, oddPortion: -1, perProteinGram: 0.1, calorieGap: 5 };

interface Option {
  food: LibraryRow;
  quantity: number;
  calories: number;
  protein: number;
  score: number;
}

/** Everything that could stand in for `original` at about `kcal`, most similar first. */
function rankOptions(rows: LibraryRow[], original: LibraryRow, kcal: number, p: Profile): Option[] {
  const styles = CUISINE_STYLES[p.cuisine];
  const protein = original.protein * (kcal / Math.max(original.calories, 1));
  return rows
    .filter((r) => r.id !== original.id && r.calories > 0 && isSafe(r, p))
    .map((r) => {
      const quantity = snap(kcal / r.calories);
      const calories = r.calories * quantity;
      const pr = r.protein * quantity;
      const score =
        (r.meal === original.meal ? WEIGHT.sameMeal : 0) +
        (r.cuisine && r.cuisine === original.cuisine ? WEIGHT.sameCuisine : styles.includes(r.cuisine as never) ? WEIGHT.userStyle : 0) +
        (isYours(r) ? WEIGHT.yours : 0) +
        (quantity >= 0.5 && quantity <= 2 ? WEIGHT.easyPortion : WEIGHT.oddPortion) -
        Math.abs(pr - protein) * WEIGHT.perProteinGram -
        (Math.abs(calories - kcal) / kcal) * WEIGHT.calorieGap;
      return { food: r, quantity, calories, protein: pr, score };
    })
    .filter((o) => Math.abs(o.calories - kcal) <= kcal * 0.1)
    .sort((a, b) => b.score - a.score);
}

/** A short reason from what the option has in common with the original. */
function ruleReason(o: Option, original: LibraryRow, originalProtein: number) {
  const parts: string[] = [];
  const dp = Math.round(o.protein - originalProtein);
  if (dp >= 3) parts.push(`${dp} g more protein`);
  else if (dp <= -3) parts.push(`${-dp} g less protein`);
  if (o.food.meal === original.meal) parts.push(`Also a ${o.food.meal}`);
  if (isYours(o.food)) parts.push("One of your usual foods");
  else if (o.food.cuisine && o.food.cuisine === original.cuisine) parts.push("Same food style");
  return (parts.length ? parts.slice(0, 2).join(" · ") : "Similar calories").slice(0, 60);
}

/** Alternatives for a planned food. `aiAllowed` is asked just before an AI call (it counts towards the user's AI limit). */
export async function swapOptions(userId: string, p: Profile, weekStart: string, itemId: string, aiAllowed: () => boolean = () => true) {
  const { item } = findItem(userId, weekStart, itemId);
  syncLibrary(userId);
  const rows = libraryRows.all(userId);
  const original = rows.find((r) => r.id === item.food_id);
  const kcal = original ? original.calories * item.quantity : 0;
  if (!original || kcal <= 0) return { source: "rules" as const, data: [] };
  const originalProtein = original.protein * item.quantity;
  const ranked = rankOptions(rows, original, kcal, p);
  const shortlist = ranked.slice(0, 15);

  let picks: { option: Option; reason: string }[] = [];
  let source: "ai" | "rules" = "rules";
  if (shortlist.length >= 3 && aiAllowed()) {
    try {
      const facts: swapPrompt.SwapFacts = {
        original: { name: original.name, meal: original.meal, calories: r1(kcal), protein: r1(originalProtein), cuisine: original.cuisine },
        cuisine: p.cuisine,
        options: shortlist.map((o) => ({ id: o.food.id, name: o.food.name, meal: o.food.meal, calories: r1(o.calories), protein: r1(o.protein), cuisine: o.food.cuisine, yours: isYours(o.food) })),
      };
      const out = await llm().json(
        { messages: swapPrompt.messages(facts), name: "swap", jsonSchema: swapPrompt.jsonSchema(shortlist.map((o) => o.food.id)), schema: swapPrompt.schema, maxTokens: 3000, timeoutMs: 30_000 },
        { prompt: swapPrompt.PROMPT, userId },
      );
      for (const pick of out.picks) {
        const option = shortlist.find((o) => o.food.id === pick.id);
        if (option && !picks.some((x) => x.option === option) && picks.length < 5) picks.push({ option, reason: pick.reason.slice(0, 60) });
      }
      if (picks.length) source = "ai";
    } catch (err) {
      // Unavailable, busy or filtered: the ranking alone is still useful.
      if (!(err instanceof HttpError)) throw err;
    }
  }
  // Top up (or fill) from the ranking so there are at least three when possible.
  for (const option of ranked) {
    if (picks.length >= (source === "ai" ? 3 : 5)) break;
    if (!picks.some((x) => x.option === option)) picks.push({ option, reason: ruleReason(option, original, originalProtein) });
  }

  const kcalShown = r1(kcal);
  return {
    source,
    data: picks.map(({ option: o, reason }) => ({
      food: toLibraryFood(o.food, p.allergies),
      quantity: o.quantity,
      calories: r1(o.calories),
      protein: r1(o.protein),
      calorieDifference: Math.round(r1(o.calories) - kcalShown),
      proteinDifference: r1(o.protein - originalProtein),
      reason,
    })),
  };
}
