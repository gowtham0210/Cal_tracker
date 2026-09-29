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
| Base path `/api/v1` | Auth uses `/api/v1`; weights are still on `/api` | Move the remaining routes under `/api/v1` |
| Bearer token from `/auth/register` and `/auth/login` | `/auth/register` is done and issues tokens; weights still use the temporary `X-User-Id` header | `/auth/login`, and middleware that checks the bearer token |
| `PUT /weight-entries/{date}` | `POST /api/weights` | Change the route to use the date as the key |
| `Profile.timeZone` | No column | New migration |
| Coach chat history | No table | New `coach_messages` migration |
| Errors as `application/problem+json` | Done for auth and unknown routes; weights still return `{ "error": ... }` | Use the shared error handler in the weights routes |
| Timestamps as RFC 3339 strings | Done for auth | Convert in the other routes too |
