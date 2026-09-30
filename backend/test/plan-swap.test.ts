import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, test } from "node:test";

const { api, DAY, foodId, onboardedUser, WEEK } = await import("./helpers.js");
const { setLlm, DisabledLlm } = await import("../src/ai/llm.js");
const { FakeLlm, text } = await import("./fake-llm.js");
type ChatMessage = import("../src/ai/llm.js").ChatMessage;

type Swap = { food: { id: string; name: string; meal: string; diet: string; allergyConflicts: string[] }; quantity: number; calories: number; calorieDifference: number; proteinDifference: number; reason: string };
type Facts = { original: { name: string; calories: number }; options: { id: string; name: string }[] };
const factsOf = (m: ChatMessage[]): Facts => JSON.parse(text(m[1]).replace(/^<facts>\n/, "").replace(/\n<\/facts>$/, ""));

let fake: InstanceType<typeof FakeLlm>;
beforeEach(() => {
  fake = new FakeLlm();
  setLlm(new DisabledLlm());
});

/** A user with one planned food, returning its item id. */
async function planned(name: RegExp, meal = "breakfast", quantity = 1, prefs: object = {}) {
  const { token } = await onboardedUser();
  if (Object.keys(prefs).length) await api("PATCH", "/me/profile", { token, body: prefs });
  const id = await foodId(token, name);
  const plan = (await api("PUT", `/meal-plans/${WEEK}/days/${DAY(0)}`, { token, body: { items: [{ meal, foodId: id, quantity }] } })).body;
  return { token, itemId: plan.items[0].id as string, foodId: id, calories: plan.items[0].calories as number };
}
const swaps = (token: string, itemId: string) => api("GET", `/meal-plans/${WEEK}/items/${itemId}/swaps`, { token });

describe("swap alternatives", () => {
  test("without the AI: 3 to 5 similar foods, with portions matching calories to within 10%", async () => {
    const { token, itemId, foodId: original, calories } = await planned(/^2 idli with sambar/, "breakfast", 1.5);
    const r = await swaps(token, itemId);
    assert.equal(r.status, 200);
    assert.equal(r.body.source, "rules");
    const list: Swap[] = r.body.data;
    assert.ok(list.length >= 3 && list.length <= 5, `${list.length} alternatives`);
    for (const s of list) {
      assert.notEqual(s.food.id, original);
      assert.ok(Math.abs(s.calories - calories) <= calories * 0.1, `${s.food.name}: ${s.calories} vs ${calories}`);
      assert.equal(s.calorieDifference, Math.round(s.calories - calories));
      assert.ok(Number.isInteger(s.quantity * 4));
      assert.ok(s.reason.length > 0);
    }
    assert.equal(list[0].food.meal, "breakfast", "the same meal ranks first");
  });

  test("respect allergies and diet type", async () => {
    const { token, itemId } = await planned(/^Chicken chettinad/, "lunch", 1, {});
    await api("PATCH", "/me/profile", { token, body: { dietType: "veg", allergies: ["dairy"] } });
    const list: Swap[] = (await swaps(token, itemId)).body.data;
    assert.ok(list.length >= 3);
    assert.ok(list.every((s) => s.food.diet === "veg" && s.food.allergyConflicts.length === 0));
  });

  test("with the AI: it picks and explains the most similar, and the server keeps only valid picks", async () => {
    setLlm(fake);
    const { token, itemId, calories } = await planned(/^2 idli with sambar/);
    fake.json_["swap@v1"] = (m) => {
      const f = factsOf(m);
      return {
        picks: [
          { id: f.options[2].id, reason: "Also steamed and light" },
          { id: randomUUID(), reason: "Made up" },
          { id: f.options[0].id, reason: "Same sambar, different grain" },
          { id: f.options[1].id, reason: "A quick swap" },
        ],
      };
    };
    const r = await swaps(token, itemId);
    const list: Swap[] = r.body.data;
    assert.equal(r.body.source, "ai");
    const f = factsOf(fake.last("swap")!.messages);
    assert.equal(f.original.calories, calories);
    assert.deepEqual(list.slice(0, 3).map((s) => [s.food.id, s.reason]), [
      [f.options[2].id, "Also steamed and light"],
      [f.options[0].id, "Same sambar, different grain"],
      [f.options[1].id, "A quick swap"],
    ]);
    assert.ok(list.every((s) => Math.abs(s.calories - calories) <= calories * 0.1));
  });

  test("fall back to the ranking when the AI fails", async () => {
    setLlm(fake);
    const { AiUnavailable } = await import("../src/ai/llm.js");
    fake.json_["swap@v1"] = new AiUnavailable("down");
    const { token, itemId } = await planned(/^2 idli with sambar/);
    const r = await swaps(token, itemId);
    assert.equal(r.status, 200);
    assert.equal(r.body.source, "rules");
    assert.ok(r.body.data.length >= 3);
  });

  test("applying a swap replaces the food and portion", async () => {
    const { token, itemId } = await planned(/^2 idli with sambar/);
    const s: Swap = (await swaps(token, itemId)).body.data[0];
    const r = await api("PATCH", `/meal-plans/${WEEK}/items/${itemId}`, { token, body: { foodId: s.food.id, quantity: s.quantity } });
    assert.equal(r.body.items[0].food.id, s.food.id);
    assert.equal(r.body.items[0].calories, s.calories);
  });

  test("404 for an item that isn't in the plan", async () => {
    const { token } = await planned(/^2 idli with sambar/);
    assert.equal((await swaps(token, randomUUID())).status, 404);
  });
});
