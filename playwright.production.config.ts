import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testMatch: "production.spec.ts",
  use: { ...base.use, baseURL: "http://127.0.0.1:5178" },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 5178 --strictPort",
    url: "http://127.0.0.1:5178",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
