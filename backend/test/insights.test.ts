import assert from "node:assert/strict";
import { describe, test } from "node:test";

const { api, newUser, onboardedUser, PROFILE } = await import("./helpers.js");

const food = (date: string, calories: number, protein = 10) => ({ date, meal: "lunch", name: "Meal", calories, protein, carbs: 10, fat: 5 });

describe("/insights/overview", () => {
  test("needs a profile", async () => {
    const { token } = await newUser();
    const r = await api("GET", "/insights/overview", { token });
    assert.equal(r.status, 404);
    assert.equal(r.body.type, "https://lighter.app/problems/profile-required");
  });

  test("computes weight progress, BMI, projection and streaks as of a day", async () => {
    const { token } = await onboardedUser();
    // Start 92.4 on 2026-06-01; lose 0.5 kg a week for 8 weeks.
    for (let w = 1; w <= 8; w++) {
      const d = new Date(Date.UTC(2026, 5, 1 + w * 7)).toISOString().slice(0, 10);
      await api("PUT", `/weight-entries/${d}`, { token, body: { weight: 92.4 - 0.5 * w } });
    }
    for (const d of ["2026-07-24", "2026-07-25", "2026-07-26", "2026-07-20"]) await api("POST", "/food-entries", { token, body: food(d, 500) });

    const o = (await api("GET", "/insights/overview?asOf=2026-07-27", { token })).body;
    assert.equal(o.asOf, "2026-07-27");
    assert.equal(o.currentWeight, 88.4);
    assert.equal(o.lostKg, 4);
    assert.equal(o.goalProgressPercent, Math.round((4 / 14.4) * 1000) / 10);
    assert.ok(o.weeklyRateKg < -0.3 && o.weeklyRateKg > -0.6, `rate ${o.weeklyRateKg}`);
    assert.ok(o.projectedGoalDate > "2026-07-27");
    assert.equal(o.bmi, Math.round((88.4 / 1.75 ** 2) * 10) / 10);
    assert.equal(o.bmiCategory, "overweight");
    assert.equal(o.currentStreak, 3, "nothing on the 27th yet, so the streak runs 24–26");
    assert.equal(o.longestStreak, 3);
  });

  test("with no trend there is no projected date", async () => {
    const { token } = await onboardedUser();
    const o = (await api("GET", "/insights/overview?asOf=2026-06-02", { token })).body;
    assert.equal(o.currentWeight, PROFILE.startWeight);
    assert.equal(o.projectedGoalDate, null);
  });
});

describe("/insights/daily", () => {
  test("returns one row per day, including empty days", async () => {
    const { token } = await newUser();
    await api("POST", "/food-entries", { token, body: food("2026-09-01", 600, 30) });
    await api("POST", "/food-entries", { token, body: food("2026-09-01", 400, 20) });
    await api("POST", "/exercise-entries", { token, body: { date: "2026-09-01", name: "Run", minutes: 30, calories: 300 } });
    await api("PUT", "/weight-entries/2026-09-01", { token, body: { weight: 80 } });
    await api("PUT", "/water-entries/2026-09-02", { token, body: { glasses: 6 } });
    await api("PUT", "/journal-entries/2026-09-03", { token, body: { mood: 4 } });

    const rows = (await api("GET", "/insights/daily?from=2026-09-01&to=2026-09-03", { token })).body.data;
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[0], { date: "2026-09-01", calories: 1000, protein: 50, carbs: 20, fat: 10, burned: 300, net: 700, weight: 80, waterGlasses: null, mood: null });
    assert.equal(rows[1].calories, 0);
    assert.equal(rows[1].waterGlasses, 6);
    assert.equal(rows[2].mood, 4);
  });

  test("needs from and to, in order, at most 366 days apart", async () => {
    const { token } = await newUser();
    assert.equal((await api("GET", "/insights/daily", { token })).status, 400);
    assert.equal((await api("GET", "/insights/daily?from=2026-09-03&to=2026-09-01", { token })).status, 400);
    assert.equal((await api("GET", "/insights/daily?from=2025-01-01&to=2026-09-01", { token })).status, 400);
  });
});

describe("/insights/badges", () => {
  test("reports progress towards every badge, in the user's units", async () => {
    const { token } = await onboardedUser();
    await api("PATCH", "/me/profile", { token, body: { units: "imperial" } });
    await api("POST", "/food-entries", { token, body: food("2026-09-01", 500) });
    const data = (await api("GET", "/insights/badges", { token })).body.data;
    assert.equal(data.length, 10);
    assert.deepEqual(data.find((b: { id: string }) => b.id === "first-log"), {
      id: "first-log", title: "First step", description: "Log your first meal", emoji: "🌱", earned: true, progress: 1,
    });
    assert.equal(data.find((b: { id: string }) => b.id === "lost-5").title, "Down 11 lb");
  });
});

describe("/exports/{kind}", () => {
  test("downloads CSV with a file name, escaping and formula protection", async () => {
    const { token } = await onboardedUser();
    await api("POST", "/food-entries", { token, body: { ...food("2026-09-01", 500), name: 'Dal, rice & "salad"' } });
    await api("POST", "/food-entries", { token, body: { ...food("2026-09-02", 300), name: "=HYPERLINK(\"http://evil\")" } });
    const r = await api("GET", "/exports/food", { token });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type")!, /^text\/csv/);
    assert.match(r.headers.get("content-disposition")!, /^attachment; filename="lighter-food-\d{4}-\d{2}-\d{2}\.csv"$/);
    const lines = (r.body as string).trim().split("\n");
    assert.equal(lines[0], "date,meal,name,calories,protein,carbs,fat,source");
    assert.equal(lines[1], '2026-09-01,lunch,"Dal, rice & ""salad""",500,10,10,5,manual');
    assert.equal(lines[2], `2026-09-02,lunch,"'=HYPERLINK(""http://evil"")",300,10,10,5,manual`);
  });

  test("builds the daily summary", async () => {
    const { token } = await onboardedUser();
    await api("POST", "/food-entries", { token, body: food("2026-09-01", 500, 40) });
    await api("PUT", "/water-entries/2026-09-01", { token, body: { glasses: 7 } });
    const lines = ((await api("GET", "/exports/daily", { token })).body as string).trim().split("\n");
    assert.equal(lines[0], "date,weight_kg,calories_in,calories_burned,net_calories,protein_g,carbs_g,fat_g,water_glasses,mood");
    assert.ok(lines.includes("2026-09-01,,500,0,500,40,10,5,7,"));
    assert.ok(lines.some((l) => l.startsWith(`${PROFILE.startDate},92.4,`)), "start weigh-in day is included");
  });

  test("rejects an unknown kind", async () => {
    const { token } = await newUser();
    assert.equal((await api("GET", "/exports/everything", { token })).status, 400);
  });
});
