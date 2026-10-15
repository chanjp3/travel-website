#!/usr/bin/env node
/**
 * `npm test` — the whole Meridian test run, cross-platform (no shell env
 * syntax, so it works from PowerShell, cmd and bash alike):
 *
 *   1. unit suites (node:test): fares-unit, worker-go
 *   2. production build into dist-test/ with VITE_API_BASE=http://localhost:8788
 *   3. Playwright browser suites against `vite preview --port 4174`
 *
 * Exits non-zero at the first failing stage.
 *
 *   node tests/run.mjs            everything
 *   node tests/run.mjs --unit     unit suites only
 *   node tests/run.mjs --e2e      build + browser suites only
 *   node tests/run.mjs --no-build browser suites against the existing dist-test/
 *   node tests/run.mjs -- <playwright args>   e.g. `-- omio-e2e` or `-- --headed`
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_BASE = "http://localhost:8788"; // the mocked worker — nothing listens here
const FLAGS = new Set(["--unit", "--e2e", "--no-build", "--"]);
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const passthrough = argv.filter((a) => !FLAGS.has(a));

function run(label, args, env = {}) {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });
  if (r.status !== 0) {
    console.error(`\n✖ ${label} failed (${r.status == null ? r.signal : `exit ${r.status}`})`);
    process.exit(r.status ?? 1);
  }
}

if (!has("--e2e") && !has("--no-build")) {
  run("Unit suites (fares-unit, worker-go, connections, filters)", ["--test", "tests/unit/fares-unit.test.mjs", "tests/unit/worker-go.test.mjs", "tests/unit/connections.test.mjs", "tests/unit/filters.test.mjs"]);
}
if (!has("--unit")) {
  if (!has("--no-build")) {
    run(`Build → dist-test/ (VITE_API_BASE=${API_BASE})`, ["node_modules/vite/bin/vite.js", "build", "--outDir", "dist-test"], { VITE_API_BASE: API_BASE });
  }
  run("Browser suites (Playwright, Chromium)", ["node_modules/@playwright/test/cli.js", "test", "-c", "tests/playwright.config.js", ...passthrough]);
}
console.log("\n✔ all suites passed");
