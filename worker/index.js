/**
 * Cloudflare Worker — API proxy for Trip Architect.
 * Keeps provider credentials server-side. Endpoints:
 *   GET /api/locations?q=par            → city/airport autocomplete
 *   GET /api/flights?from=TPA&to=HND&date=2026-10-12&adults=1&cabin=BUSINESS
 *   GET /api/hotels?cityCode=TYO&name=Tokyo&checkIn=…&checkOut=…
 *   GET /api/hotels?lat=50.81&lon=-0.37&name=Worthing&checkIn=…&checkOut=…
 *   GET /api/awards?from=TPA&to=HND&date=2026-10-12
 *       → Seats.aero cached award availability for that exact route+date
 *
 * Providers (checked in this order per endpoint):
 *   TRAVELPAYOUTS_TOKEN — free tier. Aviasales cached market fares (economy).
 *   LITEAPI_KEY — hotel rates (liteapi.travel; free sandbox + prod keys).
 *     (Hotellook was discontinued by Travelpayouts in Oct 2025.)
 *   AMADEUS_KEY/SECRET — Enterprise API portal only since 2026-07-17
 *     (self-service portal decommissioned); branch kept for those keys.
 *   SEATSAERO_KEY — Seats.aero Partner API for live award space.
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

/* ── Travelpayouts (Aviasales + Hotellook) ─────────────────────────────── */

async function tpGet(urlStr, token) {
  const res = await fetch(urlStr, { headers: { "X-Access-Token": token, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Travelpayouts failed: ${res.status}`);
  return res.json();
}

/** Aviasales cached market fares (economy) → the app's flight-offer shape. */
async function tpFlights(env, q) {
  const u = new URL("https://api.travelpayouts.com/aviasales/v3/prices_for_dates");
  u.searchParams.set("origin", q.from);
  u.searchParams.set("destination", q.to);
  u.searchParams.set("departure_at", q.date);
  u.searchParams.set("one_way", "true");
  u.searchParams.set("direct", "false");
  u.searchParams.set("unique", "false");
  u.searchParams.set("sorting", "price");
  u.searchParams.set("limit", "10");
  u.searchParams.set("currency", "usd");
  const j = await tpGet(u.toString(), env.TRAVELPAYOUTS_TOKEN);
  return (j.data ?? []).map((o) => {
    const min = o.duration ?? null;
    return {
      price: +o.price,
      carrier: o.airline,
      cabin: "ECONOMY", // cached Aviasales fares are economy market prices
      transfers: o.transfers ?? 0,
      itineraries: [{
        duration: min != null ? `PT${Math.floor(min / 60)}H${min % 60}M` : null,
        segments: [{
          from: o.origin ?? q.from, to: o.destination ?? q.to,
          dep: o.departure_at, arr: null,
          carrier: o.airline, num: o.flight_number,
        }],
      }],
    };
  });
}

/** LiteAPI (liteapi.travel): geo hotel list → real-time rates for the stay.
 *  Hotellook was discontinued by Travelpayouts in Oct 2025; LiteAPI's free
 *  sandbox/prod keys replace it. Output shape is unchanged for the app. */
async function liteGet(url, key) {
  const res = await fetch(url, { headers: { "X-API-Key": key, Accept: "application/json" } });
  if (!res.ok) throw new Error(`LiteAPI failed: ${res.status}`);
  return res.json();
}
async function liteHotels(env, q) {
  const key = env.LITEAPI_KEY;
  const lu = new URL("https://api.liteapi.travel/v3.0/data/hotels");
  if (q.lat && q.lon) {
    lu.searchParams.set("latitude", q.lat);
    lu.searchParams.set("longitude", q.lon);
    // viewport-driven: the map's visible area sets the search radius
    lu.searchParams.set("distance", String(Math.min(30000, Math.max(1500, Math.round(+q.radius) || 15000))));
  } else if (q.name) {
    lu.searchParams.set("cityName", q.name);
  }
  lu.searchParams.set("limit", "12");
  const found = await liteGet(lu.toString(), key);
  const list = found.data ?? [];
  if (!list.length) return [];
  const meta = new Map(list.map((h) => [String(h.id), h]));

  const res = await fetch("https://api.liteapi.travel/v3.0/hotels/rates", {
    method: "POST",
    headers: { "X-API-Key": key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      hotelIds: list.map((h) => String(h.id)).slice(0, 12),
      checkin: q.checkIn, checkout: q.checkOut,
      occupancies: [{ adults: 2 }],
      currency: "USD", guestNationality: "US",
    }),
  });
  if (!res.ok) throw new Error(`LiteAPI rates failed: ${res.status}`);
  const rates = await res.json();
  const out = [];
  for (const r of rates.data ?? []) {
    let min = null;
    for (const rt of r.roomTypes ?? []) {
      for (const rate of rt.rates ?? []) {
        const amt = rate?.retailRate?.total?.[0]?.amount;
        if (amt != null && (min == null || amt < min)) min = amt;
      }
    }
    const h = meta.get(String(r.hotelId));
    if (h && min != null) {
      out.push({
        name: h.name, id: h.id, price: +min,
        stars: h.stars ?? null,
        rating: h.rating ?? null,               // guest review score (0–10)
        reviews: h.reviewCount ?? h.reviews ?? null,
        lat: h.latitude ?? null, lon: h.longitude ?? null,
      });
    }
  }
  return out.sort((a, b) => a.price - b.price).slice(0, 12);
}

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
        if (!env.AMADEUS_KEY && env.TRAVELPAYOUTS_TOKEN) return json(await tpFlights(env, q));
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
        if (!env.AMADEUS_KEY) {
          if (env.LITEAPI_KEY) return json(await liteHotels(env, q));
          return json({ error: "hotel provider not configured — set LITEAPI_KEY (free key at liteapi.travel)" }, 501);
        }
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
