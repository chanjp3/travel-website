# MVP Business & Feature Plan
## Points-Optimized Multi-City Trip Planner
*Working concept — July 2026*

---

## 1. Executive Summary

This product is an intelligent trip architect: a user enters an origin, a rough list of destinations (or a region and interests), and their points balances, and the platform designs the entire journey — the optimal city sequence, the best way to fly there (points vs. cash, with real award availability), the right ground transport between cities (trains where trains win), hotels scored on views and quality, and a day-by-day mapped itinerary with attractions and realistic travel times.

No existing product does this end-to-end. The award-search category leaders (PointsYeah, Roame, Seats.aero, Point.me) are all **single-leg flight search engines** — they answer "is there a business class award seat from JFK to Tokyo in March?" None of them answers the question travelers actually start with: *"I want to do Japan for two weeks — build me the trip."* Itinerary planners (Wanderlog, TripIt, Google Travel) do the opposite: they organize trips but are blind to points, award availability, and route optimization. The opportunity sits squarely in the unoccupied middle.

**MVP thesis:** Launch with one corridor done brilliantly — **US → Japan** — rather than global coverage done shallowly. Japan is the ideal wedge: enormous award-travel demand, a closed and highly predictable rail network (making the "trains while there" feature tractable), dense attraction and hotel data, and a points community that obsessively shares tools that work.

---

## 2. Problem & Opportunity

Planning a multi-city international trip on points today requires stitching together five or more tools: an award search engine for the transpacific flights, Google Flights for cash comparison, a rail planner for in-country travel, a hotel points tool or booking site, and a general itinerary organizer — plus a spreadsheet to hold it all together. Each tool solves one slice; the traveler is the integration layer. The cognitive load is high enough that most points holders either book suboptimal redemptions or give up and pay cash.

The award-search tools have validated demand and willingness to pay: subscriptions in the category run roughly $99–$260 per year (Seats.aero Pro $99.99/yr, Roame ~$110/yr, Point.me $129–$260/yr), and Point.me additionally charges ~$200 per passenger for concierge bookings. These businesses monetize *search*. A product that monetizes the *whole trip* — flights, hotels, rail, and activities — has structurally more revenue surface per user.

The rise of AI planning tools raises expectations but hasn't closed the gap: LLM chatbots suggest itineraries but can't see live award inventory, real prices, or actual train schedules. A product combining real data pipelines with AI-driven itinerary generation is defensible against both the award-search incumbents and generic AI assistants.

---

## 3. Competitive Landscape & Positioning

| Player | What they do | What they don't do |
|---|---|---|
| **PointsYeah** | Fastest multi-program award search (20+ airline, 6 hotel programs); ranked #1 by NerdWallet for 2026 | No routing, no multi-city, no trains, no itinerary |
| **Roame** | Polished award search, SkyView discovery, alerts | Flight-first; no trip construction |
| **Seats.aero** | Power-user award data; the de facto data layer (Partner API) | Dated UI, single-leg mindset; explicitly a search engine, not a planner |
| **Point.me** | Beginner-friendly search + paid concierge booking | Slow, single-day searches, expensive; no itinerary layer |
| **Wanderlog / TripIt** | Itinerary organization, maps, collaboration | Zero points intelligence, no award data, no optimization |
| **Google Travel** | Cash flights/hotels, basic trip ideas | No points, no multi-city optimization, no rail integration outside limited markets |

