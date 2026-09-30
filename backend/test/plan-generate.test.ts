import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, test } from "node:test";

const { api, DAY, foodId, onboardedUser, WEEK } = await import("./helpers.js");
const { setLlm, DisabledLlm } = await import("../src/ai/llm.js");
const { FakeLlm, text } = await import("./fake-llm.js");
type ChatMessage = import("../src/ai/llm.js").ChatMessage;

type Candidate = { id: string; name: string; meal: string; calories: number; yours: boolean };
type Facts = { date: string; calorieGoal: number; dietType: string; allergies: string[]; cuisine: string; mode: string; candidates: Candidate[] };
type Item = { date: string; meal: string; quantity: number; food: { id: string; name: string; source: string; diet: string; allergyConflicts: string[] } };
type Plan = { status: string; source: string | null; items: Item[]; days: { date: string; calories: number; status: { state: string } }[] };

const factsOf = (messages: ChatMessage[]): Facts => JSON.parse(text(messages[1]).replace(/^<facts>\n/, "").replace(/\n<\/facts>$/, ""));
/** One food per meal: the first candidate for each, at the given quantity. */
const firstPerMeal = (f: Facts, quantity = 1) =>
  ["breakfast", "lunch", "snack", "dinner"].flatMap((meal) => {
    const c = f.candidates.find((x) => x.meal === meal);
    return c ? [{ meal, foodId: c.id, quantity }] : [];
  });
const summary = (p: Plan, date: string) => p.items.filter((i) => i.date === date).map((i) => `${i.meal}:${i.food.name}×${i.quantity}`);
const generate = (token: string, body: object, headers?: Record<string, string>) => api("POST", `/meal-plans/${WEEK}/generate`, { token, body, headers });

let fake: InstanceType<typeof FakeLlm>;
beforeEach(() => {
  fake = new FakeLlm();
  fake.json_["plan-day@v1"] = (m) => ({ items: firstPerMeal(factsOf(m)) });
  setLlm(fake);
});

