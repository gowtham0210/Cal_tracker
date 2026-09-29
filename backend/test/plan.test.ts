import assert from "node:assert/strict";
import { describe, test } from "node:test";

const { api, DAY, foodId, newUser, onboardedUser, WEEK } = await import("./helpers.js");

// Curated: "2 idli with sambar & tomato chutney" = 270 kcal, 9 P, 48 C, 4 F per serving.
const IDLI = /^2 idli with sambar/;

describe("meal plans", () => {
  test("an unplanned week is an empty plan with seven empty days", async () => {
    const { token } = await onboardedUser();
    const r = await api("GET", `/meal-plans/${WEEK}`, { token });
    assert.equal(r.status, 200);
    assert.equal(r.body.items.length, 0);
    assert.deepEqual(r.body.days.map((d: { date: string }) => d.date), [0, 1, 2, 3, 4, 5, 6].map(DAY));
    assert.ok(r.body.days.every((d: { status: { state: string } }) => d.status.state === "empty"));
    assert.equal(r.body.calorieGoal, 1900);
    assert.equal(r.body.toleranceKcal, 100);
    assert.deepEqual(r.body.week, { calories: 0, protein: 0, carbs: 0, fat: 0, plannedDays: 0, daysOnTarget: 0, averageCalories: 0 });
  });

  test("the week must start on a Monday, and a profile is needed", async () => {
    const { token } = await onboardedUser();
    const bad = await api("GET", "/meal-plans/2026-10-06", { token });
    assert.equal(bad.status, 400);
    const fresh = await newUser();
    assert.equal((await api("GET", `/meal-plans/${WEEK}`, { token: fresh.token })).status, 404);
  });

  test("adding foods computes every number from the library times the quantity", async () => {
    const { token } = await onboardedUser();
    const idli = await foodId(token, IDLI);
    const r = await api("POST", `/meal-plans/${WEEK}/items`, { token, body: { date: DAY(0), meal: "breakfast", foodId: idli, quantity: 1.5 } });
    assert.equal(r.status, 201);
    const item = r.body.items[0];
    assert.deepEqual({ q: item.quantity, kcal: item.calories, p: item.protein, c: item.carbs, f: item.fat }, { q: 1.5, kcal: 405, p: 13.5, c: 72, f: 6 });
    assert.equal(item.food.name.startsWith("2 idli"), true);
    const monday = r.body.days[0];
    assert.equal(monday.calories, 405);
    assert.equal(monday.meals.breakfast.calories, 405);
    assert.equal(monday.meals.lunch.calories, 0);
    assert.deepEqual(monday.status, { state: "under", difference: -1495 });
    assert.equal(r.body.week.plannedDays, 1);
    assert.equal(r.body.week.averageCalories, 405);
    assert.equal(r.body.source, "manual");
  });

  test("goal status: within ±100 kcal (or 5%) is on target, beyond is under or over", async () => {
    const { token } = await onboardedUser();
    await api("PATCH", "/me/profile", { token, body: { calorieGoal: 1080 } }); // 5% = 54, so the ±100 floor applies
    const idli = await foodId(token, IDLI);
    const add = (i: number, quantity: number) => api("POST", `/meal-plans/${WEEK}/items`, { token, body: { date: DAY(i), meal: "lunch", foodId: idli, quantity } });
    await add(0, 4); // 1080 = goal
    await add(1, 3.75); // 1012.5: -67.5, on target
    await add(2, 3.5); // 945: -135, under
    const r = await add(3, 4.5); // 1215: +135, over
    const states = r.body.days.slice(0, 4).map((d: { status: { state: string; difference: number } }) => [d.status.state, d.status.difference]);
    assert.deepEqual(states, [["on-target", 0], ["on-target", -67.5], ["under", -135], ["over", 135]]);
    assert.equal(r.body.week.daysOnTarget, 2);

    // With a larger goal, 5% is wider than 100 kcal.
    await api("PATCH", "/me/profile", { token, body: { calorieGoal: 3000 } });
    assert.equal((await api("GET", `/meal-plans/${WEEK}`, { token })).body.toleranceKcal, 150);
  });

  test("changes portions, moves and removes items, keeping order within a meal", async () => {
    const { token } = await onboardedUser();
    const idli = await foodId(token, IDLI);
    const pongal = await foodId(token, /^Ven pongal/);
    let r = await api("POST", `/meal-plans/${WEEK}/items`, { token, body: { date: DAY(0), meal: "breakfast", foodId: idli } });
    r = await api("POST", `/meal-plans/${WEEK}/items`, { token, body: { date: DAY(0), meal: "breakfast", foodId: pongal } });
    const [first, second] = r.body.items;
    assert.deepEqual([first.position, second.position], [0, 1]);

    r = await api("PATCH", `/meal-plans/${WEEK}/items/${first.id}`, { token, body: { quantity: 2 } });
    assert.equal(r.body.items.find((i: { id: string }) => i.id === first.id).calories, 540);

    r = await api("PATCH", `/meal-plans/${WEEK}/items/${second.id}`, { token, body: { date: DAY(2), meal: "dinner" } });
    const moved = r.body.items.find((i: { id: string }) => i.id === second.id);
    assert.deepEqual([moved.date, moved.meal, moved.position], [DAY(2), "dinner", 0]);

    r = await api("DELETE", `/meal-plans/${WEEK}/items/${first.id}`, { token });
    assert.deepEqual(r.body.items.map((i: { id: string }) => i.id), [second.id]);
    assert.equal(r.body.days[0].calories, 0);
  });

  test("validates dates, quantities and foods", async () => {
    const a = await onboardedUser();
    const b = await onboardedUser();
    const idli = await foodId(a.token, IDLI);
    const post = (body: object) => api("POST", `/meal-plans/${WEEK}/items`, { token: a.token, body });
    const pointers = async (body: object) => (await post(body)).body.errors.map((e: { pointer: string }) => e.pointer);
    assert.deepEqual(await pointers({ date: "2026-10-12", meal: "lunch", foodId: idli }), ["/date"], "outside the week");
    assert.deepEqual(await pointers({ date: DAY(0), meal: "lunch", foodId: idli, quantity: 0.3 }), ["/quantity"]);
    assert.deepEqual(await pointers({ date: DAY(0), meal: "lunch", foodId: idli, quantity: 11 }), ["/quantity"]);
    const foreign = await foodId(b.token, IDLI);
    assert.deepEqual(await pointers({ date: DAY(0), meal: "lunch", foodId: foreign }), ["/foodId"], "another user's food");

    const added = (await post({ date: DAY(0), meal: "lunch", foodId: idli })).body.items[0];
    assert.equal((await api("PATCH", `/meal-plans/${WEEK}/items/${added.id}`, { token: b.token, body: { quantity: 2 } })).status, 404);
    assert.equal((await api("DELETE", `/meal-plans/2026-10-12/items/${added.id}`, { token: a.token })).status, 404, "item belongs to another week");
  });
});
