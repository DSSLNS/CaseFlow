import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// Tests run against a separate SQLite database that is reset and seeded on start.
const DATABASE_URL = "file:./e2e.db";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1, // one shared database; keep execution deterministic
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }], ["json", { outputFile: "test-results/results.json" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    // Recreate the throwaway e2e database from scratch; the dev database is never touched.
    command: `rm -f prisma/e2e.db prisma/e2e.db-journal && npx prisma migrate deploy && npx tsx prisma/seed.ts && npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    env: { DATABASE_URL },
    timeout: 300_000,
    reuseExistingServer: false,
    stdout: "pipe",
  },
});
