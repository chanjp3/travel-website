# Handoff — where Meridian stands (14 Oct 2026)

Read this first when starting a new session. Then delete or update it.

## What Meridian is
A points-optimized trip planner. Cloudflare Pages site + a git-connected
Worker API (`worker/`, deployed as `trip-architect-api`). Both auto-deploy
when `main` is merged. Work happens on branch
`claude/repo-cleanup-gitignore-qgk8gb`; PR → merge to `main` → reset the
branch onto `main`.

## Unshipped work (on the branch, pushed, not merged)
Commit `96d1094` — "Published train fares, Omio booking links, English city names":
- `src/data/fixedFares.js`: published fares for Japan (Tokaido/Sanyo
  Shinkansen), Korea (KTX) and Taiwan (THSR). Shown in local currency,
  marked "Published fare", not an estimate.
- Omio affiliate links on train/bus/ferry hops in Europe, UK, US, Canada
  (`book: {partner:"omio"}` in `src/lib/groundModes.js`). Links go through
  the worker's `/go?p=omio&u=<omio route page>` redirect, which adds the
  tracking link stored in the `OMIO_LINK` worker secret. Omio-only domain
  allowlist; never an open redirect.
- Disclosure line wherever a partner link appears; new "Affiliate links"
  section in `public/terms.html`; redirect note in `public/privacy.html`.
- City search shows English names (Firenze → Florence, etc.).

## Next steps, in order
1. **Ship it.** Open a PR from the branch, merge to `main`, then
   `git fetch origin main; git checkout -B claude/repo-cleanup-gitignore-qgk8gb origin/main; git push --force-with-lease`.
2. **Verify the Omio redirect** after Cloudflare deploys (a few minutes):
   `curl.exe -sI "https://trip-architect-api.chandler-850.workers.dev/go?p=omio&u=https%3A%2F%2Fwww.omio.com%2Ftrains%2Frome%2Fflorence"`
   Expect `302` with a `Location` on `omio.sjv.io` (Impact) carrying the
   Rome→Florence page. If `Location` is just the bare short link
   (`omio.sjv.io/xxxxxx`, no `/c/…` path), the secret holds Impact's short
   link; it still tracks but lands on Omio's home page. Fix: in Impact,
   Create a Link → Advanced → full (unshortened) link, replace `OMIO_LINK`.
3. Open https://www.omio.com/trains/rome/florence in a browser and confirm
   the route page exists; the URL pattern was only confirmed on omio.fr.
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

## Testing
Browser suites live in the previous session's scratchpad, not the repo
(flow-e2e, mobile-e2e, tour-layers, playbook-ui, share-ui, watch-ui,
limit-ui, omio-e2e, fares-unit, worker-go). They used Playwright against
`npx vite build` + `npx vite preview --port 4174` with
`VITE_API_BASE=http://localhost:8788` and mocked API routes. Rebuild them
in `tests/` if needed; all passed at commit `96d1094`.
