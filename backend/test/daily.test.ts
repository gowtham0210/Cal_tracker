import assert from "node:assert/strict";
import { describe, test } from "node:test";

const { api, newUser, onboardedUser, PROFILE } = await import("./helpers.js");

describe("/weight-entries", () => {
  test("PUT creates (201) then replaces (200) the day's weigh-in", async () => {
    const { token } = await newUser();
    const a = await api("PUT", "/weight-entries/2026-09-29", { token, body: { weight: 82.4 } });
    assert.equal(a.status, 201);
    assert.equal(a.body.date, "2026-09-29");
    const b = await api("PUT", "/weight-entries/2026-09-29", { token, body: { weight: 81.9 } });
    assert.equal(b.status, 200);
    assert.deepEqual((await api("GET", "/weight-entries", { token })).body.data.map((w: { weight: number }) => w.weight), [81.9]);
  });

  test("lists a date range and pages by date", async () => {
    const { token } = await newUser();
    for (const d of ["01", "02", "03", "04", "05"]) await api("PUT", `/weight-entries/2026-09-${d}`, { token, body: { weight: 80 } });
    const p1 = (await api("GET", "/weight-entries?from=2026-09-02&limit=2", { token })).body;
    assert.deepEqual(p1.data.map((w: { date: string }) => w.date), ["2026-09-02", "2026-09-03"]);
    const p2 = (await api("GET", `/weight-entries?from=2026-09-02&limit=2&cursor=${p1.nextCursor}`, { token })).body;
    assert.deepEqual(p2.data.map((w: { date: string }) => w.date), ["2026-09-04", "2026-09-05"]);
    assert.equal(p2.nextCursor, null);
  });

  test("DELETE removes a weigh-in but refuses the start weigh-in", async () => {
    const { token } = await onboardedUser();
    await api("PUT", "/weight-entries/2026-09-29", { token, body: { weight: 82 } });
    assert.equal((await api("DELETE", "/weight-entries/2026-09-29", { token })).status, 204);
    assert.equal((await api("DELETE", "/weight-entries/2026-09-29", { token })).status, 404);
    const start = await api("DELETE", `/weight-entries/${PROFILE.startDate}`, { token });
    assert.equal(start.status, 409);
  });

  test("validates the date and weight", async () => {
    const { token } = await newUser();
    assert.equal((await api("PUT", "/weight-entries/2026-02-30", { token, body: { weight: 80 } })).status, 400);
    assert.equal((await api("PUT", "/weight-entries/2026-09-29", { token, body: { weight: 0 } })).status, 400);
    assert.equal((await api("PUT", "/weight-entries/2026-09-29", { token, body: { weight: "80" } })).status, 400);
  });
});

describe("/measurement-entries", () => {
  test("needs at least one measurement; PUT replaces, so omitted ones are cleared", async () => {
    const { token } = await newUser();
    assert.equal((await api("PUT", "/measurement-entries/2026-09-29", { token, body: {} })).status, 400);
    await api("PUT", "/measurement-entries/2026-09-29", { token, body: { waist: 94.5, hips: 104 } });
    const r = await api("PUT", "/measurement-entries/2026-09-29", { token, body: { waist: 94 } });
    assert.equal(r.status, 200);
    assert.equal(r.body.waist, 94);
    assert.equal(r.body.hips, undefined);
    assert.equal((await api("DELETE", "/measurement-entries/2026-09-29", { token })).status, 204);
  });
});

describe("/water-entries", () => {
  test("sets glasses per day, including zero, within 0–30", async () => {
    const { token } = await newUser();
    assert.equal((await api("PUT", "/water-entries/2026-09-29", { token, body: { glasses: 5 } })).status, 201);
    assert.equal((await api("PUT", "/water-entries/2026-09-29", { token, body: { glasses: 0 } })).body.glasses, 0);
    assert.equal((await api("PUT", "/water-entries/2026-09-29", { token, body: { glasses: 31 } })).status, 400);
    assert.equal((await api("PUT", "/water-entries/2026-09-29", { token, body: { glasses: 2.5 } })).status, 400);
  });
});

describe("/journal-entries", () => {
  test("saves, reads and replaces a day's entry", async () => {
    const { token } = await newUser();
    assert.equal((await api("GET", "/journal-entries/2026-09-29", { token })).status, 404);
    const r = await api("PUT", "/journal-entries/2026-09-29", { token, body: { mood: 4, energy: 3, sleepHours: 7.5, cravings: 1, note: "Good day" } });
    assert.equal(r.status, 201);
    assert.equal((await api("GET", "/journal-entries/2026-09-29", { token })).body.note, "Good day");
    const replaced = (await api("PUT", "/journal-entries/2026-09-29", { token, body: { mood: 2 } })).body;
    assert.equal(replaced.mood, 2);
    assert.equal(replaced.note, undefined, "PUT replaces the whole entry");
  });

  test("validates ranges and needs at least one field", async () => {
    const { token } = await newUser();
    const r = await api("PUT", "/journal-entries/2026-09-29", { token, body: { mood: 6, energy: 0, cravings: 4, sleepHours: 25 } });
    assert.deepEqual(r.body.errors.map((e: { pointer: string }) => e.pointer).sort(), ["/cravings", "/energy", "/mood", "/sleepHours"]);
    assert.equal((await api("PUT", "/journal-entries/2026-09-29", { token, body: {} })).status, 400);
  });
});

describe("/exercise-entries", () => {
  const walk = { date: "2026-09-29", name: "Walking", minutes: 45, calories: 203 };

  test("logs, lists and deletes workouts", async () => {
    const { token } = await newUser();
    const e = await api("POST", "/exercise-entries", { token, body: walk });
    assert.equal(e.status, 201);
    assert.ok(e.headers.get("location")?.endsWith(e.body.id));
    await api("POST", "/exercise-entries", { token, body: { ...walk, date: "2026-09-28" } });
    assert.equal((await api("GET", "/exercise-entries?date=2026-09-29", { token })).body.data.length, 1);
    assert.equal((await api("DELETE", `/exercise-entries/${e.body.id}`, { token })).status, 204);
    assert.equal((await api("DELETE", `/exercise-entries/${e.body.id}`, { token })).status, 404);
  });

  test("validates minutes and calories", async () => {
    const { token } = await newUser();
    const r = await api("POST", "/exercise-entries", { token, body: { ...walk, minutes: 0, calories: -1 } });
    assert.deepEqual(r.body.errors.map((e: { pointer: string }) => e.pointer).sort(), ["/calories", "/minutes"]);
  });
});
