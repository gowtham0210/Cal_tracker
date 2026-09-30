function required(name: string, check: (v: string) => boolean, hint: string): string {
  const value = process.env[name];
  if (!value || !check(value)) throw new Error(`${name} is missing or invalid: ${hint}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  dbPath: process.env.DB_PATH ?? "./data/lighter.db",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  // Which proxies to trust for the client IP (Express "trust proxy"). Behind a reverse proxy on a
  // Docker network use "uniquelocal", so rate limits count each visitor rather than the proxy.
  trustProxy: process.env.TRUST_PROXY ?? "loopback",
  jwtSecret: required("JWT_SECRET", (v) => v.length >= 32, "set it to a random string of at least 32 characters (see .env.example)"),
  // Access token lifetime in seconds. There are no refresh tokens yet, so this is also the session length.
  accessTokenTtl: Number(process.env.ACCESS_TOKEN_TTL ?? 7 * 24 * 60 * 60),
  // Registrations allowed per IP per 15 minutes (raised by the E2E suite, which registers a user per test).
  registerLimit: Number(process.env.AUTH_REGISTER_LIMIT ?? 20),
};
