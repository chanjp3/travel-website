# Handoff — where Meridian stands (14 Oct 2026, after shipping PR #40)

Read this first when starting a new session. Then delete or update it.

## What Meridian is
A points-optimized trip planner. Cloudflare Pages site + a git-connected
Worker API (`worker/`, deployed as `trip-architect-api`). Both auto-deploy
when `main` is merged. Work happens on branch
`claude/repo-cleanup-gitignore-qgk8gb`; PR → merge to `main` → reset the
branch onto `main`.

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
- **Open item:** the `302` lands on the bare Omio page. `OMIO_LINK` is not
  set — it is absent from `wrangler secret list` (names only; values are
  never read). Clicks work but nothing is tracked until the owner adds it.

## Next steps, in order
1. **Owner: set `OMIO_LINK`** in the Cloudflare dashboard (worker →
   Settings → Variables and Secrets), as a *secret* so it survives
   deploys. Use Impact's full (unshortened) link: Create a Link →
   Advanced → full link. Then re-run
   `curl.exe -sI "https://trip-architect-api.chandler-850.workers.dev/go?p=omio&u=https%3A%2F%2Fwww.omio.com%2Ftrains%2Frome%2Fflorence"`
   and expect `Location` on `omio.sjv.io` with a `/c/…` path and `u=`
   carrying the Rome→Florence page. If `Location` is only the bare short
   link (`omio.sjv.io/xxxxxx`), it still tracks but lands on Omio's home
   page; replace it with the full link.
2. Affiliate programs to apply for next (owner's Travelpayouts account
   already exists): 12Go (SE Asia ground), Welcome Pickups or Kiwitaxi
   (airport transfers), Ferryhopper, hotels (Booking.com via CJ/Awin),
   tours (GetYourGuide/Viator). When one is approved, add it to `PARTNERS`
   in `worker/index.js` and a `book` entry in `groundModes.js`.
3. This note's update is on the branch, unmerged (docs only). Fold it into
   the next PR.

## Rules that must persist
- Never paste API keys, tokens or tracking links in chat. Secrets live only
  in the Cloudflare dashboard (worker → Settings → Variables and Secrets).
- No scraping of airline or partner sites.
- Seats.aero awards stay owner-only until `AWARDS_PUBLIC` is set.
- Owner email is not in the repo; `OWNER_EMAILS` is a dashboard secret.
- Don't merge to `main` until the owner says "ship it".

## Testing
Browser suites live in an earlier session's scratchpad, not the repo
(flow-e2e, mobile-e2e, tour-layers, playbook-ui, share-ui, watch-ui,
limit-ui, omio-e2e, fares-unit, worker-go). They used Playwright against
`npx vite build` + `npx vite preview --port 4174` with
`VITE_API_BASE=http://localhost:8788` and mocked API routes. Rebuild them
in `tests/` if needed; all passed at commit `96d1094`.
