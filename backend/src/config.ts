export const config = {
  port: Number(process.env.PORT ?? 4000),
  dbPath: process.env.DB_PATH ?? "./data/lighter.db",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
};
