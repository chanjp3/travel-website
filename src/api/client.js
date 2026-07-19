/**
 * API client. If VITE_API_BASE is set (your deployed Worker URL), live
 * Amadeus data is available; otherwise the app runs entirely on the
 * built-in estimate engines. All functions fail soft back to estimates.
 */
const BASE = import.meta.env.VITE_API_BASE ?? "";
export const liveMode = () => !!BASE;

async function get(path, params) {
  if (!BASE) return null;
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export const searchLocations = (q) => get("/api/locations", { q });
export const liveFlights = (from, to, date, cabin) =>
  get("/api/flights", { from, to, date, cabin: cabin === "Business" ? "BUSINESS" : "ECONOMY" });

/** Seats.aero award availability for a route+date (null when not configured). */
export const liveAwards = (from, to, date) => get("/api/awards", { from, to, date });

/** Hotels for a city object. Name drives Hotellook lookup (works for any
 *  town); code/geocode serve the Amadeus branch when that's configured. */
export const liveHotels = (city, checkIn, checkOut) =>
  city.custom
    ? get("/api/hotels", { lat: city.lat, lon: city.lon, name: city.name, checkIn, checkOut })
    : get("/api/hotels", { cityCode: city.cc ?? city.air, name: city.name, checkIn, checkOut });

/**
 * Town geocoder — Open-Meteo, free and keyless, called directly from the
 * browser. Lets the builder accept any town on Earth (Worthing, Arundel…)
 * even before the Amadeus worker is deployed. Fails soft to [].
 */
export async function geoSearch(q) {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return [];
    return (await res.json()).results ?? [];
  } catch { return []; }
}
