import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

const { api, DAY, download, foodId, onboardedUser, pdfPages, WEEK } = await import("./helpers.js");
const { setLlm, DisabledLlm } = await import("../src/ai/llm.js");
const { FakeLlm, text } = await import("./fake-llm.js");
type ChatMessage = import("../src/ai/llm.js").ChatMessage;

const factsOf = (m: ChatMessage[]) => JSON.parse(text(m[1]).replace(/^<facts>\n/, "").replace(/\n<\/facts>$/, ""));

let fake: InstanceType<typeof FakeLlm>;
beforeEach(() => {
  fake = new FakeLlm();
  setLlm(new DisabledLlm());
});

async function planned() {
  const { token } = await onboardedUser();
  const idli = await foodId(token, /^2 idli with sambar/);
  const rice = await foodId(token, /^Curd rice/);
  const chettinad = await foodId(token, /^Chicken chettinad/);
  const put = (i: number, items: object[]) => api("PUT", `/meal-plans/${WEEK}/days/${DAY(i)}`, { token, body: { items } });
  await put(0, [{ meal: "breakfast", foodId: idli, quantity: 1.5 }, { meal: "lunch", foodId: rice, quantity: 1 }]);
  await put(1, [{ meal: "lunch", foodId: chettinad, quantity: 1 }]);
  await put(2, [{ meal: "breakfast", foodId: idli, quantity: 1 }]);
  return token;
}
const grocery = async (token: string, qs = "scope=week&includeGrocery=true") => {
  const r = await download(`/meal-plans/${WEEK}/export?${qs}`, token);
  assert.equal(r.status, 200);
  return pdfPages(r.bytes);
};

describe("grocery list", () => {
  test("adds up each food's ingredients across the week, by category, marked approx.", async () => {
    const token = await planned();
    const pages = await grocery(token);
    assert.equal(pages.length, 2, "the plan, then the grocery list");
    const list = pages[1].text;
    assert.ok(!pages[1].landscape, "the list is a portrait page");
    for (const want of ["Grocery list", "Approximate amounts", "Vegetables & fruit", "Grains & millets", "Dals & legumes", "Dairy & eggs", "Meat & fish", "Oils, spices & others"]) {
      assert.ok(list.includes(want), `missing "${want}" in: ${list.slice(0, 300)}`);
    }
    assert.match(list, /Idli rice approx\. 150 g/, "60 g × 2½ servings");
    assert.match(list, /Rice approx\. 130 g/, "curd rice and chettinad together");
    assert.match(list, /Tomato approx\. 150 g/);
    assert.match(list, /Oil approx\. 25 ml/, "24.5 ml, rounded");
    assert.match(list, /Chicken approx\. 150 g/);
    assert.ok(list.indexOf("Vegetables & fruit") < list.indexOf("Grains & millets"));
  });

  test("covers just the day for a day export, and is left out unless asked", async () => {
    const token = await planned();
    const day = await grocery(token, `scope=day&date=${DAY(0)}&includeGrocery=true`);
    assert.match(day[1].text, /Idli rice approx\. 90 g/);
    assert.ok(!/Chicken/.test(day[1].text));
    assert.equal((await grocery(token, "scope=week")).length, 1);
  });

  test("without the AI, foods with unknown ingredients are listed by name", async () => {
    const { token } = await onboardedUser();
    await api("POST", "/food-entries", { token, body: { date: "2026-09-29", meal: "breakfast", name: "Masala dosa", calories: 350, protein: 8, carbs: 50, fat: 12 } });
    const dosa = await foodId(token, /^Masala dosa$/);
    await api("PUT", `/meal-plans/${WEEK}/days/${DAY(0)}`, { token, body: { items: [{ meal: "breakfast", foodId: dosa, quantity: 2 }] } });
    const list = (await grocery(token))[1].text;
    assert.match(list, /Dishes to make or buy/);
    assert.match(list, /Masala dosa × 2 servings/);
  });

  test("with the AI, ingredients are estimated once per food and then reused", async () => {
    setLlm(fake);
    const { token } = await onboardedUser();
    await api("POST", "/food-entries", { token, body: { date: "2026-09-29", meal: "breakfast", name: "Masala dosa", calories: 350, protein: 8, carbs: 50, fat: 12 } });
    const dosa = await foodId(token, /^Masala dosa$/);
    const idli = await foodId(token, /^2 idli with sambar/);
    await api("PUT", `/meal-plans/${WEEK}/days/${DAY(0)}`, { token, body: { items: [{ meal: "breakfast", foodId: dosa, quantity: 2 }, { meal: "lunch", foodId: idli, quantity: 1 }] } });
    fake.json_["ingredients@v1"] = (m) => {
      const foods: { id: string; name: string }[] = factsOf(m).foods;
      return {
        foods: [
          ...foods.map((f) => ({ id: f.id, ingredients: [{ name: "Dosa batter", amount: 120, unit: "g", category: "Grains & millets" }, { name: "Potato", amount: 80, unit: "g", category: "Vegetables & fruit" }] })),
          { id: "not-a-food", ingredients: [{ name: "Gold", amount: 1, unit: "pc", category: "Oils, spices & others" }] },
        ],
      };
    };
    const list = (await grocery(token))[1].text;
    assert.match(list, /Dosa batter approx\. 240 g/);
    assert.match(list, /Potato approx\. 160 g/);
    assert.ok(!/Gold/.test(list));
    assert.deepEqual(factsOf(fake.last("ingredients")!.messages).foods.map((f: { name: string }) => f.name), ["Masala dosa"], "curated dishes already have ingredients");

    await grocery(token);
    assert.equal(fake.calls.filter((c) => c.prompt.startsWith("ingredients")).length, 1, "not estimated again");
  });
});

