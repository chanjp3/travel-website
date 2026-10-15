# Meridian tests

```bash
npm test
```

runs everything and exits non-zero on the first failing stage:

1. **Unit suites** (`node --test`, no browser): `tests/unit/`
   - `fares-unit` — `src/data/fixedFares.js` (published Shinkansen / KTX / THSR fares) and `src/lib/groundModes.js` (between-cities options, Omio partner slot, `omioUrl`).
   - `worker-go` — `trackedUrl()` and `GET /go?p=omio&u=` in `worker/index.js`, with made-up tracking links only.
   - `connections` — "connect via": `synthesizeConnections()` stitching hub legs from either fare source, and `connectsVia()` / `applyFlightView()` putting rows through the chosen hub first.
2. **Build** — `vite build --outDir dist-test` with `VITE_API_BASE=http://localhost:8788` (the site thinks a worker lives there).
3. **Browser suites** (Playwright, Chromium) — `vite preview --port 4174` serves `dist-test/`; every request to the worker is answered by `page.route` from `tests/e2e/helpers/mockApi.mjs`, and everything else off-box (geocoder, OSM, map tiles, fonts) is answered locally or refused. No test reaches a real airline, provider or partner.

| Suite | Covers |
| --- | --- |
| `flow-e2e` | The seven-step map intake → route & flights → itinerary for Tampa → Tokyo → Osaka (published fare, hotel pick carried through). |
| `mobile-e2e` | The same journey on a Pixel 7 viewport: bottom-sheet card, typing mode, compact desk header. |
| `tour-layers` | Hotel-tour map layers: defaults, `/api/places` fetches per toggle, pins on the street map. |
| `playbook-ui` | "How to book it" checklist: order, links, ticks and confirmation codes persisting across a reload. |
| `share-ui` | Share itinerary → snapshot POST → `share.html` renders it; not-found states. |
| `watch-ui` | Award watchlist for a signed-in account: drawer form, check now, mark seen, remove; "☆ watch award space" on a leg. |
| `limit-ui` | `X-Meridian-Limit` notices (`signin`, `user-cap`, `global-cap`) in the map flow and on the desk. |
| `omio-e2e` | Omio links always go through `/go?p=omio&u=`, with `rel=sponsored` and the disclosure; none on airport hops. |

Other entry points:

```bash
npm run test:unit                      # unit suites only
npm run test:e2e                       # build + browser suites
node tests/run.mjs --no-build          # browser suites against the existing dist-test/
node tests/run.mjs --no-build -- omio  # one suite (anything after -- goes to Playwright)
```

First run on a machine: `npx playwright install chromium`.

Two gaps the first run of these suites recorded were fixed on 15 Oct 2026, and the suites now assert the fixed behaviour:

- Leaving a city's hotel tour cancels that city's background work (attraction geocoding, the street map's 550 ms view-change check), so the hotel card no longer re-renders over the next step. `tourSettled()` in `e2e/helpers/intake.mjs` only waits for the city's attraction pins before moving on.
- On a phone the itinerary's hotel filter rows wrap their chips, so the page does not scroll sideways; `mobile-e2e` checks that as an ordinary assertion.

Build output goes to `dist-test/` (git-ignored) so `dist/` is never left pointing at the mocked API. Failures leave a trace and screenshot under `test-results/`.
