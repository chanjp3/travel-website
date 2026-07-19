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

/** Like get(), but reports WHY a call failed instead of a silent null. */
async function getDetailed(path, params) {
  if (!BASE) return { data: null, error: "not-configured" };
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        if (j?.error) msg += ` · ${String(j.error).slice(0, 140)}`;
      } catch { /* body wasn't JSON */ }
      return { data: null, error: msg };
    }
    return { data: await res.json(), error: null };
  } catch (e) {
    return {
      data: null,
      error: e?.name === "TimeoutError" || e?.name === "AbortError" ? "timed out after 12s" : "network error — worker unreachable",
    };
  }
}

/** Hotels with failure detail — the city tour shows the real reason. */
export const liveHotelsDetailed = (city, checkIn, checkOut) =>
  getDetailed("/api/hotels", { lat: city.lat, lon: city.lon, name: city.name, cityCode: city.custom ? null : city.cc ?? city.air, checkIn, checkOut });

export const searchLocations = (q) => get("/api/locations", { q });
export const liveFlights = (from, to, date, cabin) =>
  get("/api/flights", { from, to, date, cabin: cabin === "Business" ? "BUSINESS" : "ECONOMY" });

/** Seats.aero award availability for a route+date (null when not configured). */
export const liveAwards = (from, to, date) => get("/api/awards", { from, to, date });

/** Hotels for a city object. Name drives Hotellook lookup (works for any
 *  town); code/geocode serve the Amadeus branch when that's configured. */
export const liveHotels = (city, checkIn, checkOut) =>
  get("/api/hotels", { lat: city.lat, lon: city.lon, name: city.name, cityCode: city.custom ? null : city.cc ?? city.air, checkIn, checkOut });

/**
 * Reverse geocoder — Nominatim (OSM), keyless, browser-side, low volume.
 * Powers click-to-pick on the map: a click at country zoom drills in, a
 * click at city zoom resolves to the town under the cursor. Fails soft.
 */
export async function reverseGeocode(lat, lon, zoomedIn) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=${zoomedIn ? 10 : 5}&accept-language=en`,
      { signal: AbortSignal.timeout(6000), headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const j = await res.json();
    const a = j.address ?? {};
    return {
      name: a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? a.state ?? j.name ?? null,
      country: a.country ?? null,
    };
  } catch { return null; }
}

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
