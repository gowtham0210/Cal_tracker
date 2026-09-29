import assert from "node:assert/strict";
import { describe, test } from "node:test";

const { api, db, newUser, onboardedUser } = await import("./helpers.js");

describe("bearer auth", () => {
  test("rejects requests without a token", async () => {
    const r = await api("GET", "/me");
    assert.equal(r.status, 401);
    assert.match(r.headers.get("www-authenticate")!, /^Bearer/);
  });

  test("rejects a forged token", async () => {
    const r = await api("GET", "/me", { token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.bad" });
    assert.equal(r.status, 401);
  });

  test("rejects the token of a deleted account", async () => {
    const u = await newUser();
    assert.equal((await api("DELETE", "/me", { token: u.token })).status, 204);
    assert.equal((await api("GET", "/me", { token: u.token })).status, 401);
  });
});

describe("POST /auth/login", () => {
  test("signs in with the right password, ignoring email case and spaces", async () => {
    const u = await newUser("Asha");
    const r = await api("POST", "/auth/login", { body: { email: `  ${u.email.toUpperCase()} `, password: u.password } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("cache-control"), "no-store");
    assert.equal(r.body.user.id, u.user.id);
    assert.equal((await api("GET", "/me", { token: r.body.accessToken })).body.name, "Asha");
  });

  test("gives the same answer for a wrong password and an unknown email", async () => {
    const u = await newUser();
    const wrong = await api("POST", "/auth/login", { body: { email: u.email, password: "wrong password" } });
    const unknown = await api("POST", "/auth/login", { body: { email: "nobody@example.test", password: "whatever1" } });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(wrong.body, unknown.body);
  });

  test("validates the body", async () => {
    const r = await api("POST", "/auth/login", { body: { email: "x" } });
    assert.equal(r.status, 400);
    assert.deepEqual(r.body.errors.map((e: { pointer: string }) => e.pointer).sort(), ["/email", "/password"]);
  });

  test("locks out an email after 10 attempts in 15 minutes", async () => {
    const u = await newUser();
    for (let i = 0; i < 10; i++) await api("POST", "/auth/login", { body: { email: u.email, password: "wrong password" } });
    const r = await api("POST", "/auth/login", { body: { email: u.email, password: u.password } });
    assert.equal(r.status, 429);
    assert.ok(Number(r.headers.get("retry-after")) > 0);
  });
});

describe("/me", () => {
  test("reads and updates the user", async () => {
    const u = await newUser("Old Name");
    assert.equal((await api("GET", "/me", { token: u.token })).body.email, u.email);
    const r = await api("PATCH", "/me", { token: u.token, body: { name: "  New Name " } });
    assert.equal(r.status, 200);
    assert.equal(r.body.name, "New Name");
  });

  test("refuses an email that another user has", async () => {
    const a = await newUser();
    const b = await newUser();
    const r = await api("PATCH", "/me", { token: b.token, body: { email: a.email.toUpperCase() } });
    assert.equal(r.status, 409);
  });

  test("refuses an empty patch", async () => {
    const u = await newUser();
    assert.equal((await api("PATCH", "/me", { token: u.token, body: {} })).status, 400);
  });

  test("deleting the account removes all of its data", async () => {
    const u = await onboardedUser();
    await api("PUT", "/me/demo-data", { token: u.token });
    await api("DELETE", "/me", { token: u.token });
    for (const t of ["users", "user_credentials", "profiles", "food_entries", "weight_entries", "journal_entries"]) {
      const col = t === "users" ? "id" : "user_id";
      assert.deepEqual(db.prepare(`SELECT count(*) AS n FROM ${t} WHERE ${col} = ?`).get(u.user.id), { n: 0 }, t);
    }
  });
});

describe("/me/data and /me/demo-data", () => {
  test("demo data fills every log, and clearing keeps the account, profile and start weight", async () => {
    const u = await onboardedUser();
    assert.equal((await api("PUT", "/me/demo-data", { token: u.token })).status, 204);
    const profile = (await api("GET", "/me/profile", { token: u.token })).body;
    assert.equal(profile.startWeight, 92.4);
    assert.equal(profile.timeZone, "Asia/Kolkata", "demo keeps the user's time zone");
    for (const path of ["/food-entries", "/weight-entries", "/measurement-entries", "/exercise-entries", "/water-entries", "/journal-entries", "/favorite-foods"]) {
      assert.ok((await api("GET", path, { token: u.token })).body.data.length > 0, path);
    }

    assert.equal((await api("DELETE", "/me/data", { token: u.token })).status, 204);
    assert.equal((await api("GET", "/food-entries", { token: u.token })).body.data.length, 0);
    const weights = (await api("GET", "/weight-entries", { token: u.token })).body.data;
    assert.deepEqual(weights.map((w: { date: string }) => w.date), [profile.startDate], "only the start weigh-in is kept");
    assert.equal((await api("GET", "/me/profile", { token: u.token })).body.startWeight, 92.4);
    assert.equal((await api("GET", "/me", { token: u.token })).status, 200);
  });
});
