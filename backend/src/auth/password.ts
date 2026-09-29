import { argon2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const argon2Async = promisify(argon2);

// OWASP Password Storage Cheat Sheet minimum for Argon2id: 19 MiB memory, 2 iterations, 1 lane.
const PARAMS = { memory: 19_456, passes: 2, parallelism: 1, tagLength: 32 } as const;

const b64 = (buf: Buffer) => buf.toString("base64").replace(/=+$/, "");

/** Hashes a password into a self-describing PHC string. */
export async function hashPassword(password: string): Promise<string> {
  const nonce = randomBytes(16);
  const hash = await argon2Async("argon2id", { message: password, nonce, ...PARAMS });
  return `$argon2id$v=19$m=${PARAMS.memory},t=${PARAMS.passes},p=${PARAMS.parallelism}$${b64(nonce)}$${b64(hash)}`;
}

/** Checks a password against a PHC string produced by hashPassword. */
export async function verifyPassword(password: string, phc: string): Promise<boolean> {
  const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(phc);
  if (!match) return false;
  const [, m, t, p, salt, stored] = match;
  const expected = Buffer.from(stored, "base64");
  const actual = await argon2Async("argon2id", {
    message: password,
    nonce: Buffer.from(salt, "base64"),
    memory: Number(m),
    passes: Number(t),
    parallelism: Number(p),
    tagLength: expected.length,
  });
  return timingSafeEqual(actual, expected);
}
