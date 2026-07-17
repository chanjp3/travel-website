/**
 * Flight engine — builds concrete options for any leg between two cities.
 * Handles connections: if the origin isn't a hub and the leg is long-haul,
 * routing goes via the best-positioned hub (e.g., TPA has no Japan nonstop,
 * so TPA → via ORD/DFW/ATL → HND).
 *
 * Every option is an ESTIMATE (est: true) until live data replaces it:
 * cash via Amadeus (src/api/client.js), awards via Seats.aero.
 */
import { WORLD, cityById } from "../data/world.js";
import { km, flightMin, cashEst, pairKey } from "./geo.js";
import { AWARD_CHARTS, fallbackAwards } from "../data/awardCharts.js";

const HUBS = WORLD.filter((c) => c.hub);

/** Pick the connection hub minimizing total detour distance. */
function bestHub(from, to) {
  let best = null, bestD = Infinity;
  for (const h of HUBS) {
    if (h.id === from.id || h.id === to.id) continue;
    const d = km(from, h) + km(h, to);
    if (d < bestD) { bestD = d; best = h; }
  }
  return { hub: best, totalKm: bestD };
}

/** Physical routing for a leg: nonstop if plausible, else one connection. */
export function routing(fromId, toId) {
  const from = cityById[fromId], to = cityById[toId];
  const direct = km(from, to);
  // Long-haul from a non-hub origin, or very long thin routes → connect.
  const needsConnection = (direct > 5500 && !from.hub && !to.hub) ||
                          (direct > 7000 && !(from.hub && to.hub)) ||
                          (direct > 3000 && !from.hub && !to.hub);
  if (!needsConnection) {
    return { stops: 0, via: null, distKm: direct, min: flightMin(direct) };
  }
  const { hub, totalKm } = bestHub(from, to);
  return {
    stops: 1, via: hub, distKm: totalKm,
    min: flightMin(km(from, hub)) + 75 + flightMin(km(hub, to)), // 75m connection
  };
}

const hmStr = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;

/** Full option list for a leg: cash rows + award rows from the charts. */
export function legOptions(fromId, toId, { cabins = ["Economy", "Business"] } = {}) {
  const from = cityById[fromId], to = cityById[toId];
  const r = routing(fromId, toId);
  const viaStr = r.via ? `via ${r.via.air}` : "nonstop";
  const pk = pairKey(from.region, to.region);
  const chart = AWARD_CHARTS[pk] ?? fallbackAwards(r.distKm);

  const opts = [];
  for (const c of chart) {
    if (!cabins.includes(c.cabin)) continue;
    opts.push({
      id: `${fromId}-${toId}-${c.programId}-${c.cabin}`,
      airline: c.airline, cabin: c.cabin, programId: c.programId,
      points: c.pts, fees: c.fees,
      cash: cashEst(r.distKm, c.cabin),
      via: viaStr, dur: hmStr(r.min), stops: r.stops, est: true,
      fallback: !!c.fallback,
    });
  }
  // Pure-cash rows so the comparison exists even without award coverage.
  for (const cab of cabins) {
    opts.push({
      id: `${fromId}-${toId}-cash-${cab}`,
      airline: "Best cash fare", cabin: cab, programId: null,
      points: null, fees: 0, cash: cashEst(r.distKm, cab),
      via: viaStr, dur: hmStr(r.min), stops: r.stops, est: true, cashOnly: true,
    });
  }
  opts.sort((a, b) => (a.cabin === b.cabin ? (a.points ?? 9e9) - (b.points ?? 9e9) : a.cabin === "Economy" ? -1 : 1));
  return { routing: r, options: opts };
}
