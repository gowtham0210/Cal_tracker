import { defineConfig, devices } from "@playwright/test";

// The suite runs its own backend (in-memory database, AI disabled) and its own production
// build of the frontend on separate ports, so it never touches a developer's servers or data.
export const API_PORT = 4100;
export const WEB_PORT = 3100;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
  webServer: [
    {
      command: "npx tsx src/index.ts",
      cwd: "../backend",
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: String(API_PORT),
        DB_PATH: ":memory:",
        JWT_SECRET: "e2e-secret-that-is-at-least-32-characters-long",
        CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
        AUTH_REGISTER_LIMIT: "10000",
        AZURE_OPENAI_ENDPOINT: "",
        AZURE_OPENAI_API_KEY: "",
        AZURE_OPENAI_DEPLOYMENT: "",
        AZURE_OPENAI_API_VERSION: "",
      },
    },
    {
      command: `npx next build && npx next start -p ${WEB_PORT}`,
      cwd: "../frontend",
      url: `http://localhost:${WEB_PORT}/login`,
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        NEXT_DIST_DIR: ".next-e2e",
        NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}/api/v1`,
      },
    },
  ],
});