describe("generating a plan", () => {
  test("drafts a week one day at a time, keeping the previous plan until the draft is kept or discarded", async () => {
    const { token } = await onboardedUser();
    const idli = await foodId(token, /^2 idli with sambar/);
    await api("PUT", `/meal-plans/${WEEK}/days/${DAY(0)}`, { token, body: { items: [{ meal: "breakfast", foodId: idli, quantity: 1 }] } });
    const before: Plan = (await api("GET", `/meal-plans/${WEEK}`, { token })).body;

    const r = await generate(token, { scope: "week", mode: "mix" });
    assert.equal(r.status, 200);
    const draft: Plan = r.body;
    assert.equal(draft.status, "draft");
    assert.equal(draft.source, "ai");
    assert.equal(fake.calls.filter((c) => c.prompt.startsWith("plan-day")).length, 7, "one call per day");
    assert.deepEqual(draft.days.map((d) => d.status.state), Array(7).fill("on-target"));
    const f = factsOf(fake.last("plan-day")!.messages);
    assert.deepEqual([f.calorieGoal, f.dietType, f.cuisine, f.mode], [1900, "non-veg", "tamil-nadu", "mix"]);

    const discarded = await api("POST", `/meal-plans/${WEEK}/draft/discard`, { token });
    assert.equal(discarded.status, 200);
    assert.equal(discarded.body.status, "active");
    assert.deepEqual(DAYS.map((d) => summary(discarded.body, d)), DAYS.map((d) => summary(before, d)), "the previous plan is back exactly");
    assert.equal(discarded.body.source, before.source);

    const again: Plan = (await generate(token, { scope: "week", mode: "mix" })).body;
    const kept = await api("POST", `/meal-plans/${WEEK}/draft/keep`, { token });
    assert.equal(kept.status, 200);
    assert.equal(kept.body.status, "active");
    assert.deepEqual(DAYS.map((d) => summary(kept.body, d)), DAYS.map((d) => summary(again, d)));
    assert.equal((await api("POST", `/meal-plans/${WEEK}/draft/discard`, { token })).status, 409, "nothing left to discard");
    assert.equal((await api("POST", `/meal-plans/${WEEK}/draft/keep`, { token })).status, 409);
  });

  test("never plans allergens, foods outside the diet or unknown foods, even if the model returns them", async () => {
    const { token } = await onboardedUser();
    await api("PATCH", "/me/profile", { token, body: { dietType: "veg", allergies: ["dairy"] } });
    const curdRice = await foodId(token, /^Curd rice/);
    const chicken = await foodId(token, /^Chicken chettinad/);
    fake.json_["plan-day@v1"] = (m) => ({
      items: [...firstPerMeal(factsOf(m)), { meal: "lunch", foodId: curdRice, quantity: 1 }, { meal: "dinner", foodId: chicken, quantity: 1 }, { meal: "snack", foodId: randomUUID(), quantity: 1 }],
    });

    const draft: Plan = (await generate(token, { scope: "week", mode: "mix" })).body;
    const f = factsOf(fake.last("plan-day")!.messages);
    assert.ok(!f.candidates.some((c) => c.id === curdRice || c.id === chicken), "they aren't offered");
    assert.deepEqual([f.dietType, f.allergies], ["veg", ["dairy"]]);
    assert.ok(draft.items.length > 0);
    assert.ok(draft.items.every((i) => i.food.id !== curdRice && i.food.id !== chicken), "and they aren't planned");
    assert.ok(draft.items.every((i) => i.food.diet === "veg" && i.food.allergyConflicts.length === 0));
    assert.deepEqual(draft.days.map((d) => d.status.state), Array(7).fill("on-target"));
  });

  test("brings each day within the calorie tolerance by adjusting portions, in quarter servings", async () => {
    const { token } = await onboardedUser();
    fake.json_["plan-day@v1"] = (m) => ({ items: firstPerMeal(factsOf(m), 0.25) });
    let draft: Plan = (await generate(token, { scope: "week", mode: "mix" })).body;
    assert.deepEqual(draft.days.map((d) => d.status.state), Array(7).fill("on-target"), "too little is scaled up");
    fake.json_["plan-day@v1"] = (m) => ({ items: firstPerMeal(factsOf(m), 6.1) });
    draft = (await generate(token, { scope: "week", mode: "mix" })).body;
    assert.deepEqual(draft.days.map((d) => d.status.state), Array(7).fill("on-target"), "too much is scaled down");
    assert.ok(draft.items.every((i) => Number.isInteger(i.quantity * 4) && i.quantity >= 0.25));
  });

  test("generates one day, leaving the rest of the week; discarding after a regenerate restores the original", async () => {
    const { token } = await onboardedUser();
    const idli = await foodId(token, /^2 idli with sambar/);
    await api("PUT", `/meal-plans/${WEEK}/days/${DAY(0)}`, { token, body: { items: [{ meal: "breakfast", foodId: idli, quantity: 1 }] } });
    const before: Plan = (await api("GET", `/meal-plans/${WEEK}`, { token })).body;

    let draft: Plan = (await generate(token, { scope: "day", date: DAY(2), mode: "mix" })).body;
    assert.equal(fake.calls.length, 1);
    assert.deepEqual(summary(draft, DAY(0)), summary(before, DAY(0)));
    assert.ok(summary(draft, DAY(2)).length > 0);
    assert.deepEqual(draft.days.filter((d) => d.status.state !== "empty").map((d) => d.date), [DAY(0), DAY(2)]);

    draft = (await generate(token, { scope: "day", date: DAY(3), mode: "mix" })).body;
    assert.equal(draft.status, "draft");
    assert.ok(summary(draft, DAY(2)).length > 0 && summary(draft, DAY(3)).length > 0, "a second generate adds to the same draft");

    const restored: Plan = (await api("POST", `/meal-plans/${WEEK}/draft/discard`, { token })).body;
    assert.deepEqual(DAYS.map((d) => summary(restored, d)), DAYS.map((d) => summary(before, d)));
  });

  test("usual mode offers the user's own foods; mix adds curated dishes", async () => {
    const { token } = await onboardedUser();
    const log = (name: string, meal: string, calories: number) => api("POST", "/food-entries", { token, body: { date: "2026-09-29", meal, name, calories, protein: 10, carbs: 40, fat: 8 } });
    for (const meal of ["breakfast", "lunch", "snack", "dinner"]) {
      await log(`My ${meal} one`, meal, 400);
      await log(`My ${meal} two`, meal, 450);
    }
    await generate(token, { scope: "day", date: DAY(0), mode: "usual" });
    const usual = factsOf(fake.last("plan-day")!.messages).candidates;
    assert.equal(usual.length, 8);
    assert.ok(usual.every((c) => c.yours && c.name.startsWith("My ")));

    await generate(token, { scope: "day", date: DAY(1), mode: "mix" });
    const mix = factsOf(fake.last("plan-day")!.messages).candidates;
    assert.ok(mix.some((c) => c.yours) && mix.some((c) => !c.yours));
  });

  test("usual mode tops up a meal with curated dishes when the user has too few of their own", async () => {
    const { token } = await onboardedUser();
    await generate(token, { scope: "day", date: DAY(0), mode: "usual" });
    const c = factsOf(fake.last("plan-day")!.messages).candidates;
    assert.ok(["breakfast", "lunch", "snack", "dinner"].every((meal) => c.some((x) => x.meal === meal)));
  });

  test("streams each day as it is ready, then the finished draft", async () => {
    const { token } = await onboardedUser();
    const r = await generate(token, { scope: "week", mode: "mix" }, { accept: "text/event-stream" });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type")!, /^text\/event-stream/);
    const events = (r.body as string)
      .trim()
      .split("\n\n")
      .map((block) => {
        const [e, d] = block.split("\n");
        return { event: e.replace("event: ", ""), data: JSON.parse(d.replace("data: ", "")) };
      });
    assert.deepEqual(events.map((e) => e.event), [...Array(7).fill("day"), "done"]);
    assert.deepEqual(events.slice(0, 7).map((e) => e.data.date), DAYS);
    assert.equal(events[2].data.plan.days.filter((d: { status: { state: string } }) => d.status.state !== "empty").length, 3, "each day event carries the plan so far");
    assert.equal(events[7].data.status, "draft");
  });

  test("builds a plan by rules, from the user's usual foods, when the AI is unavailable", async () => {
    setLlm(new DisabledLlm());
    const { token } = await onboardedUser();
    await api("PATCH", "/me/profile", { token, body: { allergies: ["dairy"] } });
    await api("POST", "/food-entries", { token, body: { date: "2026-09-29", meal: "breakfast", name: "Ragi dosa", calories: 250, protein: 6, carbs: 45, fat: 5 } });
    const r = await generate(token, { scope: "week", mode: "usual" });
    assert.equal(r.status, 200);
    const draft: Plan = r.body;
    assert.deepEqual([draft.status, draft.source], ["draft", "rules"]);
    assert.deepEqual(draft.days.map((d) => d.status.state), Array(7).fill("on-target"));
    assert.ok(draft.items.some((i) => i.food.name === "Ragi dosa"), "the user's own foods come first");
    assert.ok(draft.items.every((i) => i.food.allergyConflicts.length === 0));
    assert.ok(["breakfast", "lunch", "dinner"].every((meal) => draft.items.filter((i) => i.date === DAY(0) && i.meal === meal).length > 0));
  });

  test("falls back to rules for the rest of the week if the AI fails part-way", async () => {
    const { token } = await onboardedUser();
    const { AiUnavailable } = await import("../src/ai/llm.js");
    let n = 0;
    fake.json_["plan-day@v1"] = (m) => {
      if (++n > 2) throw new AiUnavailable("down");
      return { items: firstPerMeal(factsOf(m)) };
    };
    const draft: Plan = (await generate(token, { scope: "week", mode: "mix" })).body;
    assert.equal(draft.source, "rules", "labelled rules, since some days were built without the AI");
    assert.deepEqual(draft.days.map((d) => d.status.state), Array(7).fill("on-target"));
    assert.equal(fake.calls.length, 3, "no more AI calls once it has failed");
  });

  test("asks once more for a day the model gets unusably wrong, then builds it by rules", async () => {
    const { token } = await onboardedUser();
    fake.json_["plan-day@v1"] = () => ({ items: [{ meal: "lunch", foodId: randomUUID(), quantity: 1 }] });
    const draft: Plan = (await generate(token, { scope: "day", date: DAY(0), mode: "mix" })).body;
    assert.equal(fake.calls.length, 2);
    assert.equal(draft.source, "rules");
    assert.equal(draft.days[0].status.state, "on-target");
  });

  test("validates the request", async () => {
    const { token } = await onboardedUser();
    const pointers = async (body: object) => (await generate(token, body)).body.errors?.map((e: { pointer: string }) => e.pointer);
    assert.deepEqual(await pointers({ scope: "day", mode: "mix" }), ["/date"]);
    assert.deepEqual(await pointers({ scope: "day", date: "2026-10-20", mode: "mix" }), ["/date"]);
    assert.deepEqual(await pointers({ scope: "month", mode: "wild" }), ["/scope", "/mode"]);
  });
});

const DAYS = Array.from({ length: 7 }, (_, i) => DAY(i));
