/**
 * Cloudflare Worker — API proxy for Trip Architect.
 * Keeps Amadeus credentials server-side (same pattern as the WSA
 * empty-legs worker). Endpoints:
 *   GET /api/locations?q=par            → city/airport autocomplete
 *   GET /api/flights?from=TPA&to=HND&date=2026-10-12&adults=1&cabin=BUSINESS
 *   GET /api/hotels?cityCode=TYO&checkIn=2026-10-13&checkOut=2026-10-16
 */
let tokenCache = { token: null, exp: 0 };

async function amadeusToken(env) {
  if (tokenCache.token && Date.now() < tokenCache.exp - 60000) return tokenCache.token;
  const res = await fetch(`${env.AMADEUS_BASE}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${env.AMADEUS_KEY}&client_secret=${env.AMADEUS_SECRET}`,
  });
  if (!res.ok) throw new Error(`Amadeus auth failed: ${res.status}`);
  const j = await res.json();
  tokenCache = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return tokenCache.token;
}

async function amadeus(env, path, params) {
  const token = await amadeusToken(env);
  const url = new URL(env.AMADEUS_BASE + path);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Amadeus ${path} failed: ${res.status}`);
  return res.json();
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: CORS });

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    const q = Object.fromEntries(url.searchParams);
    try {
      if (url.pathname === "/api/locations") {
        const r = await amadeus(env, "/v1/reference-data/locations", {
          keyword: q.q, subType: "CITY,AIRPORT", "page[limit]": 8,
        });
        return json(r.data?.map((d) => ({
          name: d.name, iata: d.iataCode, city: d.address?.cityName,
          country: d.address?.countryName, lat: d.geoCode?.latitude, lon: d.geoCode?.longitude,
          type: d.subType,
        })) ?? []);
      }
      if (url.pathname === "/api/flights") {
        const r = await amadeus(env, "/v2/shopping/flight-offers", {
          originLocationCode: q.from, destinationLocationCode: q.to,
          departureDate: q.date, adults: q.adults ?? 1,
          travelClass: q.cabin, currencyCode: "USD", max: 10,
        });
        return json(r.data?.map((o) => ({
          price: +o.price.grandTotal,
          carrier: o.validatingAirlineCodes?.[0],
          itineraries: o.itineraries.map((it) => ({
            duration: it.duration,
            segments: it.segments.map((s) => ({
              from: s.departure.iataCode, to: s.arrival.iataCode,
              dep: s.departure.at, arr: s.arrival.at, carrier: s.carrierCode, num: s.number,
            })),
          })),
        })) ?? []);
      }
      if (url.pathname === "/api/hotels") {
        const list = await amadeus(env, "/v1/reference-data/locations/hotels/by-city", {
          cityCode: q.cityCode, radius: 10, radiusUnit: "KM", ratings: "4,5",
        });
        const ids = (list.data ?? []).slice(0, 20).map((h) => h.hotelId).join(",");
        if (!ids) return json([]);
        const offers = await amadeus(env, "/v3/shopping/hotel-offers", {
          hotelIds: ids, checkInDate: q.checkIn, checkOutDate: q.checkOut, adults: q.adults ?? 2, currency: "USD",
        });
        return json(offers.data?.map((h) => ({
          name: h.hotel?.name, id: h.hotel?.hotelId,
          price: +h.offers?.[0]?.price?.total || null,
          lat: h.hotel?.latitude, lon: h.hotel?.longitude,
        })) ?? []);
      }
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: e.message }, 502);
    }
  },
};
