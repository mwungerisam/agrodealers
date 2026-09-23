import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "app.spec.ts",
  fullyParallel: false,
  workers: 1,
  expect: { timeout: 15000 },
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:5177",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5177 --strictPort",
    url: "http://127.0.0.1:5177",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
