import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { z } from "zod";
import { AzureLlm } from "../src/ai/llm.js";

// Exercises the real Azure client against a fake HTTP server, to check the wire format.
function fakeAzure(responses: (object | number | { status: number; body: object })[], apiVersion = "2024-10-21") {
  const requests: { url: string; headers: Headers; body: any }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    requests.push({ url: String(url), headers: new Headers(init.headers), body: JSON.parse(String(init.body)) });
    const next = responses.shift()!;
    if (typeof next === "number") return new Response(JSON.stringify({ error: { message: "nope" } }), { status: next, headers: { "content-type": "application/json" } });
    if ("status" in next && "body" in next) return new Response(JSON.stringify(next.body), { status: next.status as number, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify(next), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  const llm = new AzureLlm(
    { endpoint: "https://example-resource.openai.azure.com/", apiKey: "test-key", deployment: "gpt-4o-mini", apiVersion },
    { fetch: fetchImpl, maxRetries: 0 },
  );
  return { llm, requests };
}

const completion = (content: string, finish = "stop") => ({
  id: "x",
  object: "chat.completion",
  created: 0,
  model: "gpt-4o-mini",
  choices: [{ index: 0, finish_reason: finish, message: { role: "assistant", content } }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
});

const schema = z.object({ n: z.number().max(10) });
const req = { messages: [{ role: "user" as const, content: "hi" }], name: "t", jsonSchema: { type: "object" }, schema, maxTokens: 50 };

describe("AzureLlm", () => {
  test("calls the deployment with the API version, key and a strict JSON schema", async () => {
    const { llm, requests } = fakeAzure([completion('{"n":3}')]);
    assert.deepEqual(await llm.json(req, { prompt: "t@v1" }), { n: 3 });
    const r = requests[0];
    assert.equal(r.url, "https://example-resource.openai.azure.com/openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-10-21");
    assert.equal(r.headers.get("api-key"), "test-key");
    assert.deepEqual(r.body.response_format, { type: "json_schema", json_schema: { name: "t", strict: true, schema: { type: "object" } } });
    assert.equal(r.body.max_completion_tokens, 50);
    assert.equal(r.body.temperature, undefined, "no temperature, so reasoning models work too");
  });

  test("with apiVersion v1, calls /openai/v1 with the deployment as the model", async () => {
    const { llm, requests } = fakeAzure([completion('{"n":3}')], "v1");
    assert.deepEqual(await llm.json(req, { prompt: "t@v1" }), { n: 3 });
    const r = requests[0];
    assert.equal(r.url, "https://example-resource.openai.azure.com/openai/v1/chat/completions");
    assert.equal(r.body.model, "gpt-4o-mini");
    assert.equal(r.headers.get("api-key"), "test-key");
  });

  test("retries once when the output fails validation, then gives up with a 503", async () => {
    const a = fakeAzure([completion('{"n":99}'), completion('{"n":4}')]);
    assert.deepEqual(await a.llm.json(req, { prompt: "t@v1" }), { n: 4 });
    const b = fakeAzure([completion("not json"), completion('{"n":99}')]);
    await assert.rejects(b.llm.json(req, { prompt: "t@v1" }), (e: any) => e.status === 503);
  });

  test("maps a content filter stop to 400 and provider errors to 503", async () => {
    await assert.rejects(fakeAzure([completion("", "content_filter")]).llm.json(req, { prompt: "t@v1" }), (e: any) => e.status === 400 && e.slug === "content-filtered");
    await assert.rejects(fakeAzure([429]).llm.json(req, { prompt: "t@v1" }), (e: any) => e.status === 503);
    // Azure's prompt shield rejects the request before generating anything.
    const shield = { status: 400, body: { error: { code: "content_filter", message: "The response was filtered due to the prompt triggering Azure OpenAI's content management policy.", innererror: { code: "ResponsibleAIPolicyViolation" } } } };
    await assert.rejects(fakeAzure([shield]).llm.json(req, { prompt: "t@v1" }), (e: any) => e.status === 400 && e.slug === "content-filtered");
    await assert.rejects(fakeAzure([500]).llm.json(req, { prompt: "t@v1" }), (e: any) => e.status === 503);
  });
});
