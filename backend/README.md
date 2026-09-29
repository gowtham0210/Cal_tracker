# Lighter — Backend

Node.js API for Lighter: **Express 5**, **TypeScript**, **SQLite** (`better-sqlite3`), **Zod** validation, **jose** access tokens and **Azure OpenAI** for the AI coach.
It implements every operation in [`api/openapi.yaml`](../api/openapi.yaml), and the tests check each response against that file.

## Run

```bash
cp .env.example .env
npm install
npm run dev
```

The API runs on http://localhost:4000/api/v1. Set `JWT_SECRET` in `.env` first (the server refuses to start without it):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Configuration

| Variable | Default | |
| --- | --- | --- |
| `PORT` | `4000` | |
| `DB_PATH` | `./data/lighter.db` | SQLite file; delete `data/` to reset locally |
| `CORS_ORIGIN` | `http://localhost:3000` | The frontend's origin |
| `JWT_SECRET` | — | Required, at least 32 characters |
| `ACCESS_TOKEN_TTL` | `604800` | Seconds (7 days); there are no refresh tokens yet |
| `AZURE_OPENAI_ENDPOINT` | — | e.g. `https://<resource>.openai.azure.com` |
| `AZURE_OPENAI_API_KEY` | — | |
| `AZURE_OPENAI_DEPLOYMENT` | — | Deployment name; use a vision model (e.g. gpt-4o, gpt-4.1) for photo estimates |
| `AZURE_OPENAI_API_VERSION` | — | e.g. `2024-10-21`; `AZURE_OPENAI__API_VERSION` is also accepted |

Without the Azure variables the API still runs: food estimates and chat return `503`, while the weekly summary and meal ideas fall back to rule-based answers.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Starts the server and restarts it on file changes |
| `npm run build` / `npm start` | Compiles to `dist/` and runs it |
| `npm test` | 126 tests; every response is checked against the OpenAPI spec |
| `npm run typecheck` | Type-checks source, tests and evals |
| `npm run eval` | Quality evals against your real Azure deployment (costs a few cents) |

## How it works

- **Auth.** Passwords are hashed with Argon2id (Node's built-in `crypto.argon2`, OWASP settings) in `user_credentials`. Access tokens are HS256 JWTs. Login takes the same time for unknown emails and gives one error for both mistakes. Register and login are rate limited per IP and per email.
- **Errors** are `application/problem+json` (RFC 9457); validation errors point at each field with a JSON Pointer.
- **Database.** Numbered migrations in `src/db/migrations/` run on startup (`PRAGMA user_version` tracks them). Tables are `STRICT`, per user, with foreign keys, range checks and `updated_at` triggers. Never edit a migration that has run; add a new file.
- **Lists** use keyset pagination (`limit` + opaque `cursor`), so pages don't shift while data changes.
- **Days** are calendar dates in the user's `timeZone`; "today" is worked out on the server.

## AI engineering

All model calls go through one interface (`src/ai/llm.ts`), so the provider can change and tests can use a fake.

- **The model never does maths.** The server computes every number (`src/ai/facts.ts`, `src/lib/stats.ts`) and gives the model facts already rounded and in the user's units. Prompts tell it to quote them.
- **Structured output.** Food estimates, the weekly summary and meal ideas use strict `json_schema`. The server validates the result again with Zod and retries once if it fails.
- **Deterministic guardrails after the model.** Estimates whose calories disagree with their macros are marked low confidence; meal ideas over the remaining budget or for the wrong meal are dropped.
- **Untrusted input.** User text is wrapped in `<user_input>` tags (with the closing tag stripped from inside) and treated as data. The system prompt keeps the coach on nutrition and exercise, rules out medical advice and crash diets.
- **Versioned prompts** live in `src/ai/prompts/`. Each call logs its prompt version, latency, token counts and outcome, never the content.
- **Resilience.** Timeouts, SDK retries on 429/5xx, content-filter handling, a per-user limit of 40 AI calls per 10 minutes, and caching of identical weekly summaries and meal ideas.
- **Degrade honestly.** Where a rule-based answer is still correct (weekly summary, meal ideas) it is used when the model fails; otherwise the API returns `503`.
- **Minimal data.** Only the numbers a feature needs are sent to Azure; never the name, email or password. Photos are resized in the browser before upload.
- **Evals.** `npm run eval` checks calorie ranges for common foods, prompt-injection resistance, grounded answers, off-topic refusals and crash-diet refusals against the real deployment.

## Layout

```
src/
├── index.ts, app.ts   Server and route mounting
├── config.ts          Env-based config
├── ai/                Model client, facts, prompts, safety rules
├── auth/              Password hashing and access tokens
├── db/                SQLite connection, migrations, named-parameter helper
├── http/              Problem errors, validation, pagination, rate limits
├── lib/               Dates, stats, demo data, caches
├── middleware/        Bearer-token auth
└── routes/            One router per resource
test/                  node:test suites, OpenAPI contract checks, fake model
evals/                 AI quality evals
```