describe("estimating ingredients", () => {
  async function withDosa(day = 0) {
    const { token } = await onboardedUser();
    for (const name of ["Masala dosa", "Pav bhaji"]) await api("POST", "/food-entries", { token, body: { date: "2026-09-29", meal: "dinner", name, calories: 350, protein: 8, carbs: 50, fat: 12 } });
    const dosa = await foodId(token, /^Masala dosa$/);
    const pav = await foodId(token, /^Pav bhaji$/);
    await api("PUT", `/meal-plans/${WEEK}/days/${DAY(day)}`, { token, body: { items: [{ meal: "dinner", foodId: dosa, quantity: 1 }] } });
    await api("PUT", `/meal-plans/${WEEK}/days/${DAY(day + 1)}`, { token, body: { items: [{ meal: "dinner", foodId: pav, quantity: 1 }] } });
    return token;
  }

  test("a day export only estimates that day's foods", async () => {
    setLlm(fake);
    fake.json_["ingredients@v1"] = (m) => ({ foods: factsOf(m).foods.map((f: { id: string }) => ({ id: f.id, ingredients: [{ name: "Batter", amount: 100, unit: "g", category: "Grains & millets" }] })) });
    const token = await withDosa();
    await grocery(token, `scope=day&date=${DAY(0)}&includeGrocery=true`);
    assert.deepEqual(factsOf(fake.last("ingredients")!.messages).foods.map((f: { name: string }) => f.name), ["Masala dosa"]);
  });

  test("after a failed estimate, exports don't keep retrying for a while", async () => {
    setLlm(fake);
    const { AiUnavailable } = await import("../src/ai/llm.js");
    fake.json_["ingredients@v1"] = new AiUnavailable("down");
    const token = await withDosa();
    const first = (await grocery(token))[1].text;
    await grocery(token);
    assert.equal(fake.calls.filter((c) => c.prompt.startsWith("ingredients")).length, 1);
    assert.match(first, /Masala dosa × 1 serving/);
  });
});
