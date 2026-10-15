# Handoff — where Meridian stands (15 Oct 2026, after PR #43)

Read this first when starting a new session. Then delete or update it.

## What Meridian is
A points-optimized trip planner. Cloudflare Pages site + a git-connected
Worker API (`worker/`, deployed as `trip-architect-api`). Both auto-deploy
when `main` is merged. Work happens on branch
`claude/repo-cleanup-gitignore-qgk8gb`; PR → merge to `main` → reset the
branch onto `main`.

**Caution: pushes to the working branch also deploy the production
worker.** `wrangler versions list` shows every past merge as a pair of
deployments (the merge, then the branch-reset push), and docs-only pushes
deploy too. So unshipped worker changes go live before "ship it", and
every deploy re-applies `[vars]` from `worker/wrangler.toml`, which wipes
plain dashboard variables (Secrets survive). Check the worker's Builds
settings (production branch) in the dashboard if this should change.

## Shipped 15 Oct 2026, PR #42 (merge `a1af675`): filters, smart one-ways, cool palette
Owner asks: cool colours, airline and layover filters, and "search Google
Flights as though the legs are one-ways and find the best option" (TPA→SEA,
then ANA to Tokyo, never showed).
- **Airline + layover filters** (`src/lib/flightFilters.js`): `v.airlines`
  (chips built from the rows in view; a row stays when any of its carriers
  is chosen, so "Alaska + ANA" survives "ANA"), `v.layMin` / `v.layMax`
  (minutes; judged only where layover times are known). In the map flow
  under More filters; on the desk in the shared filter bar. Persisted with
  the rest of `flightView`.
