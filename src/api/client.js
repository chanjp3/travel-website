/**
 * API client. If VITE_API_BASE is set (your deployed Worker URL), live
 * Amadeus data is available; otherwise the app runs entirely on the
 * built-in estimate engines. All functions fail soft back to estimates.
 */
import { connectionHubs } from "../lib/hubs.js";

const BASE = import.meta.env.VITE_API_BASE ?? "";
export const liveMode = () => !!BASE;

async function get(path, params, timeoutMs = 12000) {
  if (!BASE) return null;
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

/** Like get(), but reports WHY a call failed instead of a silent null. */
async function getDetailed(path, params, timeoutMs = 12000) {
  if (!BASE) return { data: null, error: "not-configured" };
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
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
      error: e?.name === "TimeoutError" || e?.name === "AbortError" ? `timed out after ${Math.round(timeoutMs/1000)}s` : "network error — worker unreachable",
    };
  }
}

/** Hotels with failure detail — the city tour shows the real reason. */
export const liveHotelsDetailed = (city, checkIn, checkOut, radius) =>
  getDetailed("/api/hotels", { lat: city.lat, lon: city.lon, name: city.name, cityCode: city.custom ? null : city.cc ?? city.air, checkIn, checkOut, radius }, 20000);

/** Cloud trip sync: save returns a short code, load fetches by code. */
export async function saveTripCloud(data) {
  if (!BASE) return { code: null, error: "not-configured" };
  try {
    const res = await fetch(new URL("/api/trips", BASE), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data), signal: AbortSignal.timeout(12000),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { code: null, error: j?.error ?? `HTTP ${res.status}` };
    return { code: j.code, error: null };
  } catch { return { code: null, error: "network error — worker unreachable" }; }
}
export const loadTripCloud = (code) => getDetailed("/api/trips", { code });

export const searchLocations = (q) => get("/api/locations", { q });

/** Flights for a route+date. `via` tells the worker which connection hubs
 *  to try if the fare cache has no direct answer — it then builds the
 *  journey itself (TPA→SEA + SEA→NRT) instead of returning nothing. */
/** `viaHub`: a user-chosen layover airport — the worker then ALWAYS builds
 *  a connection through it (force=1), alongside whatever the cache has. */
export const liveFlights = (from, to, date, cabin, ret = null, viaHub = null) =>
  get("/api/flights", {
    from, to, date, ret,
    cabin: cabin === "Business" ? "BUSINESS" : "ECONOMY",
    via: viaHub ?? (connectionHubs(from, to).join(",") || null),
    force: viaHub ? 1 : null,
  });

/** Cheap probe variant — no hub-building, one provider call. Used by the
 *  alternate-airport advisor and the connection check, which fire many
 *  speculative lookups; only the trip's two real legs earn the fan-out. */
export const liveFlightsProbe = (from, to, date, cabin) =>
  get("/api/flights", { from, to, date, cabin: cabin === "Business" ? "BUSINESS" : "ECONOMY" });

/** Seats.aero award availability for a route+date (null when not configured).
 *  `via` lets the worker build two-booking plans through hubs when the
 *  direct pair has no space; `detail` fetches real times & flight numbers. */
export const liveAwards = (from, to, date) =>
  get("/api/awards", { from, to, date, detail: 1, via: connectionHubs(from, to).join(",") || null });

/** Cheap single-call probe — no hub fan-out, no detail. For the advisor. */
export const liveAwardsProbe = (from, to, date) => get("/api/awards", { from, to, date });

/** Hotels for a city object. Name drives Hotellook lookup (works for any
 *  town); code/geocode serve the Amadeus branch when that's configured. */
export const liveHotels = (city, checkIn, checkOut) =>
  get("/api/hotels", { lat: city.lat, lon: city.lon, name: city.name, cityCode: city.custom ? null : city.cc ?? city.air, checkIn, checkOut }, 20000);

/** Forward POI geocoder (Nominatim) with an in-session cache — pins the
 *  city's main attractions at their real coordinates. Fails soft to null. */
const poiCache = new Map();
export async function searchPOI(q) {
  if (poiCache.has(q)) return poiCache.get(q);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=en&q=${encodeURIComponent(q)}`,
      { signal: AbortSignal.timeout(6000), headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const j = await res.json();
    const hit = j?.[0] ? { lat: +j[0].lat, lon: +j[0].lon } : null;
    poiCache.set(q, hit);
    return hit;
  } catch { return null; }
}

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
