import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { parse } from "yaml";

const { api, newUser, onboardedUser } = await import("./helpers.js");

const spec = parse(readFileSync(new URL("../../api/openapi.yaml", import.meta.url), "utf8"));
const sample: Record<string, string> = {
  foodEntryId: "0390357f-60db-4363-aae2-7b7fafd0d1e8",
  favoriteFoodId: "0390357f-60db-4363-aae2-7b7fafd0d1e8",
  exerciseEntryId: "0390357f-60db-4363-aae2-7b7fafd0d1e8",
  date: "2026-09-29",
  kind: "food",
};
const operations = Object.entries(spec.paths).flatMap(([path, item]: [string, any]) =>
  Object.entries(item)
    .filter(([, op]: [string, any]) => op?.operationId)
    .map(([method, op]: [string, any]) => ({ method: method.toUpperCase(), path, op, url: path.replace(/\{(\w+)\}/g, (_, k) => sample[k]) })),
);

describe("every secured operation", () => {
  for (const { method, path, op, url } of operations) {
    const secured = !(Array.isArray(op.security) && op.security.length === 0);
    if (!secured) continue;
    test(`${method} ${path} needs a bearer token`, async () => {
      const r = await api(method, url, method === "GET" || method === "DELETE" ? {} : { body: {} });
      assert.equal(r.status, 401);
    });
  }
});

describe("remaining documented errors", () => {
  test("list endpoints reject a bad cursor or range", async () => {
    const { token } = await newUser();
    for (const path of ["/weight-entries", "/measurement-entries", "/exercise-entries", "/water-entries", "/journal-entries"]) {
      assert.equal((await api("GET", `${path}?cursor=nope`, { token })).status, 400, path);
      assert.equal((await api("GET", `${path}?from=2026-09-02&to=2026-09-01`, { token })).status, 400, path);
    }
  });

  test("features that need a profile say so", async () => {
    const { token } = await newUser();
    for (const path of ["/insights/badges", "/coach/weekly-summary", "/coach/meal-suggestions"]) {
      const r = await api("GET", path, { token });
      assert.equal(r.status, 404, path);
      assert.equal(r.body.type, "https://lighter.app/problems/profile-required");
    }
  });

  test("validation and not-found on the smaller resources", async () => {
    const { token } = await onboardedUser();
    assert.equal((await api("POST", "/favorite-foods", { token, body: { name: "" } })).status, 400);
    assert.equal((await api("DELETE", `/favorite-foods/${sample.favoriteFoodId}`, { token })).status, 404);
    assert.equal((await api("DELETE", "/measurement-entries/2026-01-01", { token })).status, 404);
    assert.equal((await api("PATCH", "/me/profile", { token, body: { heightCm: -1 } })).status, 400);
    assert.equal((await api("POST", "/coach/messages", { token, body: { text: "" } })).status, 400);
  });

  test("registration is rate limited per IP", async () => {
    let last = 0;
    for (let i = 0; i < 21; i++) {
      last = (await api("POST", "/auth/register", { body: { email: `burst${i}@example.test`, name: "B", password: "correct horse battery" } })).status;
    }
    assert.equal(last, 429);
  });
});
