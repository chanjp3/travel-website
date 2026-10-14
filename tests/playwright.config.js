/**
 * Playwright config for the Meridian browser suites.
 *
 * The site under test is the production build in `dist-test/` (made by
 * `tests/run.mjs` with VITE_API_BASE=http://localhost:8788), served by
 * `vite preview` on port 4174. Nothing listens on 8788: every suite answers
 * the worker's API from fixtures with page.route (see e2e/helpers/mockApi.mjs),
 * so no test reaches a real provider, airline or partner site.
 */
import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
export const PORT = 4174;
export const SITE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: path.join(here, "e2e"),
  outputDir: path.join(root, "test-results"),
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: SITE,
    // The map intake animates with d3 (1.4 s zooms, timed card reveals);
    // reduced motion makes every step land immediately and deterministically.
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js preview --outDir dist-test --port ${PORT} --strictPort`,
    cwd: root,
    url: `${SITE}/`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } }, testIgnore: /mobile-e2e/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile-e2e/ },
  ],
});