**Positioning statement:** *"Award search tools find you a seat. We build you the trip."* The product is not competing on award-search depth (a losing war against Seats.aero's data operation — better to license it) but on **trip synthesis**: optimization, sequencing, multimodal routing, and a beautiful final artifact (the mapped, timed, shareable itinerary).

---

## 4. Target User

**Primary (launch):** The "optimizing enthusiast" — a US-based traveler holding 100K–1M+ transferable points (Amex MR, Chase UR, Capital One, Citi TY), taking 1–3 international trips per year, who currently spends 10–20 hours planning a big trip across multiple tools. They already pay for Seats.aero or PointsYeah. Estimated addressable population: low millions in the US based on premium travel card penetration.

**Secondary (fast follow):** The "aspirational novice" — has a big points balance from sign-up bonuses but finds transfer partners and award charts intimidating. Point.me proved this segment pays a premium for hand-holding; this product serves them with automation instead of concierges.

**Explicitly not targeting at MVP:** Corporate travel, cash-only budget travelers, travelers outside US origin markets.

---

## 5. MVP Scope: The Japan Corridor

The MVP answers one prompt exceptionally well: *"I'm in [US city]. I want to see Tokyo, Kyoto, Osaka [+ optionally: suggest more stops]. I have X points in these programs. Build my trip."*

**In scope:**

1. **Trip input.** Origin, destination wishlist (or "suggest stops" mode), date window with flexibility, party size, cabin preference, points balances by program (manual entry at MVP — no account linking), and priority slider (cheapest ↔ fastest ↔ most comfortable).
2. **Destination suggestion.** Given anchor cities and interests, the engine suggests logical additions (e.g., Tokyo/Kyoto/Osaka → suggest Hakone, Nara, Hiroshima, Kanazawa) with a one-line rationale and the incremental time/cost of adding each.
3. **Route optimization.** Solve the city sequence as a small traveling-salesman problem with mode-aware edge costs. With ≤8 stops, brute-force enumeration of orderings is computationally trivial; each candidate route is scored on total cost (points valued in cents + cash), total travel time, and comfort. Present the top 2–3 route options, not just one.
4. **Transpacific flight layer.** For the long-haul legs: cash prices via flight API alongside award options via licensed award-availability data, each award option annotated with the transfer path from the user's stated balances ("62.5K Amex MR → ANA Mileage Club") and a cents-per-point value so the cash-vs-points call is explicit.
5. **Japan rail layer.** Shinkansen and major limited-express routing between in-country stops with real schedules, durations, and fares, plus a JR Pass break-even calculation (pass vs. point-to-point tickets for this specific itinerary). Japan's rail network is stable and closed, so this can be modeled with high confidence — the reason this corridor is the right MVP.
6. **Hotel layer.** For each stop: a shortlist of 5–8 hotels scored on a composite "niceness + views" index built from ratings, review-text signals (frequency of "view," "skyline," "rooftop," "onsen," etc.), photo quality signals, and location convenience relative to the itinerary. Points-bookable properties (Hyatt/Marriott/Hilton) flagged with award rates alongside cash rates.
7. **Itinerary assembly.** The output artifact: an interactive map of the full journey with day-by-day plans, suggested attractions per stop (with realistic visit durations), and door-to-door travel time between every element. Shareable via link; exportable to PDF.

**Deliberately out of scope for MVP:** actual booking (deep-link out to airlines/hotels/JR instead), account linking to loyalty programs, Europe/other corridors, mobile apps (responsive web only), group collaboration features, live rebooking/disruption handling.

---

## 6. Feature Roadmap

**MVP (months 0–4):** Everything in Section 5. Success = a user can go from prompt to complete mapped Japan itinerary in under 5 minutes, with award options that verify as bookable ≥80% of the time.

**v1.1 (months 4–8):** Award availability alerts tied to a saved itinerary ("your ANA business seats just opened for your April window"); transfer-bonus awareness (e.g., Amex→ANA 20% bonus changes the math); Western Europe corridor (leveraging Eurostar/Trainline-style rail data); hotel award sweet-spot engine; basic account system with saved trips.

**v2 (months 8–14):** Booking integration (start with hotels via an affiliate-capable API, then flights via a Duffel-style order API for cash fares); loyalty account linking (AwardWallet-style balance sync); collaborative trip editing; Southeast Asia and Oceania corridors; mobile apps.

**Future/moonshots:** Auto-booking of award seats the moment availability opens; corporate/group charter tie-ins (a natural bridge to the Part 135 world — a "when commercial doesn't work, here's a charter quote" upsell is a genuinely novel monetization channel no competitor can offer); white-label version for travel advisors.

---

## 7. Data & API Strategy

This is the make-or-break section. The plan, layer by layer:

**Award availability (the moat, and the dependency):** Seats.aero operates a Partner API covering cached availability on 70,000+ routes and live search across ~20 mileage programs. Critically, **commercial use requires a written agreement** — Pro-tier API access ($9.99/mo, 1,000 calls/day) is explicitly non-commercial and live search is restricted to approved commercial partners. Action item #1 of the entire project: open the commercial conversation with Seats.aero early (support@seats.aero, with use case and volume estimates), because the answer and pricing shape the MVP. Fallback paths if terms are bad: (a) launch with cached-availability-style data plus "verify on airline site" UX, (b) evaluate smaller data providers, (c) longer term, build direct scraping — expensive, fragile, and an ongoing arms race, so treat as last resort.

**Cash flights:** Duffel (developer-friendly, per-search/per-order pricing) or Amadeus Self-Service (cheaper at volume, free sandbox tier, also provides hotel search). Recommend Amadeus for MVP to consolidate vendors and control cost; revisit Duffel when booking (v2) arrives.

**Points valuations:** Maintain an internal cents-per-point table by program (TPG/AwardWallet-style methodology), reviewed monthly. This is editorial work, not engineering, and it's also content-marketing fuel.

**Japan rail:** Model the Shinkansen/limited-express network directly using published schedules (the network changes rarely; JR timetable data and open GTFS-style sources cover it), with fares tables and JR Pass rules encoded. This avoids dependency on any third-party rail API for the launch corridor.

**Hotels:** Amadeus hotel search for rates + Google Places for ratings, reviews, and photos feeding the niceness/views scoring model. When monetization matters (v1.1+), add Expedia Rapid or similar affiliate-capable inventory.

**Attractions & itinerary intelligence:** Google Places (attractions, hours, ratings) + Google Routes/Distance Matrix (travel times) + an LLM layer (Claude API) for generating day plans, destination suggestions, and natural-language rationale. The LLM never invents prices or availability — it narrates and structures data the pipelines provide.

**Estimated MVP data costs:** Roughly $500–2,000/month at prototype/beta scale (Amadeus self-service + Google Places/Routes + LLM inference), **plus** the Seats.aero commercial license, which is the unknown and potentially the largest line item. Budget assumption: negotiate a startup-friendly tier or revenue share.

---

## 8. Monetization

**Freemium subscription (primary).** Free tier: 1 active trip, cached award data, limited destination suggestions — enough to demonstrate the magic. Pro tier at **$12.99/month or $119/year** (deliberately positioned at the top of the search-tool band, justified by doing 5 tools' jobs): unlimited trips, live award search, alerts, JR Pass optimizer, PDF export, priority corridors. Category pricing evidence says enthusiasts pay $99–$260/yr for far less synthesis.

**Affiliate/booking revenue (secondary, growing).** Hotel bookings (3–6% via affiliate-capable inventory), travel insurance, JR Pass reseller commissions, eSIM/experiences partners. At v2, flight booking margin via order APIs.

**Credit card referrals (tertiary, high-value).** The natural "you're 40K points short of business class — this card's bonus covers it" moment is contextual, genuinely useful, and pays $100–200+ per approval. Handle with care (disclosure, no dark patterns) — this is also how TPG-scale media businesses fund themselves, and it can eventually dwarf subscriptions.

**Unit economics sketch:** At $119/yr with blended affiliate/referral revenue of $30–60 per active user per year, 5,000 paying subscribers ≈ $750K–900K ARR — a realistic 18–24 month target for a niche tool with strong word-of-mouth in the points community.

---

## 9. Tech Stack & Build Phases

**Stack:** Next.js/React frontend with Mapbox or MapLibre for the journey map; Node or Python backend (Python favored for the optimization engine); Postgres + Redis (caching award/price lookups is essential for both cost and speed); Claude API for the intelligence layer; hosted on Vercel/Cloudflare + a small container service for the optimizer. This aligns with infrastructure already in use for the WSA/TAC web properties (Cloudflare Pages/Workers), keeping the operational surface familiar.

**Phase 0 (weeks 1–3) — Feasibility:** Seats.aero commercial outreach; Amadeus sandbox integration; encode the Japan rail network; validate the routing engine on paper itineraries.
**Phase 1 (weeks 3–8) — Engine:** Route optimizer, cost model (points-in-cents + cash + time), hotel scoring model, itinerary generator. CLI/API only, no polish.
**Phase 2 (weeks 8–14) — Product:** Full web UI: input flow → route options → leg-by-leg detail → mapped itinerary → PDF/share. Closed beta with 25–50 points-community users.
**Phase 3 (weeks 14–20) — Launch:** Pricing live, alerts, public launch aimed at the points community (Reddit r/awardtravel, points blogs, YouTube reviewers — this niche is unusually reachable, as the tool-comparison content ecosystem shows).

---

## 10. Key Risks & Mitigations

**Award data access is denied or priced out.** Highest-probability, highest-impact risk — Seats.aero explicitly notes many commercial use cases are not supported. Mitigate by engaging before writing code, designing the product to degrade gracefully to cached/indicative award data with verification links, and keeping the cash-price experience strong enough to stand alone.

**API costs scale faster than revenue.** Every trip plan fans out into dozens of searches. Mitigate with aggressive caching, precomputed popular-corridor data, and free-tier limits designed around cost per plan (target: <$0.50 marginal cost per generated itinerary).

**Airlines hostile to aggregation.** The whole category lives with this; licensing data rather than scraping keeps this risk on the data partner's side of the table.

**Incumbent response.** PointsYeah or Roame could add itinerary features. Their DNA and revenue are in search, and multimodal optimization + rail + itinerary is a genuinely different product surface — but speed to a loyal user base matters. The Japan-corridor depth strategy creates a quality bar broad tools won't match quickly.

**Scope creep.** The concept invites building everything. The mitigation is this document: one corridor, no booking, no account linking, until the core loop proves retention.

---

## 11. Success Metrics

**MVP validation (first 90 days post-beta):** ≥60% of beta users complete a full itinerary generation; ≥80% of surfaced award options verify as bookable; median prompt-to-itinerary time under 5 minutes; ≥30% of beta users return to plan a second trip or re-open a saved one within 30 days.

**Business (12 months):** 1,500–3,000 paying subscribers; free→paid conversion ≥4%; monthly churn <5%; affiliate revenue ≥15% of total; NPS ≥50 within the award-travel community.

**North-star metric:** *Trips actually taken that were planned on the platform* — measured via post-trip-date surveys and booking-link conversion. Everything else is a proxy.

---

## 12. Immediate Next Steps

1. Email Seats.aero commercial (support@seats.aero) with the use case and projected volumes — the entire data strategy hinges on this answer.
2. Register for Amadeus Self-Service sandbox and validate flight + hotel search quality on TPA/MCO → HND/NRT/KIX routes.
3. Build the Japan rail dataset (Shinkansen + key limited express lines, fares, JR Pass rules).
4. Prototype the route optimizer against 5 hand-built test itineraries and sanity-check its choices against expert judgment.
5. Name, domain, and a landing page with a waitlist to start measuring demand before the build finishes.
