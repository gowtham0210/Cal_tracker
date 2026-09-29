# Lighter — Backend

Node.js API built with **Express 5**, **TypeScript**, **SQLite** (via `better-sqlite3`), **Zod** for input validation and **jose** for access tokens. The HTTP contract is [`api/openapi.yaml`](../api/openapi.yaml).

SQLite keeps the whole database in one file (`data/lighter.db` by default). There is no database server to install.

## Database

- **Migrations:** files in `src/db/migrations/NNN_name.sql` run in order on startup. `PRAGMA user_version` records the last one applied. Never edit a migration that has already run; add a new numbered file instead.
- **Rules the schema follows:**
  - It is in 3NF, and every row belongs to a user.
  - Tables are `STRICT`, so SQLite rejects values of the wrong type.
  - Foreign keys delete a user's rows along with the user.
  - Dates are checked to be real `YYYY-MM-DD` dates, and numbers are range-checked.
  - Weight, measurements, journal and water allow one entry per user per day.
  - `created_at` and `updated_at` (epoch ms) are on every table, and triggers keep `updated_at` current.
- **Start weight** is not stored. It is the user's weight entry on `profiles.start_date`.
- **Resetting locally:** delete `data/` and restart.

## Run

```bash
cp .env.example .env
npm install
npm run dev
```

Set `JWT_SECRET` in `.env` before starting (the server refuses to start without it). Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The API runs on http://localhost:4000.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Starts the server and restarts it on file changes (tsx) |
| `npm run build` | Compiles to `dist/` |
| `npm start` | Runs the compiled build |
| `npm run typecheck` | Type-checks without emitting files |
| `npm test` | Runs the tests, which also check every response against `api/openapi.yaml` |

## Endpoints

| Method | Path | |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| POST | `/api/v1/auth/register` | Create an account `{ email, name, password }`; returns a session with a bearer token |
| GET | `/api/weights` | List the user's weight entries (old route, see below) |
| POST | `/api/weights` | Log `{ date: "YYYY-MM-DD", weight: kg }` (replaces that day's entry) |
| DELETE | `/api/weights/:id` | Delete an entry |

Errors are `application/problem+json` (RFC 9457). Validation errors list each bad field as a JSON Pointer.

**Passwords** are hashed with Argon2id (Node's built-in `crypto.argon2`, OWASP minimum settings) and stored in `user_credentials`, never in plain text. **Access tokens** are HS256 JWTs signed with `JWT_SECRET` and last `ACCESS_TOKEN_TTL` seconds (7 days by default); there are no refresh tokens yet.

> **Temporary auth on `/api/weights`:** these old routes still read the user id from the `X-User-Id` header. Anyone who knows an id can act as that user, so replace this with the bearer token before deploying.

## Layout

```
src/
├── index.ts        Starts the server
├── app.ts          Express app + route mounting
├── auth/           Password hashing and access tokens
├── http/           RFC 9457 error responses
├── config.ts       Env-based config
├── db/
│   ├── index.ts    SQLite connection
│   ├── migrate.ts  Migration runner
│   └── migrations/ Numbered .sql files (schema mirrors frontend/src/lib/types.ts)
├── middleware/     Request helpers (current user)
└── routes/         One router per resource
test/               node:test suites + OpenAPI contract checks
```
