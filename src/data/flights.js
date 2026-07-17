/**
 * ── SAMPLE AWARD DATA ──
 *
 * Transpacific options TPA ⇄ Japan. Points prices and fees are realistic
 * but STATIC — this module is the swap point for live data:
 *
 *   1. Cash fares  → Amadeus Self-Service Flight Offers Search
 *                    (or Duffel when booking arrives).
 *   2. Award seats → Seats.aero Partner API (commercial agreement required —
 *                    see docs/mvp-plan.md §7 and §12).
 *
 * `programId` links each award to the loyalty program it books through;
 * the funding engine (src/lib/funding.js) resolves how the user's card
 * points reach that program. Keep the shape identical when wiring live data.
 */
export const FLIGHTS_OUT = [
  { id: "o1", airline: "ANA", cabin: "Business", gw: "HND", via: "via ORD", dur: "19h 05m",
    points: 60000, programId: "virginAtlantic", fees: 310, cash: 4350 },
  { id: "o2", airline: "JAL", cabin: "Business", gw: "HND", via: "via DFW", dur: "18h 40m",
    points: 80000, programId: "alaska", fees: 95, cash: 4480 },
  { id: "o3", airline: "United", cabin: "Polaris Business", gw: "HND", via: "via SFO", dur: "19h 55m",
    points: 88000, programId: "aeroplan", fees: 85, cash: 4100 },
  { id: "o4", airline: "ANA", cabin: "Economy", gw: "HND", via: "via ORD", dur: "19h 05m",
    points: 32500, programId: "virginAtlantic", fees: 290, cash: 1120 },
  { id: "o5", airline: "United", cabin: "Economy (saver)", gw: "HND", via: "via IAD", dur: "20h 20m",
    points: 44000, programId: "united", fees: 6, cash: 1010 },
  { id: "o6", airline: "Delta", cabin: "Delta One", gw: "HND", via: "via ATL", dur: "18h 55m",
    points: 120000, programId: "delta", fees: 45, cash: 4650 },
];

export const FLIGHTS_BACK = [
  { id: "b1", airline: "JAL", cabin: "Business", gw: "KIX", via: "via LAX", dur: "16h 50m",
    points: 80000, programId: "alaska", fees: 68, cash: 4390 },
  { id: "b2", airline: "United", cabin: "Polaris Business", gw: "KIX", via: "via SFO", dur: "17h 20m",
    points: 88000, programId: "aeroplan", fees: 62, cash: 4180 },
  { id: "b3", airline: "Hawaiian/Alaska", cabin: "Economy", gw: "KIX", via: "via HNL", dur: "19h 45m",
    points: 45000, programId: "alaska", fees: 38, cash: 980 },
  { id: "b4", airline: "ANA", cabin: "Business", gw: "HND", via: "via ORD", dur: "17h 10m",
    points: 60000, programId: "virginAtlantic", fees: 280, cash: 4350 },
  { id: "b5", airline: "United", cabin: "Economy (saver)", gw: "KIX", via: "via SFO", dur: "18h 30m",
    points: 44000, programId: "united", fees: 6, cash: 995 },
];
