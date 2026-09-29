import { db } from "./index.js";

/**
 * Prepares a statement with @named parameters and binds only the keys it uses, so callers
 * can pass whole objects (better-sqlite3 rejects unused or undefined named values).
 */
export function named<R = unknown>(sql: string) {
  const stmt = db.prepare(sql);
  const names = [...new Set([...sql.matchAll(/@(\w+)/g)].map((m) => m[1]))];
  const bind = (params: Record<string, unknown>) => Object.fromEntries(names.map((n) => [n, params[n] ?? null]));
  return {
    run: (params: Record<string, unknown>) => stmt.run(bind(params)),
    get: (params: Record<string, unknown>) => stmt.get(bind(params)) as R | undefined,
    all: (params: Record<string, unknown>) => stmt.all(bind(params)) as R[],
  };
}
