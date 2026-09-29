// Calendar-day helpers. Days are YYYY-MM-DD strings; the math runs in UTC so the
// server's own time zone never shifts a date.

const DAY_MS = 86_400_000;

const toMs = (key: string) => Date.parse(`${key}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (key: string, days: number) => fromMs(toMs(key) + days * DAY_MS);
export const daysBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY_MS);

/** The `n` days ending on `end`, oldest first. */
export const lastNDays = (n: number, end: string) => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));

/** Today's date in an IANA time zone. */
export const todayIn = (timeZone: string, now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Epoch milliseconds to an RFC 3339 UTC timestamp. */
export const iso = (ms: number) => new Date(ms).toISOString();
