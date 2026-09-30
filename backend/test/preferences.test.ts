import assert from "node:assert/strict";
import { describe, test } from "node:test";

const { api, DAY, foodId, onboardedUser, PROFILE, WEEK } = await import("./helpers.js");

type Food = { name: string; source: string; diet: string | null; allergens: string[]; allergyConflicts: string[] };
const library = async (token: string): Promise<Food[]> => (await api("GET", "/food-library?tab=all", { token })).body.data;
const log = (token: string, name: string) => api("POST", "/food-entries", { token, body: { date: "2026-09-29", meal: "lunch", name, calories: 300, protein: 10, carbs: 40, fat: 8 } });

describe("food preferences on the profile", () => {
  test("default to no restrictions and a medium budget", async () => {
    const { token } = await onboardedUser();
    const p = (await api("GET", "/me/profile", { token })).body;
    assert.deepEqual({ dietType: p.dietType, allergies: p.allergies, budget: p.budget, dailyBudget: p.dailyBudget }, { dietType: "non-veg", allergies: [], budget: "medium", dailyBudget: null });
  });

  test("store diet type, budget and allergies, tidying allergy names", async () => {
    const { token } = await onboardedUser();
    const r = await api("PATCH", "/me/profile", { token, body: { dietType: "eggetarian", allergies: [" Peanuts", "brinjal", "peanut", "Milk"], budget: "low", dailyBudget: 250 } });
    assert.equal(r.status, 200);
    assert.equal(r.body.dietType, "eggetarian");
    assert.deepEqual(r.body.allergies, ["peanut", "brinjal", "dairy"], "common names map to one allergen, custom ones are kept");
    assert.equal(r.body.budget, "low");
    assert.equal(r.body.dailyBudget, 250);
    assert.equal((await api("PATCH", "/me/profile", { token, body: { dailyBudget: null } })).body.dailyBudget, null);
  });

  test("a PUT without preferences keeps them", async () => {
    const { token } = await onboardedUser();
    await api("PATCH", "/me/profile", { token, body: { dietType: "veg", allergies: ["sesame"] } });
    const r = await api("PUT", "/me/profile", { token, body: { ...PROFILE, heightCm: 176 } });
    assert.equal(r.body.dietType, "veg");
    assert.deepEqual(r.body.allergies, ["sesame"]);
  });

  test("validates preferences", async () => {
    const { token } = await onboardedUser();
    const r = await api("PATCH", "/me/profile", { token, body: { dietType: "vegan", allergies: ["", "x".repeat(41), "  "], budget: "huge", dailyBudget: 0 } });
    assert.equal(r.status, 400);
    assert.deepEqual(r.body.errors.map((e: { pointer: string }) => e.pointer).sort(), ["/allergies/0", "/allergies/1", "/allergies/2", "/budget", "/dailyBudget", "/dietType"]);
    const many = await api("PATCH", "/me/profile", { token, body: { allergies: Array.from({ length: 21 }, (_, i) => `food ${i}`) } });
    assert.equal(many.status, 400);
  });
});

