/**
 * Connection-hub picker. When a route has no direct cached fare (TPA→NRT),
 * the worker can build the journey itself — price origin→hub and hub→dest
 * separately and stitch them into one plan with a real layover. This module
 * chooses WHICH hubs are worth trying: major transfer airports that lie
 * close to the great-circle path, ranked by detour factor.
 */
import { airportByIata } from "./airports.js";
import { km } from "./geo.js";

/** Major transfer airports with broad connectivity, worldwide. */
const HUB_IATAS = [
  // North America
  "ATL", "ORD", "DFW", "DEN", "LAX", "SFO", "SEA", "JFK", "EWR", "IAD",
  "BOS", "IAH", "MIA", "CLT", "MSP", "DTW", "PHX", "SLC", "HNL", "ANC",
  "YYZ", "YVR", "YUL", "MEX", "PTY",
  // South America
  "BOG", "LIM", "GRU", "SCL", "EZE",
  // Europe
  "LHR", "CDG", "FRA", "AMS", "MAD", "LIS", "FCO", "ZRH", "VIE", "MUC",
  "IST", "KEF", "HEL", "CPH", "OSL", "ARN", "DUB", "BRU", "WAW", "ATH",
  // Middle East & Africa
  "DOH", "DXB", "AUH", "TLV", "JED", "RUH", "CAI", "ADD", "NBO", "JNB",
  "CPT", "LOS", "ACC", "CMN",
  // Asia & Oceania
  "DEL", "BOM", "CMB", "BKK", "SIN", "KUL", "CGK", "SGN", "HAN", "MNL",
  "HKG", "TPE", "ICN", "NRT", "HND", "PVG", "PEK", "CAN", "SYD", "MEL",
  "BNE", "PER", "AKL", "NAN", "PPT",
];

/**
 * Hubs worth trying for from→to, best detour first. A hub qualifies when
 * routing through it stretches the trip by <35% over the direct great
 * circle — via SEA for TPA→NRT is a 0.3% detour, via LHR would be 40%+.
 * Short hops (<400 km) never need a built connection.
 */
export function connectionHubs(fromIata, toIata, max = 6) {
  const o = airportByIata.get(fromIata);
  const d = airportByIata.get(toIata);
  if (!o || !d) return [];
  const direct = km(o, d);
  if (direct < 400) return [];
  return HUB_IATAS
    .filter((h) => h !== fromIata && h !== toIata)
    .map((h) => {
      const ap = airportByIata.get(h);
      return ap ? { h, detour: (km(o, ap) + km(ap, d)) / direct } : null;
    })
    .filter((x) => x && x.detour < 1.35)
    .sort((a, b) => a.detour - b.detour)
    .slice(0, max)
    .map((x) => x.h);
}
