import assert from "node:assert/strict";
import { describe, test } from "node:test";

const { api, newUser, onboardedUser } = await import("./helpers.js");

const log = (token: string, name: string, meal: string, calories: number, date = "2026-09-29") =>
  api("POST", "/food-entries", { token, body: { date, meal, name, calories, protein: 5, carbs: 30, fat: 5 } });

type Food = { name: string; source: string; useCount: number; meal: string; calories: number; cuisine: string | null };

describe("GET /food-library", () => {
  test("starts with curated dishes in the user's food style", async () => {
    const { token } = await onboardedUser();
    const r = await api("GET", "/food-library", { token });
    assert.equal(r.status, 200);
    const foods: Food[] = r.body.data;
    assert.ok(foods.length >= 10);
    assert.ok(foods.every((f) => f.source === "curated" && f.cuisine === "tamil-nadu"), JSON.stringify(foods.slice(0, 3)));
    assert.ok(foods.some((f) => /idli/i.test(f.name)));
  });

  test("follows the food style for curated dishes", async () => {
    const { token } = await onboardedUser();
    await api("PATCH", "/me/profile", { token, body: { cuisine: "north-indian" } });
    const foods: Food[] = (await api("GET", "/food-library", { token })).body.data;
    assert.ok(foods.length > 0);
    assert.ok(foods.every((f) => f.cuisine === "north-indian"), JSON.stringify(foods.map((f) => f.name)));
  });

  test("puts logged foods first, most eaten first, using the latest values and usual meal", async () => {
    const { token } = await onboardedUser();
    await log(token, "Masala dosa", "breakfast", 350, "2026-09-26");
    await log(token, "Masala dosa", "dinner", 360, "2026-09-27");
    await log(token, "Masala dosa", "breakfast", 370, "2026-09-28");
    await log(token, "Filter coffee", "snack", 90);
    const foods: Food[] = (await api("GET", "/food-library", { token })).body.data;
    assert.deepEqual(
      foods.slice(0, 2).map(({ name, source, useCount, meal, calories }) => ({ name, source, useCount, meal, calories })),
      [
        { name: "Masala dosa", source: "logged", useCount: 3, meal: "breakfast", calories: 370 },
        { name: "Filter coffee", source: "logged", useCount: 1, meal: "snack", calories: 90 },
      ],
    );
    assert.equal(foods[2].source, "curated", "curated dishes follow the user's own foods");
  });

  test("lists favorites, filters by meal and searches by name", async () => {
    const { token } = await onboardedUser();
    await api("POST", "/favorite-foods", { token, body: { name: "Protein shake", meal: "snack", calories: 130, protein: 25, carbs: 4, fat: 2 } });
    const favs: Food[] = (await api("GET", "/food-library?tab=favorites", { token })).body.data;
    assert.deepEqual(favs.map((f) => [f.name, f.source]), [["Protein shake", "favorite"]]);

    const snacks: Food[] = (await api("GET", "/food-library?meal=snack", { token })).body.data;
    assert.ok(snacks.length > 0 && snacks.every((f) => f.meal === "snack"));

    const found: Food[] = (await api("GET", "/food-library?q=IDLI", { token })).body.data;
    assert.ok(found.length > 0 && found.every((f) => /idli/i.test(f.name)));
  });

  test("keeps each user's library separate", async () => {
    const a = await onboardedUser();
    const b = await onboardedUser();
    await log(a.token, "Secret snack", "snack", 100);
    const foods: Food[] = (await api("GET", "/food-library?tab=all", { token: b.token })).body.data;
    assert.ok(!foods.some((f) => f.name === "Secret snack"));
  });

  test("validates the query", async () => {
    const { token } = await newUser();
    assert.equal((await api("GET", "/food-library?tab=weird", { token })).status, 400);
  });
});
