import type { Database } from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";

const dir = new URL("./migrations/", import.meta.url);

// Applies migrations/NNN_*.sql in order. PRAGMA user_version records the last one applied.
// Never edit a migration that has shipped; add a new file instead.
export function migrate(db: Database) {
  const current = db.pragma("user_version", { simple: true }) as number;
  const files = readdirSync(dir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort();

  for (const file of files) {
    const version = Number(file.slice(0, 3));
    if (version <= current) continue;
    db.transaction(() => {
      db.exec(readFileSync(new URL(file, dir), "utf8"));
      db.pragma(`user_version = ${version}`);
    })();
    console.log(`Applied migration ${file}`);
  }
}
