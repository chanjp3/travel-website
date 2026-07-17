/**
 * Cloudflare Worker — API proxy for Trip Architect.
 * Keeps Amadeus + Seats.aero credentials server-side (same pattern as the
 * WSA empty-legs worker). Endpoints:
 *   GET /api/locations?q=par            → city/airport autocomplete
 *   GET /api/flights?from=TPA&to=HND&date=2026-10-12&adults=1&cabin=BUSINESS
 *   GET /api/hotels?cityCode=TYO&checkIn=2026-10-13&checkOut=2026-10-16
 *   GET /api/hotels?lat=50.81&lon=-0.37&checkIn=…&checkOut=…   (towns)
 *   GET /api/awards?from=TPA&to=HND&date=2026-10-12
 *       → Seats.aero cached award availability for that exact route+date
 * Secrets: AMADEUS_KEY, AMADEUS_SECRET, SEATSAERO_KEY (Partner API).
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
        // Small towns arrive as lat/lon (no IATA city code) — search by geocode
        // with no star filter; cities use the code with a 4–5★ shortlist.
        const list = q.lat && q.lon
          ? await amadeus(env, "/v1/reference-data/locations/hotels/by-geocode", {
              latitude: q.lat, longitude: q.lon, radius: 12, radiusUnit: "KM",
            })
          : await amadeus(env, "/v1/reference-data/locations/hotels/by-city", {
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
      if (url.pathname === "/api/awards") {
        if (!env.SEATSAERO_KEY) return json({ error: "seats.aero not configured" }, 501);
        const su = new URL("https://seats.aero/partnerapi/search");
        su.searchParams.set("origin_airport", q.from);
        su.searchParams.set("destination_airport", q.to);
        su.searchParams.set("start_date", q.date);
        su.searchParams.set("end_date", q.date);
        su.searchParams.set("take", "100");
        const res = await fetch(su, {
          headers: { "Partner-Authorization": env.SEATSAERO_KEY, Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`Seats.aero search failed: ${res.status}`);
        const j = await res.json();
        // One row per availability object; cabin blocks only when bookable.
        const cabin = (a, c) => (a[`${c}Available`] ? {
          miles: +a[`${c}MileageCost`] || null,
          taxes: a[`${c}TotalTaxes`] != null ? Math.round(+a[`${c}TotalTaxes`]) / 100 : null,
          currency: a.TaxesCurrency ?? "USD",
          seats: a[`${c}RemainingSeats`] ?? null,
          direct: !!a[`${c}Direct`],
          airlines: a[`${c}Airlines`] ?? "",
        } : null);
        return json((j.data ?? []).map((a) => ({
          source: a.Source, date: a.Date,
          economy: cabin(a, "Y"), business: cabin(a, "J"),
        })));
      }
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: e.message }, 502);
    }
  },
};
