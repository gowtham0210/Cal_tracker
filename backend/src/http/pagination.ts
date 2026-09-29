import { HttpError } from "./problem.js";

// Keyset pagination: the cursor is the sort key of the last row returned, so pages
// stay stable while rows are added or removed.

export type Cursor = (string | number)[];

export const encodeCursor = (key: Cursor) => Buffer.from(JSON.stringify(key)).toString("base64url");

export function decodeCursor(cursor: string | undefined, length: number): Cursor | undefined {
  if (cursor === undefined) return undefined;
  try {
    const key = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (Array.isArray(key) && key.length === length) return key;
  } catch {}
  throw new HttpError(400, "validation-failed", "Your request is not valid.", undefined, [
    { pointer: "cursor", detail: "Invalid cursor. Use the nextCursor from the previous page." },
  ]);
}

/** Fetches limit + 1 rows to tell whether another page exists. */
export function page<T>(rows: T[], limit: number, keyOf: (row: T) => Cursor) {
  const more = rows.length > limit;
  const data = more ? rows.slice(0, limit) : rows;
  return { data, nextCursor: more ? encodeCursor(keyOf(data[data.length - 1])) : null };
}
