import { defineConfig } from "@playwright/test";
import { config } from "dotenv";
config({ path: ".env.test", override: true, quiet: true });
export default defineConfig({
  testDir: "./tests/e2e", workers: 1, fullyParallel: false, timeout: 120000,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: "http://localhost:3100", viewport: { width: 1440, height: 1000 }, actionTimeout: 15000, trace: "retain-on-failure", screenshot: "only-on-failure",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] } },
  webServer: { command: "npx tsx scripts/test-server.ts", url: "http://localhost:3100/login", reuseExistingServer: false, timeout: 90000 },
});
