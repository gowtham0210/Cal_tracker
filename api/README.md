# Lighter API contract

[`openapi.yaml`](openapi.yaml) describes the HTTP API between `frontend/` and `backend/` using **OpenAPI 3.2**. It is written design-first: the spec is the source of truth, and the backend is built and tested against it.

## Validate and preview

```bash
npx @redocly/cli lint api/openapi.yaml
npx @redocly/cli preview -d api
```

The file is valid against the official OpenAPI 3.2 JSON Schemas. Redocly's `recommended-strict` rules report only two findings, both intentional for now: no `license` is set, and the only server is localhost.

## How the backend is held to it

- Every response in the backend tests is checked against this file: the status must be documented for that operation, and the body must match its schema. An undocumented status fails the test.
- All 42 operations are exercised, and a sweep checks that every secured operation rejects requests without a token.
- When the implementation needs a new response (for example `429` on login), the spec is updated first.
