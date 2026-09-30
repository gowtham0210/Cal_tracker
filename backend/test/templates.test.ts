import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, test } from "node:test";

const { api, db, DAY, foodId, onboardedUser, WEEK } = await import("./helpers.js");

const NEXT = "2026-10-12";
const NDAY = (i: number) => `2026-10-${String(12 + i).padStart(2, "0")}`;
type Item = { date: string; meal: string; quantity: number; food: { id: string; name: string } };
type Template = { id: string; name: string; averageCalories: number; dietTags: string[]; plannedDays: number; days: { offset: number; calories: number; meals: Record<string, string[]> }[] };
const summary = (items: Item[], date: string) => items.filter((i) => i.date === date).map((i) => `${i.meal}:${i.food.name.split(" ").slice(0, 2).join(" ")}×${i.quantity}`);

async function withWeek() {
  const { token } = await onboardedUser();
  const idli = await foodId(token, /^2 idli with sambar/);
  const rice = await foodId(token, /^Curd rice/);
  const egg = await foodId(token, /^Egg curry/);
  await api("PUT", `/meal-plans/${WEEK}/days/${DAY(0)}`, { token, body: { items: [{ meal: "breakfast", foodId: idli, quantity: 1 }, { meal: "lunch", foodId: rice, quantity: 1.5 }] } });
  await api("PUT", `/meal-plans/${WEEK}/days/${DAY(2)}`, { token, body: { items: [{ meal: "dinner", foodId: egg, quantity: 1 }] } });
  return { token, idli, rice, egg };
}
const save = (token: string, name: string, weekStart = WEEK) => api("POST", "/plan-templates", { token, body: { name, weekStart } });
const apply = (token: string, templateId: string, mode: string, week = NEXT) => api("POST", `/meal-plans/${week}/apply-template`, { token, body: { templateId, mode } });

describe("plan templates", () => {
  test("save a week as a template, with its average calories, diet tags and a preview", async () => {
    const { token } = await withWeek();
    const r = await save(token, "  Light week ");
    assert.equal(r.status, 201);
    const t: Template = r.body;
    assert.equal(t.name, "Light week");
    assert.equal(t.plannedDays, 2);
    assert.equal(t.averageCalories, Math.round((270 + 420 + (t.days[2].calories)) / 2));
    assert.deepEqual(t.dietTags, ["eggetarian", "veg"]);
    assert.deepEqual(t.days[0].meals.breakfast, ["2 idli with sambar & tomato chutney"]);
    assert.deepEqual(t.days[1].meals, { breakfast: [], lunch: [], snack: [], dinner: [] });
    const list: Template[] = (await api("GET", "/plan-templates", { token })).body.data;
    assert.deepEqual(list.map((x) => x.name), ["Light week"]);
  });

  test("apply with Replace swaps the whole week; Fill only adds to empty meals", async () => {
    const { token, idli, egg } = await withWeek();
    const t: Template = (await save(token, "Base")).body;
    await api("PUT", `/meal-plans/${NEXT}/days/${NDAY(0)}`, { token, body: { items: [{ meal: "breakfast", foodId: egg, quantity: 2 }] } });
    await api("PUT", `/meal-plans/${NEXT}/days/${NDAY(5)}`, { token, body: { items: [{ meal: "snack", foodId: idli, quantity: 1 }] } });

    const filled = await apply(token, t.id, "fill");
    assert.equal(filled.status, 200);
    assert.deepEqual(summary(filled.body.items, NDAY(0)), ["breakfast:Egg curry×2", "lunch:Curd rice×1.5"], "the planned breakfast stays; the empty lunch is filled");
    assert.deepEqual(summary(filled.body.items, NDAY(2)), ["dinner:Egg curry×1"]);
    assert.deepEqual(summary(filled.body.items, NDAY(5)), ["snack:2 idli×1"], "days the template leaves empty are untouched");
    assert.equal(filled.body.source, "template");

    const replaced = await apply(token, t.id, "replace");
    assert.deepEqual(summary(replaced.body.items, NDAY(0)), ["breakfast:2 idli×1", "lunch:Curd rice×1.5"]);
    assert.deepEqual(summary(replaced.body.items, NDAY(5)), [], "replace clears the rest of the week");
  });

  test("skip foods that were deleted from the library", async () => {
    const { token, rice } = await withWeek();
    const t: Template = (await save(token, "Base")).body;
    db.prepare("DELETE FROM plan_items WHERE food_id = ?").run(rice);
    db.prepare("DELETE FROM library_foods WHERE id = ?").run(rice);
    const list: Template[] = (await api("GET", "/plan-templates", { token })).body.data;
    assert.deepEqual(list[0].days[0].meals.lunch, []);
    const r = await apply(token, t.id, "replace");
    assert.deepEqual(summary(r.body.items, NDAY(0)), ["breakfast:2 idli×1"]);
  });

  test("won't apply over an open draft, which Discard would otherwise undo", async () => {
    const { setLlm, DisabledLlm } = await import("../src/ai/llm.js");
    setLlm(new DisabledLlm());
    const { token } = await withWeek();
    const t: Template = (await save(token, "Base")).body;
    await api("POST", `/meal-plans/${NEXT}/generate`, { token, body: { scope: "day", date: NDAY(0), mode: "usual" } });
    const r = await apply(token, t.id, "replace");
    assert.equal(r.status, 409);
    assert.equal(r.body.type, "https://lighter.app/problems/draft-open");
  });

  test("delete a template", async () => {
    const { token } = await withWeek();
    const t: Template = (await save(token, "Base")).body;
    assert.equal((await api("DELETE", `/plan-templates/${t.id}`, { token })).status, 204);
    assert.deepEqual((await api("GET", "/plan-templates", { token })).body.data, []);
    assert.equal((await api("DELETE", `/plan-templates/${t.id}`, { token })).status, 404);
  });

  test("validate names, empty weeks and unknown templates", async () => {
    const { token } = await withWeek();
    await save(token, "Base");
    assert.equal((await save(token, "base")).status, 409, "names are unique, ignoring case");
    const empty = await save(token, "Nothing", NEXT);
    assert.equal(empty.status, 400);
    assert.deepEqual(empty.body.errors.map((e: { pointer: string }) => e.pointer), ["/weekStart"]);
    assert.equal((await save(token, "")).status, 400);
    assert.equal((await apply(token, randomUUID(), "replace")).status, 404);
    assert.equal((await apply(token, randomUUID(), "merge")).status, 400);
  });

  test("keeps each user's templates separate", async () => {
    const { token } = await withWeek();
    const t: Template = (await save(token, "Mine")).body;
    const other = await onboardedUser();
    assert.deepEqual((await api("GET", "/plan-templates", { token: other.token })).body.data, []);
    assert.equal((await apply(other.token, t.id, "replace")).status, 404);
  });
});
