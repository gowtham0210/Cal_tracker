/**
 * Client for the Lighter API. Types mirror the schemas in api/openapi.yaml.
 */
import type { Cuisine, MealType, Theme, UnitSystem } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

/* ---------------- Schemas ---------------- */

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Session {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: User;
}

export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
}

export interface ApiProfile {
  heightCm: number;
  startWeight: number;
  goalWeight: number;
  startDate: string;
  calorieGoal: number;
  macroGoals: { protein: number; carbs: number; fat: number };
  trackMacros: boolean;
  waterGoal: number;
  glassMl: number;
  units: UnitSystem;
  theme: Theme;
  timeZone: string;
  cuisine: Cuisine;
  updatedAt?: string;
}

export interface ApiFoodEntry {
  id: string;
  date: string;
  meal: MealType;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: "manual" | "ai-text" | "ai-photo" | "favorite";
  favoriteId: string | null;
  createdAt: string;
}

export interface ApiFavorite {
  id: string;
  name: string;
  meal: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface ApiExercise {
  id: string;
  date: string;
  name: string;
  minutes: number;
  calories: number;
  createdAt: string;
}

export interface ApiJournal {
  date: string;
  mood?: number;
  energy?: number;
  sleepHours?: number;
  cravings?: number;
  note?: string;
}

export interface EstimatedFood {
  name: string;
  quantity: number;
  serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: "high" | "medium" | "low";
}

export interface MealIdea {
  name: string;
  meal: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  tags: string[];
}

export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  headline: string;
  bullets: { label: string; value: string; trend: "up" | "down" | "flat"; good: boolean }[];
  tip: string;
}

export interface LibraryFood {
  id: string;
  name: string;
  meal: MealType;
  serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: "logged" | "favorite" | "curated" | "ai";
  confidence: "high" | "medium" | "low" | null;
  cuisine: string | null;
  diet: "veg" | "eggetarian" | "non-veg" | null;
  allergens: string[];
  useCount: number;
}

export type LibraryTab = "usual" | "favorites" | "new" | "all";

/** An RFC 9457 problem returned by the API. */
export interface Problem {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  errors?: { pointer: string; detail: string }[];
}

export class ApiError extends Error {
  constructor(readonly problem: Problem) {
    super(problem.detail ?? problem.title);
  }

  get status() {
    return this.problem.status;
  }

  /** The problem type slug, e.g. "email-taken". */
  get kind() {
    return this.problem.type?.split("/").pop();
  }

  /** Field errors keyed by top-level field name, e.g. `{ email: "..." }`. Errors about the whole body use the key "". */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const e of this.problem.errors ?? []) {
      const field = e.pointer.split("/")[1] ?? "";
      out[field] ??= e.detail;
    }
    return out;
  }
}

/* ---------------- Transport ---------------- */

let tokenSource: () => string | null = () => null;
let onUnauthorized: () => void = () => {};

/** Wires in the session: where to read the token, and what to do when it stops working. */
export function configureAuth(opts: { token: () => string | null; onUnauthorized: () => void }) {
  tokenSource = opts.token;
  onUnauthorized = opts.onUnauthorized;
}

interface RequestOptions {
  body?: unknown;
  raw?: BodyInit;
  contentType?: string;
  accept?: string;
  signal?: AbortSignal;
}

async function send(method: string, path: string, opts: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { accept: opts.accept ?? "application/json" };
  const token = tokenSource();
  if (token) headers.authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.raw !== undefined) {
    body = opts.raw;
    headers["content-type"] = opts.contentType ?? "application/octet-stream";
  } else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers["content-type"] = method === "PATCH" ? "application/merge-patch+json" : "application/json";
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body, signal: opts.signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError({ title: "Can't reach the server. Check your connection and try again.", status: 0 });
  }
  if (res.ok) return res;

  const problem = await res.json().catch(() => null);
  if (res.status === 401 && token) onUnauthorized();
  throw new ApiError(problem?.title ? problem : { title: "Something went wrong. Please try again.", status: res.status });
}

