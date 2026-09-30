import assert from "node:assert/strict";
import { describe, test } from "node:test";

const { api, DAY, foodId, onboardedUser, WEEK } = await import("./helpers.js");

type Entry = { id: string; date: string; meal: string; name: string; calories: number; protein: number; carbs: number; fat: number; source: string };
type Item = { id: string; meal: string; logged: boolean; calories: number; protein: number; carbs: number; fat: number; food: { name: string } };
const logMeal = (token: string, meal: string, date = DAY(0)) => api("POST", `/meal-plans/${WEEK}/days/${date}/meals/${meal}/log`, { token });
const entries = async (token: string): Promise<Entry[]> => (await api("GET", `/food-entries?from=${DAY(0)}&to=${DAY(6)}`, { token })).body.data;

async function planned() {
  const { token } = await onboardedUser();
  const idli = await foodId(token, /^2 idli with sambar/);
  const sundal = await foodId(token, /^Channa sundal/);
  const rice = await foodId(token, /^Curd rice/);
  await api("PUT", `/meal-plans/${WEEK}/days/${DAY(0)}`, {
    token,
    body: { items: [{ meal: "breakfast", foodId: idli, quantity: 1.5 }, { meal: "breakfast", foodId: sundal, quantity: 0.5 }, { meal: "lunch", foodId: rice, quantity: 1 }] },
  });
  return token;
}

describe("logging a planned meal", () => {
  test("logs each food with the plan's exact numbers, marked as from the plan", async () => {
    const token = await planned();
    const r = await logMeal(token, "breakfast");
    assert.equal(r.status, 201);
    const plan = r.body.plan;
    const breakfast: Item[] = plan.items.filter((i: Item) => i.meal === "breakfast");
    const logged: Entry[] = r.body.entries;
    assert.deepEqual(
      logged.map(({ name, meal, date, calories, protein, carbs, fat, source }) => ({ name, meal, date, calories, protein, carbs, fat, source })),
      breakfast.map((i) => ({ name: i.food.name, meal: "breakfast", date: DAY(0), calories: i.calories, protein: i.protein, carbs: i.carbs, fat: i.fat, source: "plan" })),
    );
    assert.ok(breakfast.every((i) => i.logged));
    assert.ok(plan.items.filter((i: Item) => i.meal === "lunch").every((i: Item) => !i.logged));
    assert.deepEqual((await entries(token)).map((e) => e.source), ["plan", "plan"]);
  });

  test("won't log the same meal twice, and needs something planned", async () => {
    const token = await planned();
    await logMeal(token, "breakfast");
    assert.equal((await logMeal(token, "breakfast")).status, 409);
    assert.equal((await logMeal(token, "dinner")).status, 404);
    assert.equal((await logMeal(token, "brunch")).status, 400);
  });

  test("deleting a logged entry lets that food be logged again; deleting the planned food keeps the entry", async () => {
    const token = await planned();
    const { entries: logged } = (await logMeal(token, "breakfast")).body;
    await api("DELETE", `/food-entries/${logged[0].id}`, { token });
    const again = await logMeal(token, "breakfast");
    assert.equal(again.status, 201);
    assert.equal(again.body.entries.length, 1, "only the food that isn't logged any more");

    const lunch = (await logMeal(token, "lunch")).body.plan.items.find((i: Item) => i.meal === "lunch");
    await api("DELETE", `/meal-plans/${WEEK}/items/${lunch.id}`, { token });
    assert.equal((await entries(token)).filter((e) => e.meal === "lunch").length, 1);
  });

  test("stays logged when the day is rebuilt (replaced, regenerated or undone)", async () => {
    const token = await planned();
    await logMeal(token, "breakfast");
    const day = (await api("GET", `/meal-plans/${WEEK}`, { token })).body.items.filter((i: Item & { food: { id: string }; quantity: number }) => i.meal === "breakfast");
    // Undo and Replace put a day back through PUT, which recreates its items.
    const r = await api("PUT", `/meal-plans/${WEEK}/days/${DAY(0)}`, { token, body: { items: day.map((i: { food: { id: string }; quantity: number }) => ({ meal: "breakfast", foodId: i.food.id, quantity: i.quantity })) } });
    assert.ok(r.body.items.every((i: Item) => i.logged));
    assert.equal((await logMeal(token, "breakfast")).status, 409, "so it can't be logged twice");
  });

  test("keeps library foods' per-serving numbers when a bigger portion is logged from the plan", async () => {
    const { token } = await onboardedUser();
    await api("POST", "/food-entries", { token, body: { date: "2026-09-29", meal: "breakfast", name: "Masala dosa", calories: 350, protein: 8, carbs: 50, fat: 12 } });
    const dosa = await foodId(token, /^Masala dosa$/);
    await api("PUT", `/meal-plans/${WEEK}/days/${DAY(0)}`, { token, body: { items: [{ meal: "breakfast", foodId: dosa, quantity: 2 }] } });
    const logged: Entry[] = (await logMeal(token, "breakfast")).body.entries;
    assert.equal(logged[0].calories, 700);
    const lib = (await api("GET", "/food-library?q=Masala dosa", { token })).body.data.find((f: { name: string }) => f.name === "Masala dosa");
    assert.deepEqual([lib.calories, lib.useCount], [350, 2], "per serving stays 350; the plan log still counts as eating it");
  });

  test("food entries can't claim to come from a plan", async () => {
    const { token } = await onboardedUser();
    const r = await api("POST", "/food-entries", { token, body: { date: "2026-09-29", meal: "lunch", name: "Rice", calories: 200, source: "plan" } });
    assert.equal(r.status, 400);
  });
});
