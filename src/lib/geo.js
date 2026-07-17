/** Geo helpers: distance, flight-time and cash-fare estimation, regions. */
const R = 6371;
export function km(a, b) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Nonstop block time estimate in minutes. */
export const flightMin = (d) => Math.round(40 + (d / 785) * 60);

/** Cash fare estimate (USD, one-way, per person) by distance and cabin. */
export function cashEst(d, cabin) {
  const econ = Math.round(60 + d * (d > 5000 ? 0.115 : d > 1500 ? 0.13 : 0.19));
  if (cabin === "Business") return Math.round(econ * (d > 5000 ? 3.9 : 2.6));
  return econ;
}

/** Region pair key, order-independent: e.g. "NA|NEASIA". */
export const pairKey = (r1, r2) => [r1, r2].sort().join("|");
