# Handoff — where Meridian stands (14 Oct 2026, evening, after PR #40)

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
1. Affiliate programs to apply for next (owner's Travelpayouts account
   already exists): 12Go (SE Asia ground), Welcome Pickups or Kiwitaxi
   (airport transfers), Ferryhopper, hotels (Booking.com via CJ/Awin),
   tours (GetYourGuide/Viator). When one is approved, add it to `PARTNERS`
   in `worker/index.js` and a `book` entry in `groundModes.js`, store the
   network's full tracking link as a dashboard *Secret*, and verify with
   the curl above (adapt the partner and route).
2. This note's updates are on the branch, unmerged (docs only). Fold them
   into the next PR.

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
Browser suites live in an earlier session's scratchpad, not the repo
(flow-e2e, mobile-e2e, tour-layers, playbook-ui, share-ui, watch-ui,
limit-ui, omio-e2e, fares-unit, worker-go). They used Playwright against
`npx vite build` + `npx vite preview --port 4174` with
`VITE_API_BASE=http://localhost:8788` and mocked API routes. Rebuild them
in `tests/` if needed; all passed at commit `96d1094`.
