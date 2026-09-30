import type { AddressInfo } from "node:net";
import { after } from "node:test";

// Each test file runs in its own process, so every file gets a fresh in-memory database.
process.env.DB_PATH = ":memory:";
process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-characters-long";
process.env.ACCESS_TOKEN_TTL ??= "3600";

const { createApp } = await import("../src/app.js");
const { assertMatchesSpec } = await import("./contract.js");
export const { db } = await import("../src/db/index.js");

const server = createApp().listen(0);
after(() => server.close());
const base = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;

export interface ApiResponse<T = any> {
  status: number;
  headers: Headers;
  body: T;
}

/** Calls the API and asserts the response matches api/openapi.yaml. */
export async function api<T = any>(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; raw?: string; contentType?: string; headers?: Record<string, string>; skipContract?: boolean } = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  let payload: BodyInit | undefined;
  if (opts.raw !== undefined) payload = opts.raw;
  else if (opts.body !== undefined) payload = JSON.stringify(opts.body);
  if (payload !== undefined) headers["content-type"] = opts.contentType ?? (method === "PATCH" ? "application/merge-patch+json" : "application/json");

  const res = await fetch(base() + path, { method, headers, body: payload });
  const type = res.headers.get("content-type");
  const text = await res.text();
  const body = type?.includes("json") && text ? JSON.parse(text) : text || undefined;
  if (!opts.skipContract) assertMatchesSpec(method, path.split("?")[0], res.status, type, body);
  return { status: res.status, headers: res.headers, body };
}

/** Fetches a binary download (e.g. a PDF), checking its status and media type against the spec. */
export async function download(path: string, token: string) {
  const res = await fetch(base() + path, { headers: { authorization: `Bearer ${token}` } });
  const type = res.headers.get("content-type");
  const bytes = Buffer.from(await res.arrayBuffer());
  const json = type?.includes("json") ? JSON.parse(bytes.toString("utf8")) : undefined;
  // Binary bodies are strings in the spec; the caller checks the bytes themselves.
  assertMatchesSpec("GET", path.split("?")[0], res.status, type, json ?? bytes.toString("latin1"));
  return { status: res.status, headers: res.headers, bytes, json };
}

/** The text of each page of a PDF, and whether it's landscape. */
export async function pdfPages(bytes: Buffer) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise;
  const pages: { text: string; landscape: boolean }[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const [, , w, h] = page.view;
    const content = await page.getTextContent();
    pages.push({ text: content.items.map((x) => ("str" in x ? x.str : "")).join(" ").replace(/\s+/g, " "), landscape: w > h });
  }
  return pages;
}

let n = 0;
/** Registers a fresh user and returns their token. */
export async function newUser(name = "Test User") {
  const email = `user${++n}-${Date.now()}@example.test`;
  const res = await api("POST", "/auth/register", { body: { email, name, password: "correct horse battery" } });
  return { token: res.body.accessToken as string, user: res.body.user, email, password: "correct horse battery" };
}

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
  theme: "system",
  timeZone: "Asia/Kolkata",
  cuisine: "tamil-nadu",
};

/** A user who has finished onboarding. */
export async function onboardedUser() {
  const u = await newUser();
  await api("PUT", "/me/profile", { token: u.token, body: PROFILE });
  return u;
}

/** A library food id by name (the library is synced on read). */
export async function foodId(token: string, name: RegExp) {
  const foods: { id: string; name: string }[] = (await api("GET", "/food-library?tab=all", { token })).body.data;
  const f = foods.find((x) => name.test(x.name));
  if (!f) throw new Error(`no library food matching ${name}`);
  return f.id;
}

/** Monday 5 Oct 2026 and its days, used as a fixed test week. */
export const WEEK = "2026-10-05";
export const DAY = (i: number) => `2026-10-${String(5 + i).padStart(2, "0")}`;
