# Lighter — Weight Loss Tracker

The web app for Lighter, built with **Next.js 16 (App Router)**, **Tailwind CSS v4**, **Recharts** and **Zustand**.
It talks to the Lighter API in [`../backend`](../backend) (contract: [`../api/openapi.yaml`](../api/openapi.yaml)). Everything is saved to the user's account; the AI features run on the backend with Azure OpenAI.

## Getting started

Start the backend first (see [`../backend/README.md`](../backend/README.md)), then:

```bash
npm install
npm run dev     # http://localhost:3000
npm run build && npm start
```

The API URL defaults to `http://localhost:4000/api/v1`; set `NEXT_PUBLIC_API_URL` in `.env.local` to change it (see `.env.example`). It is inlined at build time.

Create an account, then set your goals or choose **Explore with demo data**. Later you can reload the sample journey from **Settings → Reload demo data**, or empty your logs with **Start fresh**. If this browser has data from before accounts existed, onboarding offers to import it.

## Features

| # | Feature | Where |
|---|---------|-------|
| 1 | Food log with manual entry and favorites (star any item, one-tap re-log) | Food page, Quick add → Food |
| 2 | Daily calorie goal: remaining vs consumed ring | Today, Food |
| 3 | Optional macros (protein / carbs / fat), can be turned off | Settings → Macros |
| 4 | Weight log with a smoothed trend chart | Body |
| 5 | Auto BMI from height + latest weigh-in, with a category scale | Body, Today |
| 6 | Water tracker: tap glasses toward a daily goal | Today, Quick add |
| 7 | Body measurements: waist, hips, chest with mini charts | Body |
| 8 | Exercise log; calories burned are added back to net calories | Exercise, Today |
| 9 | Notes & mood: mood, energy, sleep, cravings, autosaved notes | Journal, Today |
| 10 | Dashboard with today's snapshot and a streak counter | Today |
| 11 | Weekly / monthly / 3-month charts and a consistency heatmap | Progress |
| 12 | Start and goal weight, % complete, milestones and badges | Goals |
| 13 | AI natural-language food logging ("2 eggs, toast and a coffee") | Food sheet → Describe |
| 14 | AI photo meal logging with an editable estimate | Food sheet → Photo |
| 15 | Smart meal suggestions that fit your remaining calories and protein | Today, Food |
| 16 | Chat with your data | AI Coach |
| 17 | Weekly AI coach summary with one tip | AI Coach |
| 18 | CSV export (daily summary or per data type) | Settings → Export |
| 19 | Accounts: sign up, sign in, sign out, delete account | /register, /login, Settings |

## UX notes

- **Mobile first.** Bottom navigation with a central Quick add button; a sidebar on desktop. Dialogs open as bottom sheets on phones and centred modals on desktop.
- **Fast logging.** Every log action is at most 2 taps from any screen. The current meal is picked automatically from the time of day.
- **Instant, but saved.** Changes show immediately and are saved to the API in the background; if a save fails, the change is undone and an error toast explains why.
- **Forgiving.** Deletes can be undone from the toast. AI results are always shown for review before saving. Inputs are validated inline.
- **Accessible.** Semantic landmarks, a skip link, labelled controls, focus-trapped dialogs (Esc to close), visible focus rings, `aria-live` toasts and support for reduced motion.
- **Light and dark themes.** Follows the system setting by default, with an override in Settings. The saved theme is applied before first paint, so there's no flash.
- Metric and imperial units.

## Project structure

```
src/
  app/
    (app)/        signed-in pages, wrapped in the app shell and auth gate
    (auth)/       login, register and onboarding
  views/          page-level client components
  components/     UI primitives, charts, widgets, dialogs, app shell
  lib/
    api.ts        typed client for every API operation
    session.ts    saved access token
    store.ts      Zustand store: loads from the API, saves optimistically
    ai.ts         AI features (backend calls; photos resized before upload)
    calc.ts       BMI, streaks, trends, badges, unit conversion
    import-local.ts  one-time import of pre-account browser data
```
