import assert from "node:assert/strict";
import { describe, test } from "node:test";

const { api, DAY, foodId, onboardedUser, WEEK } = await import("./helpers.js");

type Item = { id: string; date: string; meal: string; quantity: number; position: number; food: { id: string; name: string } };
const summary = (items: Item[], date: string) => items.filter((i) => i.date === date).map((i) => `${i.meal}:${i.food.name.split(" ").slice(0, 2).join(" ")}×${i.quantity}`);

async function setup() {
  const { token } = await onboardedUser();
  const idli = await foodId(token, /^2 idli with sambar/);
  const rice = await foodId(token, /^Curd rice/);
  const sundal = await foodId(token, /^Channa sundal/);
  const put = (i: number, items: object[]) => api("PUT", `/meal-plans/${WEEK}/days/${DAY(i)}`, { token, body: { items } });
  return { token, idli, rice, sundal, put };
}

describe("copy, move and set days", () => {
  test("PUT day sets a day's foods in order, and an empty list clears it", async () => {
    const { token, idli, rice, put } = await setup();
    let r = await put(0, [
      { meal: "breakfast", foodId: idli, quantity: 1 },
      { meal: "lunch", foodId: rice, quantity: 1.5 },
      { meal: "breakfast", foodId: rice, quantity: 0.5 },
    ]);
    assert.equal(r.status, 200);
    assert.deepEqual(summary(r.body.items, DAY(0)), ["breakfast:2 idli×1", "breakfast:Curd rice×0.5", "lunch:Curd rice×1.5"]);
    r = await put(0, []);
    assert.deepEqual(summary(r.body.items, DAY(0)), []);
    assert.equal(r.body.days[0].status.state, "empty");
    assert.equal((await api("PUT", `/meal-plans/${WEEK}/days/2026-10-12`, { token, body: { items: [] } })).status, 400, "day outside the week");
  });

  test("copying a day with add appends; with replace swaps the target's foods", async () => {
    const { token, idli, rice, sundal, put } = await setup();
    await put(0, [{ meal: "breakfast", foodId: idli, quantity: 2 }, { meal: "snack", foodId: sundal, quantity: 1 }]);
    await put(1, [{ meal: "lunch", foodId: rice, quantity: 1 }]);
    await put(2, [{ meal: "lunch", foodId: rice, quantity: 1 }]);

    const r = await api("POST", `/meal-plans/${WEEK}/days/${DAY(0)}/copy`, { token, body: { to: [DAY(1)], mode: "add" } });
    assert.deepEqual(summary(r.body.items, DAY(1)), ["breakfast:2 idli×2", "lunch:Curd rice×1", "snack:Channa sundal×1"]);

    const r2 = await api("POST", `/meal-plans/${WEEK}/days/${DAY(0)}/copy`, { token, body: { to: [DAY(2), DAY(3)], mode: "replace" } });
    assert.deepEqual(summary(r2.body.items, DAY(2)), ["breakfast:2 idli×2", "snack:Channa sundal×1"]);
    assert.deepEqual(summary(r2.body.items, DAY(3)), ["breakfast:2 idli×2", "snack:Channa sundal×1"]);
    assert.deepEqual(summary(r2.body.items, DAY(0)), ["breakfast:2 idli×2", "snack:Channa sundal×1"], "the source day is unchanged");

    const bad = await api("POST", `/meal-plans/${WEEK}/days/${DAY(0)}/copy`, { token, body: { to: [DAY(0)], mode: "add" } });
    assert.equal(bad.status, 400, "can't copy a day onto itself");
  });

  test("copies a single food to another meal, keeping the original", async () => {
    const { token, idli, put } = await setup();
    const item: Item = (await put(0, [{ meal: "breakfast", foodId: idli, quantity: 1.5 }])).body.items[0];
    const r = await api("POST", `/meal-plans/${WEEK}/items/${item.id}/copy`, { token, body: { date: DAY(4), meal: "dinner" } });
    assert.equal(r.status, 201);
    assert.deepEqual(summary(r.body.items, DAY(0)), ["breakfast:2 idli×1.5"]);
    assert.deepEqual(summary(r.body.items, DAY(4)), ["dinner:2 idli×1.5"]);
  });

  test("moving to a position reorders the target meal", async () => {
    const { token, idli, rice, sundal, put } = await setup();
    const items: Item[] = (await put(0, [{ meal: "lunch", foodId: idli, quantity: 1 }, { meal: "lunch", foodId: rice, quantity: 1 }, { meal: "snack", foodId: sundal, quantity: 1 }])).body.items;
    const snack = items.find((i) => i.meal === "snack")!;
    const r = await api("PATCH", `/meal-plans/${WEEK}/items/${snack.id}`, { token, body: { meal: "lunch", position: 1 } });
    assert.deepEqual(summary(r.body.items, DAY(0)), ["lunch:2 idli×1", "lunch:Channa sundal×1", "lunch:Curd rice×1"]);
  });
});
