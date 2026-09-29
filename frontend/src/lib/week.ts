import { addDays, fromKey, toKey } from "./date";

/** Monday of the week containing `key` (YYYY-MM-DD). */
export function mondayOf(key: string): string {
  const d = fromKey(key);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toKey(d);
}

/** The seven dates of the week starting on `monday`. */
export const weekDates = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/** "6 – 12 Oct" or "29 Sep – 5 Oct". */
export function weekLabel(monday: string): string {
  const start = fromKey(monday);
  const end = fromKey(addDays(monday, 6));
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: "short" });
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()} – ${end.getDate()} ${month(end)}`
    : `${start.getDate()} ${month(start)} – ${end.getDate()} ${month(end)}`;
}

export const shortDay = (key: string) => fromKey(key).toLocaleDateString(undefined, { weekday: "short" });
export const longDay = (key: string) => fromKey(key).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
