# Lighter API contract

[`openapi.yaml`](openapi.yaml) describes the HTTP API between `frontend/` and `backend/` using **OpenAPI 3.2**. It is written design-first: the spec is the source of truth, and the backend is built to match it.

## Validate and preview

```bash
npx @redocly/cli lint api/openapi.yaml
npx @redocly/cli preview -d api
```

The file is valid against the official OpenAPI 3.2 JSON Schemas. Redocly's `recommended-strict` rules report only two findings, both intentional for now: no `license` is set, and the only server is localhost.

## Where the backend differs today

| Spec | Backend now | Needs |
| --- | --- | --- |
| Base path `/api/v1` | `/api` | Mount routes under `/api/v1` |
| Bearer token from `/auth/register` and `/auth/login` | Temporary `X-User-Id` header | Password hashing, token issuing, a `password_hash` column |
| `PUT /weight-entries/{date}` | `POST /api/weights` | Change the route to use the date as the key |
| `Profile.timeZone` | No column | New migration |
| Coach chat history | No table | New `coach_messages` migration |
| Errors as `application/problem+json` | `{ "error": ... }` | Shared error handler |
| Timestamps as RFC 3339 strings | Epoch ms in the database | Convert when building responses |
