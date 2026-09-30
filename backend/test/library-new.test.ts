import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

const { api, onboardedUser } = await import("./helpers.js");
const { setLlm, DisabledLlm } = await import("../src/ai/llm.js");
const { FakeLlm, text } = await import("./fake-llm.js");
type ChatMessage = import("../src/ai/llm.js").ChatMessage;

type Suggestion = { name: string; meal: string; basedOn: string | null; reason: string; calories: number; confidence: string; diet: string; allergens: string[] };
type Food = { id: string; name: string; source: string; calories: number; confidence: string | null; allergens: string[]; diet: string };
const factsOf = (m: ChatMessage[]) => JSON.parse(text(m[1]).replace(/^<facts>\n/, "").replace(/\n<\/facts>$/, ""));
const idea = (name: string, extra: object = {}) => ({
  name,
  meal: "breakfast",
  serving: "1 plate",
  calories: 280,
  protein: 8,
  carbs: 45,
  fat: 7,
  confidence: "medium",
  cuisine: "tamil-nadu",
  diet: "veg",
  allergens: [],
  basedOn: "2 idli with sambar & tomato chutney",
  reason: "Another steamed breakfast",
  ...extra,
});

let fake: InstanceType<typeof FakeLlm>;
beforeEach(() => {
  fake = new FakeLlm();
  setLlm(fake);
});

describe("Try new: suggestions", () => {
  test("are close to what the user eats, and respect diet, allergies, budget and food style", async () => {
    const { token } = await onboardedUser();
    await api("PATCH", "/me/profile", { token, body: { dietType: "veg", allergies: ["peanut"], budget: "low" } });
    await api("POST", "/food-entries", { token, body: { date: "2026-09-29", meal: "breakfast", name: "Poha", calories: 250, protein: 5, carbs: 45, fat: 6 } });
    fake.json_["new-foods@v1"] = () => ({
      suggestions: [
        idea("Rava upma", { basedOn: "Poha", reason: "You eat poha, so try upma" }),
        idea("Peanut chikki", { meal: "snack" }),
        idea("Chicken 65", { diet: "veg" }),
        idea("Egg bhurji", { diet: "eggetarian" }),
        idea("Curd rice (1 cup)"),
        idea("Mystery bowl", { calories: 900, protein: 5, carbs: 10, fat: 5, confidence: "high" }),
      ],
    });
    const r = await api("POST", "/food-library/suggestions", { token, body: {} });
    assert.equal(r.status, 200);
    const s: Suggestion[] = r.body.data;
    assert.deepEqual(s.map((x) => x.name), ["Rava upma", "Mystery bowl"], "allergens, other diets and foods already in the library are dropped");
    assert.equal(s[0].basedOn, "Poha");
    assert.equal(s[0].reason, "You eat poha, so try upma");
    assert.deepEqual(s[0].allergens, ["gluten"], "allergens are detected from the name too");
    assert.equal(s[1].confidence, "low", "900 kcal from about 105 kcal of macros");

    const f = factsOf(fake.last("new-foods")!.messages);
    assert.deepEqual([f.dietType, f.allergies, f.budget, f.cuisine], ["veg", ["peanut"], "low", "tamil-nadu"]);
    assert.ok(f.usualFoods.includes("Poha"));
    assert.ok(f.avoid.includes("Curd rice (1 cup)"), "foods already in the library are listed to avoid");

    const saved: Food[] = (await api("GET", "/food-library?tab=new", { token })).body.data;
    assert.deepEqual(saved, [], "nothing is saved until the user accepts one");
  });

  test("can be asked for one meal", async () => {
    const { token } = await onboardedUser();
    fake.json_["new-foods@v1"] = () => ({ suggestions: [idea("Ragi idiyappam"), idea("Sundal chaat", { meal: "snack" })] });
    const r = await api("POST", "/food-library/suggestions", { token, body: { meal: "breakfast" } });
    assert.deepEqual(r.body.data.map((x: Suggestion) => x.name), ["Ragi idiyappam"]);
    assert.equal(factsOf(fake.last("new-foods")!.messages).meal, "breakfast");
  });

  test("fail cleanly when the AI is unavailable", async () => {
    setLlm(new DisabledLlm());
    const { token } = await onboardedUser();
    const r = await api("POST", "/food-library/suggestions", { token, body: {} });
    assert.equal(r.status, 503);
    assert.equal(r.body.type, "https://lighter.app/problems/ai-unavailable");
  });
});

describe("Try new: accepting a food", () => {
  test("saves the reviewed food to the library, where its numbers stay fixed", async () => {
    const { token } = await onboardedUser();
    const body = { name: "Rava upma", meal: "breakfast", serving: "1 cup", calories: 260, protein: 7, carbs: 40, fat: 8, confidence: "medium", cuisine: "tamil-nadu" };
    const r = await api("POST", "/food-library", { token, body });
    assert.equal(r.status, 201);
    const food: Food = r.body;
    assert.deepEqual([food.name, food.source, food.calories, food.confidence, food.diet], ["Rava upma", "ai", 260, "medium", "veg"]);
    assert.deepEqual(food.allergens, ["gluten"]);

    await api("POST", "/food-entries", { token, body: { date: "2026-09-29", meal: "breakfast", name: "Rava upma", calories: 400, protein: 7, carbs: 40, fat: 8 } });
    const listed: Food[] = (await api("GET", "/food-library?tab=new", { token })).body.data;
    assert.deepEqual(listed.map((f) => [f.name, f.calories]), [["Rava upma", 260]], "logging it doesn't change the library's numbers");
  });

  test("won't save a name that's already in the library, and validates the rest", async () => {
    const { token } = await onboardedUser();
    const dup = await api("POST", "/food-library", { token, body: { name: "curd rice (1 cup)", meal: "lunch", serving: "1 cup", calories: 280, protein: 8, carbs: 45, fat: 7 } });
    assert.equal(dup.status, 409);
    const bad = await api("POST", "/food-library", { token, body: { name: " ", meal: "brunch", serving: "", calories: -1, protein: 1, carbs: 1, fat: 1 } });
    assert.equal(bad.status, 400);
    assert.deepEqual(bad.body.errors.map((e: { pointer: string }) => e.pointer).sort(), ["/calories", "/meal", "/name", "/serving"]);
  });
});
