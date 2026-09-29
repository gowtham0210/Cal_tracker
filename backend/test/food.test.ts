import assert from "node:assert/strict";
import { describe, test } from "node:test";

const { api, newUser } = await import("./helpers.js");

const oats = { date: "2026-09-29", meal: "breakfast", name: "Oatmeal", calories: 265, protein: 7, carbs: 54, fat: 3 };

describe("/food-entries", () => {
  test("creates, reads, edits and deletes an entry", async () => {
    const { token } = await newUser();
    const created = await api("POST", "/food-entries", { token, body: oats });
    assert.equal(created.status, 201);
    assert.equal(created.headers.get("location"), `/api/v1/food-entries/${created.body.id}`);
    assert.equal(created.body.source, "manual");
    assert.equal(created.body.favoriteId, null);

    const id = created.body.id;
    assert.deepEqual((await api("GET", `/food-entries/${id}`, { token })).body, created.body);
    const edited = await api("PATCH", `/food-entries/${id}`, { token, body: { calories: 310, meal: "snack" } });
    assert.equal(edited.body.calories, 310);
    assert.equal(edited.body.meal, "snack");
    assert.equal(edited.body.name, "Oatmeal");

    assert.equal((await api("DELETE", `/food-entries/${id}`, { token })).status, 204);
    assert.equal((await api("GET", `/food-entries/${id}`, { token })).status, 404);
  });

  test("undo: re-posting a deleted entry, including its read-only fields, works", async () => {
    const { token } = await newUser();
    const e = (await api("POST", "/food-entries", { token, body: oats })).body;
    await api("DELETE", `/food-entries/${e.id}`, { token });
    const again = await api("POST", "/food-entries", { token, body: e });
    assert.equal(again.status, 201);
    assert.equal(again.body.name, "Oatmeal");
  });

  test("filters by day, range and meal, oldest first", async () => {
    const { token } = await newUser();
    for (const [date, meal] of [["2026-09-27", "lunch"], ["2026-09-28", "breakfast"], ["2026-09-28", "dinner"], ["2026-09-29", "breakfast"]]) {
      await api("POST", "/food-entries", { token, body: { ...oats, date, meal } });
    }
    const day = (await api("GET", "/food-entries?date=2026-09-28", { token })).body.data;
    assert.deepEqual(day.map((f: { meal: string }) => f.meal), ["breakfast", "dinner"]);
    const range = (await api("GET", "/food-entries?from=2026-09-28&to=2026-09-29&meal=breakfast", { token })).body.data;
    assert.deepEqual(range.map((f: { date: string }) => f.date), ["2026-09-28", "2026-09-29"]);
    assert.equal((await api("GET", "/food-entries?date=2026-09-28&from=2026-09-01", { token })).status, 400);
    assert.equal((await api("GET", "/food-entries?from=2026-09-29&to=2026-09-01", { token })).status, 400);
  });

  test("pages with a cursor without skipping or repeating entries", async () => {
    const { token } = await newUser();
    for (let i = 0; i < 7; i++) await api("POST", "/food-entries", { token, body: { ...oats, name: `Item ${i}` } });
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const r: any = await api("GET", `/food-entries?limit=3${cursor ? `&cursor=${cursor}` : ""}`, { token });
      seen.push(...r.body.data.map((f: { name: string }) => f.name));
      cursor = r.body.nextCursor;
    } while (cursor);
    const all = (await api("GET", "/food-entries?limit=500", { token })).body.data.map((f: { name: string }) => f.name);
    assert.deepEqual(seen, all, "paging returns the same list, in the same order, as one big page");
    assert.equal(new Set(seen).size, 7);
    assert.equal((await api("GET", "/food-entries?cursor=garbage", { token })).status, 400);
  });

  test("keeps users' data apart", async () => {
    const a = await newUser();
    const b = await newUser();
    const e = (await api("POST", "/food-entries", { token: a.token, body: oats })).body;
    assert.equal((await api("GET", `/food-entries/${e.id}`, { token: b.token })).status, 404);
    assert.equal((await api("PATCH", `/food-entries/${e.id}`, { token: b.token, body: { calories: 1 } })).status, 404);
    assert.equal((await api("DELETE", `/food-entries/${e.id}`, { token: b.token })).status, 404);
    assert.equal((await api("GET", "/food-entries", { token: b.token })).body.data.length, 0);
  });

  test("validates input", async () => {
    const { token } = await newUser();
    const r = await api("POST", "/food-entries", { token, body: { ...oats, calories: -5, meal: "brunch", date: "yesterday", extra: 1 } });
    assert.equal(r.status, 400);
    assert.deepEqual(r.body.errors.map((e: { pointer: string }) => e.pointer).sort(), ["", "/calories", "/date", "/meal"]);
    assert.equal((await api("PATCH", "/food-entries/not-a-uuid", { token, body: { calories: 1 } })).status, 400);
  });
});

describe("/favorite-foods", () => {
  const shake = { name: "Protein shake", meal: "snack", calories: 130, protein: 25, carbs: 4, fat: 2 };

  test("saves, lists by name, and rejects a duplicate name ignoring case", async () => {
    const { token } = await newUser();
    assert.equal((await api("POST", "/favorite-foods", { token, body: shake })).status, 201);
    await api("POST", "/favorite-foods", { token, body: { ...shake, name: "Apple" } });
    assert.deepEqual((await api("GET", "/favorite-foods", { token })).body.data.map((f: { name: string }) => f.name), ["Apple", "Protein shake"]);
    const dup = await api("POST", "/favorite-foods", { token, body: { ...shake, name: "PROTEIN SHAKE" } });
    assert.equal(dup.status, 409);
  });

  test("logging from a favorite links it; deleting the favorite keeps the entry", async () => {
    const { token } = await newUser();
    const fav = (await api("POST", "/favorite-foods", { token, body: shake })).body;
    const e = (await api("POST", "/food-entries", { token, body: { ...shake, date: "2026-09-29", source: "favorite", favoriteId: fav.id } })).body;
    assert.equal(e.favoriteId, fav.id);
    assert.equal((await api("DELETE", `/favorite-foods/${fav.id}`, { token })).status, 204);
    const after = (await api("GET", `/food-entries/${e.id}`, { token })).body;
    assert.equal(after.favoriteId, null);
    assert.equal(after.name, "Protein shake");
  });

  test("rejects a favoriteId that is not the user's, or used without source favorite", async () => {
    const a = await newUser();
    const b = await newUser();
    const fav = (await api("POST", "/favorite-foods", { token: a.token, body: shake })).body;
    const foreign = await api("POST", "/food-entries", { token: b.token, body: { ...shake, date: "2026-09-29", source: "favorite", favoriteId: fav.id } });
    assert.equal(foreign.status, 400);
    const wrongSource = await api("POST", "/food-entries", { token: a.token, body: { ...shake, date: "2026-09-29", favoriteId: fav.id } });
    assert.equal(wrongSource.status, 400);
  });
});
