import assert from "node:assert/strict";
import { describe, test } from "node:test";

const { api, newUser, PROFILE } = await import("./helpers.js");

describe("/me/profile", () => {
  test("is 404 until onboarding, then 201 on create and 200 on replace", async () => {
    const u = await newUser();
    const missing = await api("GET", "/me/profile", { token: u.token });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.type, "https://lighter.app/problems/profile-required");

    const created = await api("PUT", "/me/profile", { token: u.token, body: PROFILE });
    assert.equal(created.status, 201);
    const { updatedAt, ...rest } = created.body;
    assert.deepEqual(rest, PROFILE);
    assert.equal((await api("PUT", "/me/profile", { token: u.token, body: { ...PROFILE, heightCm: 176 } })).status, 200);
  });

  test("stores the start weight as the weigh-in on the start date", async () => {
    const u = await newUser();
    await api("PUT", "/me/profile", { token: u.token, body: PROFILE });
    const weights = (await api("GET", "/weight-entries", { token: u.token })).body.data;
    assert.deepEqual(
      weights.map(({ date, weight }: { date: string; weight: number }) => ({ date, weight })),
      [{ date: "2026-06-01", weight: 92.4 }],
    );
  });

  test("merge-patches fields and macro goals", async () => {
    const u = await newUser();
    await api("PUT", "/me/profile", { token: u.token, body: PROFILE });
    const r = await api("PATCH", "/me/profile", { token: u.token, body: { calorieGoal: 1800, macroGoals: { protein: 140 } } });
    assert.equal(r.status, 200);
    assert.equal(r.body.calorieGoal, 1800);
    assert.deepEqual(r.body.macroGoals, { protein: 140, carbs: 190, fat: 65 });
  });

  test("changing startWeight updates the start weigh-in", async () => {
    const u = await newUser();
    await api("PUT", "/me/profile", { token: u.token, body: PROFILE });
    await api("PATCH", "/me/profile", { token: u.token, body: { startWeight: 93 } });
    const w = (await api("GET", "/weight-entries", { token: u.token })).body.data;
    assert.equal(w.find((x: { date: string }) => x.date === "2026-06-01").weight, 93);
  });

  test("moving startDate carries the start weight, or adopts an existing weigh-in on the new date", async () => {
    const u = await newUser();
    await api("PUT", "/me/profile", { token: u.token, body: PROFILE });
    let p = (await api("PATCH", "/me/profile", { token: u.token, body: { startDate: "2026-06-05" } })).body;
    assert.equal(p.startWeight, 92.4);
    await api("PUT", "/weight-entries/2026-06-10", { token: u.token, body: { weight: 91.2 } });
    p = (await api("PATCH", "/me/profile", { token: u.token, body: { startDate: "2026-06-10" } })).body;
    assert.equal(p.startWeight, 91.2);
  });

  test("validates every field", async () => {
    const u = await newUser();
    const bad = { ...PROFILE, heightCm: 0, units: "stone", timeZone: "Mars/Base", startDate: "2026-02-30", macroGoals: { protein: -1, carbs: 1, fat: 1 } };
    const r = await api("PUT", "/me/profile", { token: u.token, body: bad });
    assert.equal(r.status, 400);
    assert.deepEqual(r.body.errors.map((e: { pointer: string }) => e.pointer).sort(), ["/heightCm", "/macroGoals/protein", "/startDate", "/timeZone", "/units"]);
  });

  test("accepts Asia/Kolkata (missing from Intl.supportedValuesOf)", async () => {
    const u = await newUser();
    assert.equal((await api("PUT", "/me/profile", { token: u.token, body: { ...PROFILE, timeZone: "Asia/Kolkata" } })).status, 201);
  });

  test("stores the food style, and rejects unknown ones", async () => {
    const u = await newUser();
    await api("PUT", "/me/profile", { token: u.token, body: PROFILE });
    assert.equal((await api("PATCH", "/me/profile", { token: u.token, body: { cuisine: "north-indian" } })).body.cuisine, "north-indian");
    const bad = await api("PATCH", "/me/profile", { token: u.token, body: { cuisine: "martian" } });
    assert.equal(bad.status, 400);
    assert.deepEqual(bad.body.errors.map((e: { pointer: string }) => e.pointer), ["/cuisine"]);
  });

  test("PATCH needs an existing profile", async () => {
    const u = await newUser();
    assert.equal((await api("PATCH", "/me/profile", { token: u.token, body: { calorieGoal: 1800 } })).status, 404);
  });
});