describe("diet type and allergens detected from food names", () => {
  const cases: [string, string, string[]][] = [
    ["Masala dosa", "veg", []],
    ["Coconut chutney", "veg", []],
    ["Curd rice", "veg", ["dairy"]],
    ["Paneer butter masala", "veg", ["dairy"]],
    ["Peanut butter toast", "veg", ["gluten", "peanut"]],
    ["Chapati with dal", "veg", ["gluten"]],
    ["Cashew pulao", "veg", ["tree nut"]],
    ["Tofu stir fry", "veg", ["soy"]],
    ["Ellu sadam", "veg", ["sesame"]],
    ["Eggless sponge cake", "veg", ["gluten"]],
    ["Omelette", "eggetarian", ["egg"]],
    ["Egg dosa", "eggetarian", ["egg"]],
    ["Chicken biryani", "non-veg", []],
    ["Mutton kola urundai", "non-veg", []],
    ["Meen kuzhambu", "non-veg", ["fish"]],
    ["Prawn fry", "non-veg", ["shellfish"]],
    ["Egg fried rice with chicken", "non-veg", ["egg"]],
    // Hindi and regional words, plurals, and look-alikes.
    ["Murgh makhani", "non-veg", ["dairy"]],
    ["Rogan gosht", "non-veg", []],
    ["Amritsari machhi", "non-veg", ["fish"]],
    ["Jhinga masala", "non-veg", ["shellfish"]],
    ["Karimeen pollichathu", "non-veg", ["fish"]],
    ["Chole bhature", "veg", ["gluten"]],
    ["Veg noodle soup", "veg", ["gluten"]],
    ["Banana pancakes", "veg", ["gluten"]],
    ["Soya keema", "veg", ["soy"]],
    ["Goat cheese salad", "veg", ["dairy"]],
    ["Thai curry with coconut cream", "veg", []],
    ["Cashew milk", "veg", ["tree nut"]],
    ["Ground nuts chaat", "veg", ["peanut"]],
    ["Masala chai", "veg", ["dairy"]],
    ["Vegan mayo sandwich", "veg", ["gluten"]],
  ];

  test("for logged foods", async () => {
    const { token } = await onboardedUser();
    for (const [name] of cases) await log(token, name);
    const foods = await library(token);
    const got = cases.map(([name]) => {
      const f = foods.find((x) => x.name === name)!;
      return [name, f.diet, f.allergens];
    });
    assert.deepEqual(got, cases);
  });

  test("for favorites", async () => {
    const { token } = await onboardedUser();
    await api("POST", "/favorite-foods", { token, body: { name: "Badam milk", meal: "snack", calories: 180, protein: 6, carbs: 20, fat: 8 } });
    const f = (await library(token)).find((x) => x.name === "Badam milk")!;
    assert.deepEqual([f.diet, f.allergens], ["veg", ["dairy", "tree nut"]]);
  });

  test("curated dishes keep the diet and allergens they come with", async () => {
    const { token } = await onboardedUser();
    const f = (await library(token)).find((x) => /^Apple with 1 tbsp peanut butter/.test(x.name))!;
    assert.deepEqual([f.source, f.diet, f.allergens], ["curated", "veg", ["peanut"]]);
  });
});

describe("allergy conflicts", () => {
  test("flag library foods with a listed allergen or a custom allergy in the name", async () => {
    const { token } = await onboardedUser();
    await log(token, "Brinjal curry");
    await log(token, "Peanut chikki");
    await api("PATCH", "/me/profile", { token, body: { allergies: ["peanut", "brinjal"] } });
    const foods = await library(token);
    const conflicts = (name: string) => foods.find((f) => f.name === name)!.allergyConflicts;
    assert.deepEqual(conflicts("Brinjal curry"), ["brinjal"]);
    assert.deepEqual(conflicts("Peanut chikki"), ["peanut"]);
    assert.deepEqual(foods.find((f) => /^Apple with 1 tbsp peanut butter/.test(f.name))!.allergyConflicts, ["peanut"]);
    assert.ok(foods.filter((f) => !/peanut|brinjal/i.test(f.name)).every((f) => f.allergyConflicts.length === 0));
  });

  test("match custom allergies against curated ingredients, whatever their punctuation", async () => {
    const { token } = await onboardedUser();
    await api("PATCH", "/me/profile", { token, body: { cuisine: "any", allergies: ["tomato", "k-rice"] } });
    await log(token, "K-rice bowl");
    const foods = await library(token);
    assert.deepEqual(foods.find((f) => /^Chicken chettinad/.test(f.name))!.allergyConflicts, ["tomato"], "tomato is an ingredient, not in the name");
    assert.deepEqual(foods.find((f) => f.name === "K-rice bowl")!.allergyConflicts, ["k-rice"]);
  });

  test("flag planned foods", async () => {
    const { token } = await onboardedUser();
    await api("PATCH", "/me/profile", { token, body: { allergies: ["dairy"] } });
    const rice = await foodId(token, /^Curd rice/);
    const idli = await foodId(token, /^2 idli with sambar/);
    const r = await api("PUT", `/meal-plans/${WEEK}/days/${DAY(0)}`, { token, body: { items: [{ meal: "lunch", foodId: rice, quantity: 1 }, { meal: "breakfast", foodId: idli, quantity: 1 }] } });
    const byName = (re: RegExp) => r.body.items.find((i: { food: Food }) => re.test(i.food.name)).food.allergyConflicts;
    assert.deepEqual(byName(/^Curd rice/), ["dairy"]);
    assert.deepEqual(byName(/^2 idli/), []);
  });
});
