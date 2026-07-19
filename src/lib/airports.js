/** Airport lookups over the atlas dataset — powers alternate-gateway logic. */
import { AIRPORTS_RAW } from "../data/atlas/airports.js";
import { km } from "./geo.js";

export const AIRPORTS = AIRPORTS_RAW.map((a) => ({
  iata: a[0], name: a[1], lat: a[2], lon: a[3], cc: a[4], city: a[5] || a[1], large: a[6] === 1,
}));
export const airportByIata = new Map(AIRPORTS.map((a) => [a.iata, a]));

/**
 * Large airports within reach of a CITY (not of the airport): "alternatives
 * less than ~30 min from the destination". maxKm 30 ≈ half an hour of urban
 * ground transfer; HND (18 km from central Tokyo) qualifies, NRT (60 km)
 * would not.
 */
export function alternatesNearCity(city, excludeIata, maxKm = 30) {
  if (!city?.lat) return [];
  return AIRPORTS
    .filter((a) => a.large && a.iata !== excludeIata && km(city, a) <= maxKm)
    .map((a) => ({ ...a, distKm: Math.round(km(city, a)), etaMin: Math.round(km(city, a) * 1.4) }))
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, 2);
}
