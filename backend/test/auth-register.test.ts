import assert from "node:assert/strict";
import { describe, test } from "node:test";

const { api, db } = await import("./helpers.js");
const { verifyAccessToken } = await import("../src/auth/tokens.js");
const { verifyPassword } = await import("../src/auth/password.js");

async function register(body: unknown, raw = false) {
  const r = await api("POST", "/auth/register", raw ? { raw: body as string } : { body });
  return { res: { status: r.status, headers: r.headers }, body: r.body };
}

const valid = { email: "  Gowtham@Example.COM ", name: "  Gowtham ", password: "correct horse battery" };

describe("POST /auth/register", () => {
  test("creates the account and returns a session", async () => {
    const { res, body } = await register(valid);

    assert.equal(res.status, 201);
    assert.match(res.headers.get("content-type")!, /^application\/json/);
    assert.equal(res.headers.get("cache-control"), "no-store");

    assert.equal(body.tokenType, "Bearer");
    assert.equal(body.expiresIn, 3600);
    assert.equal(body.user.email, "gowtham@example.com", "email is trimmed and lowercased");
    assert.equal(body.user.name, "Gowtham", "name is trimmed");
    assert.equal(body.password, undefined);
    assert.equal(body.user.password, undefined);
    assert.equal(await verifyAccessToken(body.accessToken), body.user.id);
  });

  test("stores an Argon2id hash, never the password", async () => {
    const row = db
      .prepare("SELECT c.password_hash AS hash FROM user_credentials c JOIN users u ON u.id = c.user_id WHERE u.email = ?")
      .get("gowtham@example.com") as { hash: string };

    assert.match(row.hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    assert.ok(!row.hash.includes(valid.password));
    assert.equal(await verifyPassword(valid.password, row.hash), true);
    assert.equal(await verifyPassword("wrong password", row.hash), false);
  });

  test("rejects an email that is already registered, ignoring case", async () => {
    const before = db.prepare("SELECT count(*) AS n FROM users").get() as { n: number };
    const { res, body } = await register({ ...valid, email: "GOWTHAM@example.com" });

    assert.equal(res.status, 409);
    assert.match(res.headers.get("content-type")!, /^application\/problem\+json/);
    assert.equal(body.type, "https://lighter.app/problems/email-taken");
    assert.deepEqual(body.errors, [{ pointer: "/email", detail: "An account with this email already exists." }]);
    assert.deepEqual(db.prepare("SELECT count(*) AS n FROM users").get(), before, "no user was created");
  });

  test("reports every missing field", async () => {
    const { res, body } = await register({});

    assert.equal(res.status, 400);
    assert.equal(body.type, "https://lighter.app/problems/validation-failed");
    assert.deepEqual(body.errors.map((e: { pointer: string }) => e.pointer).sort(), ["/email", "/name", "/password"]);
  });

  const invalid: [string, Record<string, unknown>, string][] = [
    ["an invalid email", { ...valid, email: "not-an-email" }, "/email"],
    ["an email over 254 characters", { ...valid, email: `${"a".repeat(250)}@x.io` }, "/email"],
    ["a blank name", { ...valid, name: "   " }, "/name"],
    ["a name over 80 characters", { ...valid, name: "n".repeat(81) }, "/name"],
    ["a password under 8 characters", { ...valid, password: "short" }, "/password"],
    ["a password over 128 characters", { ...valid, password: "p".repeat(129) }, "/password"],
    ["a non-string password", { ...valid, password: 12345678 }, "/password"],
    ["an unknown field", { ...valid, role: "admin" }, ""],
  ];
  for (const [label, input, pointer] of invalid) {
    test(`rejects ${label}`, async () => {
      const { res, body } = await register(input);
      assert.equal(res.status, 400);
        assert.deepEqual(
        body.errors.map((e: { pointer: string }) => e.pointer),
        [pointer],
      );
    });
  }

  test("rejects a body that is not a JSON object", async () => {
    const { res, body } = await register([valid]);
    assert.equal(res.status, 400);
  });

  test("rejects malformed JSON", async () => {
    const { res, body } = await register("{ not json", true);
    assert.equal(res.status, 400);
    assert.match(res.headers.get("content-type")!, /^application\/problem\+json/);
    assert.equal(body.type, "https://lighter.app/problems/malformed-json");
  });
});
