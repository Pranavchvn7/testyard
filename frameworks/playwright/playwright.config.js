import { defineConfig, devices } from "@playwright/test";

// Point BASE_URL at your deployed TestYard, or leave the default and run `npm start` in the repo root.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Starts TestYard automatically when running locally from this repo.
  webServer: process.env.BASE_URL ? undefined : { command: "npm start", cwd: "../..", url: "http://localhost:3000/api/health", reuseExistingServer: true },
});
