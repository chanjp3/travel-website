# Trip Architect · 旅程設計

Points-optimized multi-city trip planner — **Japan corridor prototype**.

Enter an origin, a destination wishlist, and your points balances. The engine sequences your cities, picks entry/exit airports (discovering open-jaw routings on its own), routes the Shinkansen legs, runs the JR Pass break-even, scores hotels on views and quality, and assembles a mapped day-by-day itinerary.

## Quick start

```bash
npm install
npm run dev        # local dev server
npm run build      # production build → dist/
```

Requires Node 18+.

## v0.2 — the funding engine

- **Transfer-partner engine** (`src/data/transferPartners.js` + `src/lib/funding.js`) — real Amex MR / Chase UR / Bilt transfer tables with ratios and transfer times. Every award shows its concrete funding path, e.g. *"Transfer 60,000 Amex MR → Virgin Atlantic (instant)"* or *"Book directly with 90,000 Alaska miles."*
- **Points-only mode** — filters flights and hotels to what current balances can actually fund via those paths.
- **Hotels step** — points vs. cash per property; hotel awards fund through card transfers too (Chase UR → Hyatt).
- **Cost rundown** (`src/lib/costs.js`) — full trip ledger: itemized flights/hotels/ground with the JR Pass decision applied automatically, points spent per currency with before/used/after balances, over-commitment warnings, total cash out of pocket, and retail-value comparison.

## What's real vs. stubbed

| Layer | Status |
|---|---|
| Route optimizer (permutation scoring, gateway selection) | ✅ Fully functional — `src/lib/optimizer.js` |
| Japan rail network (times, fares, services) | ✅ Encoded from published schedules — `src/data/rail.js` |
| JR Pass break-even analysis | ✅ Functional — `src/lib/trip.js` |
| Day-by-day itinerary assembly | ✅ Functional — `src/lib/trip.js` |
| Transfer partners, ratios, funding paths | ✅ Real static data — `src/data/transferPartners.js` |
| Trip cost ledger & points accounting | ✅ Functional — `src/lib/costs.js` |
| Hotel shortlists + view/quality scores | ⚠️ Static seed data — `src/data/hotels.js` |
| Transpacific cash + award flight options | ⚠️ **Sample data** — `src/data/flights.js` |

The two stubbed layers are deliberately isolated behind stable data shapes so the UI needs no changes when live feeds are wired in.

## Architecture

```
src/
├── App.jsx                 # 4-step flow: brief → stops → route & flights → itinerary
├── theme.js                # design tokens (Japanese rail-signage aesthetic)
├── data/
│   ├── cities.js           # city dataset + optimizer-aware suggestions
│   ├── rail.js             # rail edges, gateways, airport access matrix
│   ├── flights.js          # ← SWAP POINT for Amadeus (cash) + Seats.aero (award)
│   ├── hotels.js           # ← SWAP POINT for hotel APIs + Places scoring
│   └── attractions.js      # attraction pool with visit durations
├── lib/
│   ├── optimizer.js        # brute-force permutation scoring, open-jaw discovery
│   └── trip.js             # JR Pass math, itinerary builder, formatters
└── components/
    ├── RouteSpine.jsx      # signature element: Shinkansen in-car stop display
    ├── JourneyMap.jsx      # SVG route diagram (→ MapLibre later)
    └── ui.jsx              # Chip, SectionLabel, StopCard, NightsStepper
```

## How the optimizer works

With ≤8 stops the permutation space is tiny (8! = 40,320), so every ordering is enumerated. For each ordering, the best entry and exit gateway (HND/KIX) is chosen from a door-to-door access matrix, then the route is scored on a user-weighted blend of total ground cost and total ground time. Mirror routes (the same trip run backwards) are de-duplicated. The transpacific legs are near-constant across orderings, so gateway *access* is what drives open-jaw wins — e.g. HND-in / KIX-out for Tokyo → Kyoto → Osaka.

## Roadmap (see `docs/mvp-plan.md` for the full plan)

1. **Live cash fares** — Amadeus Self-Service Flight Offers (free sandbox). Add `VITE_AMADEUS_KEY` / `VITE_AMADEUS_SECRET` to `.env`; calls should go through a small server/worker proxy, not the browser.
2. **Live award availability** — Seats.aero Partner API. Commercial use requires a written agreement (support@seats.aero) — engage before building against it.
3. **Hotel data** — Amadeus hotel search + Google Places signals feeding the view/quality scoring model.
4. **Real map layer** — replace the SVG diagram with MapLibre GL.
5. **PDF export & shareable links** — serialize trip state to URL; render the itinerary to PDF.
6. **Backend** — a thin API layer (Cloudflare Workers fits the existing infra) for caching fare/award lookups; caching is essential for both cost and speed.

## Deploying

Static Vite build — deploys directly to Cloudflare Pages (build command `npm run build`, output directory `dist`), Vercel, or Netlify.

---

*Award prices, transfer paths, and fees shown in the prototype are illustrative sample data. Always verify live availability before transferring points.*
