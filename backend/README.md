# Lighter — Backend

Node.js API built with **Express 5**, **TypeScript**, **SQLite** (via `better-sqlite3`) and **Zod** for input validation.

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

The API runs on http://localhost:4000.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Starts the server and restarts it on file changes (tsx) |
| `npm run build` | Compiles to `dist/` |
| `npm start` | Runs the compiled build |
| `npm run typecheck` | Type-checks without emitting files |

## Endpoints

> **Temporary auth:** until login is built, routes that need a user read their id from the `X-User-Id` header. Anyone who knows an id can act as that user, so replace this before deploying.

| Method | Path | |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| POST | `/api/users` | Create a user `{ email, name }` |
| GET | `/api/weights` | List the user's weight entries |
| POST | `/api/weights` | Log `{ date: "YYYY-MM-DD", weight: kg }` (replaces that day's entry) |
| DELETE | `/api/weights/:id` | Delete an entry |

## Layout

```
src/
├── index.ts        Express app + route mounting
├── config.ts       Env-based config
├── db/
│   ├── index.ts    SQLite connection
│   ├── migrate.ts  Migration runner
│   └── migrations/ Numbered .sql files (schema mirrors frontend/src/lib/types.ts)
├── middleware/     Request helpers (current user)
└── routes/         One router per resource
```
