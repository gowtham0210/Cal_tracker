import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";

export const API = "http://localhost:4100/api/v1";

export const PROFILE = {
  heightCm: 175,
  startWeight: 92.4,
  goalWeight: 78,
  startDate: "2026-06-01",
  calorieGoal: 1900,
  macroGoals: { protein: 130, carbs: 190, fat: 65 },
  trackMacros: true,
  waterGoal: 8,
  glassMl: 250,
  units: "metric",
  theme: "light",
  timeZone: "Asia/Kolkata",
  cuisine: "tamil-nadu",
};

export interface TestUser {
  token: string;
  user: { id: string; email: string; name: string; createdAt: string };
  password: string;
}

let n = 0;
/** Registers a user through the API, optionally with a profile. */
export async function createUser(request: APIRequestContext, opts: { profile?: boolean; name?: string } = {}): Promise<TestUser> {
  const password = "correct horse battery";
  const email = `e2e-${Date.now()}-${process.pid}-${++n}@example.test`;
  const res = await request.post(`${API}/auth/register`, { data: { email, name: opts.name ?? "Asha Test", password } });
  expect(res.status()).toBe(201);
  const session = await res.json();
  if (opts.profile !== false) {
    const p = await request.put(`${API}/me/profile`, { data: PROFILE, headers: { authorization: `Bearer ${session.accessToken}` } });
    expect(p.status()).toBe(201);
  }
  return { token: session.accessToken, user: session.user, password };
}

/** Authenticated API calls for arranging test data. */
export const authed = (request: APIRequestContext, token: string) => {
  const headers = { authorization: `Bearer ${token}` };
  return {
    get: (path: string) => request.get(`${API}${path}`, { headers }),
    post: (path: string, data?: unknown) => request.post(`${API}${path}`, { headers, data }),
    put: (path: string, data?: unknown) => request.put(`${API}${path}`, { headers, data }),
    patch: (path: string, data?: unknown) => request.patch(`${API}${path}`, { headers: { ...headers, "content-type": "application/merge-patch+json" }, data: JSON.stringify(data) }),
    delete: (path: string) => request.delete(`${API}${path}`, { headers }),
  };
};

/** Puts the user's session in local storage before the app loads, so tests start signed in. */
export async function signIn(page: Page, u: TestUser) {
  await page.addInitScript((s) => {
    localStorage.setItem("cal-tracker-session", JSON.stringify({ state: s, version: 0 }));
  }, { accessToken: u.token, expiresAt: Date.now() + 3_600_000, user: u.user });
}

/** Fails on serious or critical accessibility violations (WCAG 2.2 A/AA). */
export async function expectAccessible(page: Page, opts: { include?: string } = {}) {
  // Measure the settled page: entrance animations fade text in, which skews contrast readings.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]);
  if (opts.include) builder = builder.include(opts.include);
  const { violations } = await builder.analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.map((x) => x.target.join(" ")).slice(0, 3).join(", ")})`)).toEqual([]);
}

/** Monday of the week containing a local date, as YYYY-MM-DD. */
export function mondayOf(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export const test = base;
export { expect };
