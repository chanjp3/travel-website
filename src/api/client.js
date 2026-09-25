/**
 * API client. If VITE_API_BASE is set (your deployed Worker URL), live
 * Amadeus data is available; otherwise the app runs entirely on the
 * built-in estimate engines. All functions fail soft back to estimates.
 */
import { connectionHubs } from "../lib/hubs.js";

const BASE = import.meta.env.VITE_API_BASE ?? "";
export const liveMode = () => !!BASE;

/** Why the worker last held back a paid lookup, per API ("signin",
 *  "user-cap", "global-cap") — null when the last call ran in full. */
const limits = {};
export const liveLimit = (kind) => limits[kind] ?? null;
const noteLimit = (path, res, params) => {
  // only the trip's real leg lookups count — advisor probes never spend
  // metered quota, so they'd just wipe the answer
  if (params.deep || params.detail) limits[path.split("/")[2]] = res.headers.get("X-Meridian-Limit");
};

async function get(path, params, timeoutMs = 12000) {
  if (!BASE) return null;
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  try {
    const res = await fetch(url, { headers: authHeaders(), signal: AbortSignal.timeout(timeoutMs) });
    noteLimit(path, res, params);
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
    const res = await fetch(url, { headers: authHeaders(), signal: AbortSignal.timeout(timeoutMs) });
    noteLimit(path, res, params);
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

/* ── Account sign-in (Google via the worker) ─────────────────────────── */
export const authToken = () => { try { return localStorage.getItem("meridian.auth"); } catch { return null; } };
export const authLogout = () => { try { localStorage.removeItem("meridian.auth"); } catch { /* ignore */ } };
export const authLoginUrl = () =>
  BASE ? `${BASE}/api/auth/login?to=${encodeURIComponent(location.origin + location.pathname)}` : null;
/** Pull a fresh session token out of the OAuth return fragment. */
export function captureAuthFromHash() {
  if (!location.hash.startsWith("#token=")) return false;
  try { localStorage.setItem("meridian.auth", location.hash.slice(7)); } catch { /* ignore */ }
  history.replaceState(null, "", location.pathname + location.search);
  return true;
}
const authHeaders = () => (authToken() ? { Authorization: `Bearer ${authToken()}` } : {});
/** {status: 200, user} | {status: 401 signed out} | {status: 501 not set up} */
export async function authMe() {
  if (!BASE) return { status: 501 };
  try {
    const res = await fetch(new URL("/api/auth/me", BASE), { headers: authHeaders(), signal: AbortSignal.timeout(8000) });
    if (res.ok) return { status: 200, user: await res.json() };
    return { status: res.status };
  } catch { return { status: 0 }; }
}
/** Remove this account's saved trips and trip index from the cloud. */
export async function deleteAccountData() {
  if (!BASE || !authToken()) return { ok: false };
  try {
    const res = await fetch(new URL("/api/auth/delete", BASE), { method: "POST", headers: authHeaders(), signal: AbortSignal.timeout(15000) });
    return res.ok ? { ok: true, ...(await res.json()) } : { ok: false };
  } catch { return { ok: false }; }
}

/** Plain-language reasons the worker held back live data (null = none). */
export function limitNotes() {
  const f = limits.flights, a = limits.awards;
  if (f === "signin" || a === "signin") return { signin: true, lines: [] };
  const lines = [];
  if (f === "user-cap") lines.push("You've used today's live Google Flights searches — showing cached fares until midnight UTC. Searches you've already run stay live for 30 minutes.");
  if (f === "global-cap") lines.push("Live Google Flights searches are at today's site-wide limit — showing cached fares until midnight UTC.");
  if (a === "awards-private") lines.push("Live award availability is invite-only for now — points estimates use published award charts.");
  return lines.length ? { signin: false, lines } : null;
}

export async function myTrips() {
  if (!BASE || !authToken()) return [];
  try {
    const res = await fetch(new URL("/api/trips/mine", BASE), { headers: authHeaders(), signal: AbortSignal.timeout(8000) });
    return res.ok ? await res.json() : [];
  } catch { return []; }
}

/** Cloud trip sync: save returns a short code, load fetches by code.
 *  Signed in, the save is also filed under your account. */
export async function saveTripCloud(data) {
  if (!BASE) return { code: null, error: "not-configured" };
  try {
    const res = await fetch(new URL("/api/trips", BASE), {
      method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(data), signal: AbortSignal.timeout(12000),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { code: null, error: j?.error ?? `HTTP ${res.status}` };
    return { code: j.code, error: null };
  } catch { return { code: null, error: "network error — worker unreachable" }; }
}
export const loadTripCloud = (code) => getDetailed("/api/trips", { code });

/** Freeze the current itinerary into a read-only snapshot; returns its id. */
export async function shareItinerary(snapshot) {
  if (!BASE) return { id: null, error: "not-configured" };
  try {
    const res = await fetch(new URL("/api/share", BASE), {
      method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(snapshot), signal: AbortSignal.timeout(12000),
    });
    const j = await res.json().catch(() => ({}));
    return res.ok ? { id: j.id, error: null } : { id: null, error: j?.error ?? `HTTP ${res.status}` };
  } catch { return { id: null, error: "network error — worker unreachable" }; }
}
export const loadShare = (id) => getDetailed("/api/share", { id });

/* ── Award watchlist (signed-in; re-checked daily by the worker) ──────── */
async function watchCall(path, method = "GET", body = null) {
  if (!BASE || !authToken()) return { data: null, error: "signin" };
  try {
    const res = await fetch(new URL(path, BASE), {
      method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...authHeaders() },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
    });
    const j = await res.json().catch(() => ({}));
    return res.ok ? { data: j, error: null } : { data: null, error: j?.error ?? `HTTP ${res.status}`, status: res.status };
  } catch { return { data: null, error: "network error — worker unreachable" }; }
}
export const watchList = () => watchCall("/api/watch");
export const watchAdd = (w) => watchCall("/api/watch", "POST", w);
export const watchRemove = (id) => watchCall(`/api/watch?id=${encodeURIComponent(id)}`, "DELETE");
export const watchCheck = (id) => watchCall(`/api/watch/check?id=${encodeURIComponent(id)}`, "POST");
export const watchSeen = (id) => watchCall(`/api/watch/seen?id=${encodeURIComponent(id)}`, "POST");

export const searchLocations = (q) => get("/api/locations", { q });

/** Flights for a route+date. `via` tells the worker which connection hubs
 *  to try if the fare cache has no direct answer — it then builds the
 *  journey itself (TPA→SEA + SEA→NRT) instead of returning nothing. */
const cabinCode = (cabin) =>
  cabin === "Business" ? "BUSINESS"
  : cabin === "First" ? "FIRST"
  : cabin === "Premium Economy" ? "PREMIUM_ECONOMY"
  : "ECONOMY";

/** `viaHub`: a user-chosen layover airport — the worker then ALWAYS builds
 *  a connection through it (force=1), alongside whatever the cache has. */
export const liveFlights = (from, to, date, cabin, ret = null, viaHub = null) =>
  get("/api/flights", {
    from, to, date, ret,
    cabin: cabinCode(cabin),
    via: viaHub ?? (connectionHubs(from, to).join(",") || null),
    force: viaHub ? 1 : null,
    deep: 1, // a real leg lookup — worth spending metered live-search quota
  }, 25000);

/** Cheap probe variant — no hub-building, one provider call. Used by the
 *  alternate-airport advisor and the connection check, which fire many
 *  speculative lookups; only the trip's two real legs earn the fan-out. */
export const liveFlightsProbe = (from, to, date, cabin) =>
  get("/api/flights", { from, to, date, cabin: cabinCode(cabin) });

/** Seats.aero award availability for a route+date (null when not configured).
 *  `via` lets the worker build two-booking plans through hubs when the
 *  direct pair has no space; `detail` fetches real times & flight numbers.
 *  `cabin` tells the worker which cabin actually answers the search — an
 *  empty wanted cabin escalates even when other cabins have cached seats. */
const awardCabinKey = (cabin) =>
  cabin === "Business" ? "business"
  : cabin === "First" ? "first"
  : cabin === "Premium Economy" ? "premium"
  : cabin === "Economy" ? "economy"
  : null;
export const liveAwards = (from, to, date, cabin = null) =>
  get("/api/awards", { from, to, date, detail: 1, flex: 2, cabin: awardCabinKey(cabin), via: connectionHubs(from, to).join(",") || null });

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