async function json<T>(method: string, path: string, opts?: RequestOptions): Promise<T> {
  const res = await send(method, path, opts);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Follows nextCursor until every page is loaded. */
async function all<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | null = null;
  do {
    const sep = path.includes("?") ? "&" : "?";
    const page: { data: T[]; nextCursor: string | null } = await json("GET", `${path}${sep}limit=500${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    out.push(...page.data);
    cursor = page.nextCursor;
  } while (cursor);
  return out;
}

const enc = encodeURIComponent;

/* ---------------- Operations ---------------- */

export const api = {
  register: (input: RegisterRequest) => json<Session>("POST", "/auth/register", { body: input }),
  login: (input: { email: string; password: string }) => json<Session>("POST", "/auth/login", { body: input }),

  me: () => json<User>("GET", "/me"),
  updateMe: (patch: Partial<Pick<User, "name" | "email">>) => json<User>("PATCH", "/me", { body: patch }),
  deleteMe: () => json<void>("DELETE", "/me"),
  clearData: () => json<void>("DELETE", "/me/data"),
  loadDemoData: () => json<void>("PUT", "/me/demo-data"),

  profile: () => json<ApiProfile>("GET", "/me/profile"),
  putProfile: (p: ApiProfile) => json<ApiProfile>("PUT", "/me/profile", { body: p }),
  updateProfile: (patch: Partial<ApiProfile>) => json<ApiProfile>("PATCH", "/me/profile", { body: patch }),

  foods: () => all<ApiFoodEntry>("/food-entries"),
  createFood: (f: Omit<ApiFoodEntry, "id" | "createdAt" | "favoriteId"> & { favoriteId?: string | null }) =>
    json<ApiFoodEntry>("POST", "/food-entries", { body: f }),
  updateFood: (id: string, patch: Partial<Pick<ApiFoodEntry, "date" | "meal" | "name" | "calories" | "protein" | "carbs" | "fat">>) =>
    json<ApiFoodEntry>("PATCH", `/food-entries/${enc(id)}`, { body: patch }),
  deleteFood: (id: string) => json<void>("DELETE", `/food-entries/${enc(id)}`),

  favorites: async () => (await json<{ data: ApiFavorite[] }>("GET", "/favorite-foods")).data,
  createFavorite: (f: Omit<ApiFavorite, "id">) => json<ApiFavorite>("POST", "/favorite-foods", { body: f }),
  deleteFavorite: (id: string) => json<void>("DELETE", `/favorite-foods/${enc(id)}`),

  weights: () => all<{ date: string; weight: number }>("/weight-entries"),
  putWeight: (date: string, weight: number) => json<{ date: string; weight: number }>("PUT", `/weight-entries/${date}`, { body: { weight } }),
  deleteWeight: (date: string) => json<void>("DELETE", `/weight-entries/${date}`),

  measurements: () => all<{ date: string; waist?: number; hips?: number; chest?: number }>("/measurement-entries"),
  putMeasurement: (date: string, m: { waist?: number; hips?: number; chest?: number }) => json("PUT", `/measurement-entries/${date}`, { body: m }),
  deleteMeasurement: (date: string) => json<void>("DELETE", `/measurement-entries/${date}`),

  exercises: () => all<ApiExercise>("/exercise-entries"),
  createExercise: (e: Omit<ApiExercise, "id" | "createdAt">) => json<ApiExercise>("POST", "/exercise-entries", { body: e }),
  deleteExercise: (id: string) => json<void>("DELETE", `/exercise-entries/${enc(id)}`),

  water: () => all<{ date: string; glasses: number }>("/water-entries"),
  putWater: (date: string, glasses: number) => json("PUT", `/water-entries/${date}`, { body: { glasses } }),

  journal: () => all<ApiJournal>("/journal-entries"),
  putJournal: (date: string, j: Omit<ApiJournal, "date">) => json<ApiJournal>("PUT", `/journal-entries/${date}`, { body: j }),

  estimateFoodText: (text: string) => json<{ source: "ai-text"; items: EstimatedFood[] }>("POST", "/food-estimates", { body: { text } }),
  estimateFoodPhoto: (file: Blob) => json<{ source: "ai-photo"; items: EstimatedFood[] }>("POST", "/food-estimates", { raw: file, contentType: file.type }),

  weeklySummary: (asOf: string) => json<WeeklySummary>("GET", `/coach/weekly-summary?asOf=${asOf}`),
  mealSuggestions: (asOf: string, meal?: MealType) =>
    json<{ data: MealIdea[] }>("GET", `/coach/meal-suggestions?asOf=${asOf}${meal ? `&meal=${meal}` : ""}`).then((r) => r.data),

  coachMessages: () => all<CoachMessage>("/coach/messages"),
  clearCoachMessages: () => json<void>("DELETE", "/coach/messages"),

  /** Asks the coach, calling `onDelta` with each piece of the answer as it is written. */
  async askCoach(text: string, onDelta: (piece: string) => void, signal?: AbortSignal): Promise<{ question: CoachMessage; answer: CoachMessage }> {
    const res = await send("POST", "/coach/messages", { body: { text }, accept: "text/event-stream", signal });
    if (!res.headers.get("content-type")?.startsWith("text/event-stream")) return res.json();

    const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let end: number;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        let event = "message";
        let data = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        const payload = data ? JSON.parse(data) : null;
        if (event === "delta") onDelta(payload.text);
        else if (event === "done") return payload;
        else if (event === "error") throw new ApiError(payload);
      }
    }
    throw new ApiError({ title: "The answer was interrupted. Please try again.", status: 0 });
  },

  library: (opts: { tab?: LibraryTab; meal?: MealType; q?: string } = {}) => {
    const qs = new URLSearchParams(Object.entries(opts).filter(([, v]) => v) as [string, string][]).toString();
    return json<{ data: LibraryFood[] }>("GET", `/food-library${qs ? `?${qs}` : ""}`).then((r) => r.data);
  },

  /** Downloads an export as a file. */
  async exportCsv(kind: string): Promise<{ filename: string; blob: Blob }> {
    const res = await send("GET", `/exports/${kind}`, { accept: "text/csv" });
    const filename = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? `lighter-${kind}.csv`;
    return { filename, blob: await res.blob() };
  },
};

