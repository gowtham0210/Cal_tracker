# Lighter — Weight Loss Tracker

| Folder | What it is |
| --- | --- |
| [`frontend/`](frontend) | Next.js app (see [frontend/README.md](frontend/README.md)) |
| [`backend/`](backend) | Express + SQLite API (see [backend/README.md](backend/README.md)) |
| [`api/`](api) | OpenAPI 3.2 contract between the two (see [api/README.md](api/README.md)) |

## Run locally

Frontend on http://localhost:3000:

```bash
cd frontend
npm install
npm run dev
```

Backend on http://localhost:4000:

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Set `JWT_SECRET` in `backend/.env` first, and optionally the `AZURE_OPENAI_*` variables for the AI coach (see [backend/README.md](backend/README.md)). The frontend talks to `http://localhost:4000/api/v1` by default; set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` to change it.

Open http://localhost:3000, create an account, and either set your goals or explore with demo data.
