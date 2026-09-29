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
