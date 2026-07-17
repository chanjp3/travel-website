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
export const liveHotels = (cityCode, checkIn, checkOut) =>
  get("/api/hotels", { cityCode, checkIn, checkOut });
