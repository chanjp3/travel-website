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
deployments (the merge, then the branch-reset push), and a docs-only push
at 19:39 UTC deployed too. So unshipped worker changes go live before
"ship it", and every deploy re-applies `[vars]` from `worker/wrangler.toml`,
wiping plain dashboard variables. Check the worker's Builds settings
(production branch) in the dashboard.

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

## Verified after the deploy
- `/go?p=omio&u=https://www.omio.com/trains/rome/florence` returns `302`
  with `Cache-Control: no-store`. Non-Omio targets, plain-`http` targets
  and unknown partners all return `400`, so the allowlist holds.
- https://www.omio.com/trains/rome/florence is a real route page (live
  timetable and fares), so the URL pattern works on omio.com, not only
  omio.fr.
- **Open item — `OMIO_LINK` is wrong in two ways** (state at 19:50 UTC):
  1. It is a *plain variable*, not a Secret (absent from `wrangler secret
     list`; the dashboard version message was "Add variable: OMIO_LINK").
     The 19:36 merge deploy already wiped an earlier copy; the next push
     will wipe this one.
  2. It holds Impact's *shortened* link. The redirect now lands on
     `omio.sjv.io/<id>` — tracked, but Omio's home page, not the route.
     Impact's docs: a shortened (vanity) link cannot carry a deep link;
     only the full tracking URL `https://omio.sjv.io/c/<account>/<ad>/<campaign>`
     accepts `?u=<landing page>`, and the brand must allow deep linking.
     The worker already appends `u=` to a `/c/…` link.

## Next steps, in order
1. **Owner, in Impact:** sign in → the Omio ad/link → retrieve the *full
   tracking URL* (the one with `/c/` and three numbers; Create a Link →
   Advanced, or untick "shorten"). Confirm the brand allows deep linking
   (Details tab; "Deep Linking" not greyed out).
2. **Owner, in Cloudflare:** worker `trip-architect-api` → Settings →
   Variables and Secrets → *Production* tab → `OMIO_LINK`: paste the full
   URL and click **Encrypt** (type Secret), then **Deploy**. Then re-run
   `curl.exe -sI "https://trip-architect-api.chandler-850.workers.dev/go?p=omio&u=https%3A%2F%2Fwww.omio.com%2Ftrains%2Frome%2Fflorence"`
   and expect `Location` on `omio.sjv.io/c/…` with `u=` carrying the
   Rome→Florence page. Never paste the link value in chat.
   Alternative safety net if plain variables keep happening:
   `keep_vars = true` in `worker/wrangler.toml` (the deploy that carries
   it preserves existing dashboard variables).
3. Push this branch only after step 2 (a push deploys and would wipe a
   plain variable). This note's update may be an unpushed local commit.
4. Affiliate programs to apply for next (owner's Travelpayouts account
   already exists): 12Go (SE Asia ground), Welcome Pickups or Kiwitaxi
   (airport transfers), Ferryhopper, hotels (Booking.com via CJ/Awin),
   tours (GetYourGuide/Viator). When one is approved, add it to `PARTNERS`
   in `worker/index.js` and a `book` entry in `groundModes.js`.

## Rules that must persist
- Never paste API keys, tokens or tracking links in chat. Secrets live only
  in the Cloudflare dashboard (worker → Settings → Variables and Secrets).
- No scraping of airline or partner sites.
- Seats.aero awards stay owner-only until `AWARDS_PUBLIC` is set.
- Owner email is not in the repo; `OWNER_EMAILS` is a dashboard secret.
- Don't merge to `main` until the owner says "ship it".
- `npx wrangler secret list` / `versions list` (run in `worker/`) are safe
  diagnostics (names only) but leave a `worker/.wrangler/` cache folder
  holding account info: delete it, don't commit it.

## Testing
Browser suites live in an earlier session's scratchpad, not the repo
(flow-e2e, mobile-e2e, tour-layers, playbook-ui, share-ui, watch-ui,
limit-ui, omio-e2e, fares-unit, worker-go). They used Playwright against
`npx vite build` + `npx vite preview --port 4174` with
`VITE_API_BASE=http://localhost:8788` and mocked API routes. Rebuild them
in `tests/` if needed; all passed at commit `96d1094`.