- **Lookups run in two phases** (PR #43, merge `0a6748c`, after the owner
  reported the search broken: the six hub searches inside the main
  request pushed it past the client's 25 s limit, so the whole list came
  back empty; the diagnosis is from timing, not a reproduced failure, so
  if the search still misbehaves, `wrangler tail` while the owner runs a
  search is the next step). Phase
  one (`/api/flights?...&deep=1`) returns live results at once. Phase two
  (`...&only=hubs`, `liveHubPlans()` in `src/api/client.js`, 75 s budget)
  returns only the plans — a chosen layover or the smart ones — and both
  front ends merge them in when they land ("also checking separate-ticket
  combinations…" meanwhile). Google Flights fetches time out at 20 s.
  Only owners (`OWNER_EMAILS`) spend searches on hub legs; metered
  accounts get hub plans from cached searches only, so phase two never
  touches their 5/day allowance. The owner hit that allowance on 15 Oct
  because the worker did not recognise the signed-in account as owner:
  `OWNER_EMAILS` must contain the exact Google address shown under
  "Signed in as" in the Trips panel (comparison is case-insensitive).
  Counters live in KV as `meter:serp:<day>` and `meter:serp:<day>:<sub>`
  and expire in 48 h; the day resets at midnight UTC.
- **Smart separate tickets** (`autoHubOffers()` in `worker/index.js`): in
  phase two of every signed-in leg lookup, the worker takes the hubs
  Google Flights itself connected through (then the client's detour list),
  re-prices origin→hub and hub→destination as one-way Google Flights
  searches, stitches them (`synthesizeConnections()` now also offers the
  cheapest *nonstop* onward leg when the cheapest onward stops), and keeps
  a plan when it is ≥5% cheaper, ≥10% faster, or its onward leg is a
  nonstop the single tickets lack (≤1.25× the best fare; ≤1.5× if the
  airline is new). Rows read "Alaska + ANA · separate tickets". Quota:
  owners get 3 hubs = 6 searches per leg lookup, cached 6 h
  (`HUB_LEG_TTL`); metered accounts 1 hub. Anonymous lookups still only
  see the fare cache.
- **Cool palette**: `src/theme.js` (midnight ink, cool grey-blue paper,
  steel-blue accent, sea green, teal badges, cool crimson alerts) and the
  same mapping applied to `index.css`, `atlas/meridian.css`,
  `share/share.css`, `main.jsx`, the map layers and the playbook. Swap
  the tokens in `theme.js` and the CSS `:root` to reskin again.
Verify signed in: a TPA→NRT leg should show separate-ticket rows through
SEA/ORD/DFW-type hubs when they beat or complement the single tickets;
"Airlines" chips and the two layover selects filter the list.

## Shipped 15 Oct 2026, PR #42: "connect via" fix
Owner report: choosing a layover airport changed nothing. Cause: the
worker built the forced-hub plan only from the free fare cache, which
has no fares for most hub legs (TPA→DFW, DFW→NRT returned nothing), and
the live Google Flights path ignored the hub. Fix in `worker/index.js`:
`forcedHubOffers()` prices origin→hub and hub→destination with Google
Flights when the main leg did (signed in, deep lookup; two metered
searches, a third for a next-morning second leg only if needed), falls
back to the cache, and `synthesizeConnections()` now keeps every segment
and uses the real arrival stamp at the hub. Client: `applyFlightView`
lists rows through the chosen hub first (map flow and desk), and the map
flow says when nothing could be priced through the hub. Anonymous users
still get only the cache, so a hub can still come back empty for them.
Verify signed in: pick a hub under More filters → Connect via; rows
"via <hub>" should lead the list.

## Shipped 15 Oct 2026
PR #41 merged to `main` (merge commit `5818e90`, both Cloudflare checks
green); the branch was reset onto `main` and force-pushed. It carried:
- `tests/`: the browser and unit suites, runner and mocks (see Testing).
- Two UI fixes the suites found: leaving a city's hotel tour cancels that
  city's background work; the itinerary's hotel filter chips wrap on
  phones (commit `237c69f`).
- The 14 Oct handoff updates below.
After the deploy the Omio redirect still returns Impact's full tracking
link with the route page attached (checked 16:49 UTC).

## Shipped 14 Oct 2026
PR #40 merged to `main` (merge commit `16ecf59`); the branch was reset
onto `main` and force-pushed. It carried commit `96d1094`:
- `src/data/fixedFares.js`: published fares for Japan (Tokaido/Sanyo
  Shinkansen), Korea (KTX) and Taiwan (THSR). Shown in local currency,
  marked "Published fare", not an estimate.
- Omio affiliate links on train/bus/ferry hops in Europe, UK, US, Canada
  (`book: {partner:"omio"}` in `src/lib/groundModes.js`). Links go through
  the worker's `/go?p=omio&u=<omio route page>` redirect, which adds the
  tracking link stored in the `OMIO_LINK` worker secret. Omio-only domain
  allowlist; never an open redirect.
- Disclosure line wherever a partner link appears; "Affiliate links"
  section in `public/terms.html`; redirect note in `public/privacy.html`.
- City search shows English names (Firenze → Florence, etc.).

## Verified after the deploy (all green as of 20:22 UTC)
- `/go?p=omio&u=https://www.omio.com/trains/rome/florence` returns `302`
  to Impact's full tracking link (`omio.sjv.io/c/<account>/<ad>/<campaign>`)
  with `u=` carrying the Rome→Florence page; a second route (Paris→Lyon)
  behaves the same. Non-Omio targets, plain-`http` targets and unknown
  partners return `400`, so the allowlist holds.
- `OMIO_LINK` is a **Secret** (dashboard version 20:22 UTC "Updated
  secret: OMIO_LINK"). It took three tries to get here: it was first a
  plain variable (wiped by the merge deploy), then a Secret holding
  Impact's *shortened* link (tracked, but landed on Omio's home page —
  shortened links cannot deep-link). The full link comes from Impact's
  Create a Link panel → gear icon → Link Preference Settings → **Regular**
  (now the saved default on the owner's Impact account). Never paste the
  link value in chat.
- https://www.omio.com/trains/rome/florence is a real route page, so the
  URL pattern works on omio.com, not only omio.fr.

## Next steps, in order
1. **Owner:** decide whether the worker should keep deploying from the
   working branch (see the caution above). To deploy only from `main`:
   Cloudflare dashboard → worker `trip-architect-api` → Settings → Builds
   → production branch `main`. No repo change needed.
2. **Owner:** affiliate programs to apply for next (owner's Travelpayouts
   account already exists): 12Go (SE Asia ground), Welcome Pickups or
   Kiwitaxi (airport transfers), Ferryhopper, hotels (Booking.com via
   CJ/Awin), tours (GetYourGuide/Viator). When one is approved, add it to
   `PARTNERS` in `worker/index.js` and a `book` entry in `groundModes.js`,
   store the network's full tracking link as a dashboard *Secret*, add a
   case to `tests/unit/worker-go.test.mjs`, and verify with the curl above
   (adapt the partner and route).
3. This note's update is a docs-only commit on the branch; it rides with
   the next PR.

## Rules that must persist
- Never paste API keys, tokens or tracking links in chat. Secrets live only
  in the Cloudflare dashboard (worker → Settings → Variables and Secrets),
  stored as type Secret, never as plain variables.
- No scraping of airline or partner sites.
- Seats.aero awards stay owner-only until `AWARDS_PUBLIC` is set.
- Owner email is not in the repo; `OWNER_EMAILS` is a dashboard secret.
- Don't merge to `main` until the owner says "ship it".
- `npx wrangler secret list` / `versions list` (run in `worker/`) are safe
  diagnostics (names only) but leave a `worker/.wrangler/` cache folder
  holding account info: delete it, don't commit it. A dashboard change
  always shows up there as a version ("Add variable: …" / "Updated
  secret: …"); if none appears, the change was not deployed.

## Testing
`npm test` runs everything from `tests/` (see `tests/README.md`): the
`fares-unit`, `worker-go` and `connections` Node suites, then a build into `dist-test/`
with `VITE_API_BASE=http://localhost:8788`, then the Playwright suites
(flow-e2e, mobile-e2e, tour-layers, playbook-ui, share-ui, watch-ui,
limit-ui, omio-e2e) against `vite preview --port 4174`. The worker is
mocked with `page.route` (`tests/e2e/helpers/mockApi.mjs`); nothing
reaches a real provider or partner. First run on a machine:
`npx playwright install chromium`.

Two things the suites found, fixed on 15 Oct 2026:
- Leaving a city's hotel tour (Continue / Skip tour / Back from city 1) now
  bumps `tourSeq` in `stepCityTour`, so that city's late attraction geocode
  or street-map 550 ms view-change check is dropped instead of re-rendering
  the hotel card over the next step. `tourSettled` in
  `tests/e2e/helpers/intake.mjs` now only waits for the attraction pins.
- The itinerary's hotel filter rows wrap their chips (`flex-wrap` in
  `App.jsx`), so a phone no longer scrolls sideways; `mobile-e2e` asserts
  that outright instead of carrying it as an expected failure.
