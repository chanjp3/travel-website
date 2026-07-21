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
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: CORS });

/* ── Travelpayouts (Aviasales + Hotellook) ─────────────────────────────── */

/** TP calls are cached at the edge for 30 min — fares are themselves cached
 *  market data, and connection-building + the alternate-airport advisor
 *  re-ask the same pairs. Without this, one desk load can burst past
 *  Travelpayouts' rate limit and 429 even routes with daily flights. */
async function tpGet(urlStr, token) {
  const cache = globalThis.caches?.default;
  if (cache) {
    const hit = await cache.match(urlStr);
    if (hit) return hit.json();
  }
  const res = await fetch(urlStr, { headers: { "X-Access-Token": token, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Travelpayouts failed: ${res.status}`);
  const j = await res.json();
  if (cache) {
    await cache.put(urlStr, new Response(JSON.stringify(j), {
      headers: { "Cache-Control": "public, max-age=1800", "Content-Type": "application/json" },
    }));
  }
  return j;
}

/** Aviasales cached market fares (economy) → the app's flight-offer shape.
 *  With `ret`, queries the round-trip cache instead — far richer than the
 *  one-way cache (it's what people actually search), so it's the fallback
 *  when a one-way lookup for a route with daily flights comes back empty.
 *  Round-trip offers carry the FULL both-ways price and roundTrip: true. */
async function tpFlights(env, q, ret = null) {
  const u = new URL("https://api.travelpayouts.com/aviasales/v3/prices_for_dates");
  u.searchParams.set("origin", q.from);
  u.searchParams.set("destination", q.to);
  u.searchParams.set("departure_at", q.date);
  if (ret) u.searchParams.set("return_at", ret);
  u.searchParams.set("one_way", ret ? "false" : "true");
  u.searchParams.set("direct", "false");
  u.searchParams.set("unique", "false");
  u.searchParams.set("sorting", "price");
  u.searchParams.set("limit", "10");
  u.searchParams.set("currency", "usd");
  const j = await tpGet(u.toString(), env.TRAVELPAYOUTS_TOKEN);
  return (j.data ?? []).map((o) => {
    // Round-trip durations cover both directions — don't present them as
    // one leg's flight time.
    const min = ret ? null : o.duration ?? null;
    return {
      price: +o.price,
      carrier: o.airline,
      cabin: "ECONOMY", // cached Aviasales fares are economy market prices
      transfers: o.transfers ?? 0,
      durMin: min,
      ...(ret ? { roundTrip: true } : {}),
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

/* ── Duffel: real bookable itineraries ──────────────────────────────────
 * When DUFFEL_KEY is set, flight search returns actual offers — real
 * flights, times, and connections — instead of cached market fares.
 * Fails soft to the Travelpayouts path on any error. */
async function duffelFlights(env, q) {
  const res = await fetch("https://api.duffel.com/air/offer_requests?return_offers=true&supplier_timeout=9000", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.DUFFEL_KEY}`,
      "Duffel-Version": "v2", "Content-Type": "application/json", Accept: "application/json",
    },
    body: JSON.stringify({ data: {
      slices: [{ origin: q.from, destination: q.to, departure_date: q.date }],
      passengers: [{ type: "adult" }],
      cabin_class: q.cabin === "BUSINESS" ? "business" : "economy",
    } }),
  });
  if (!res.ok) throw new Error(`Duffel failed: ${res.status}`);
  const j = await res.json();
  const parseISODur = (iso) => {
    const m = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(iso ?? "");
    return m && (m[1] || m[2]) ? (+(m[1] ?? 0)) * 60 + (+(m[2] ?? 0)) : null;
  };
  return (j.data?.offers ?? [])
    .map((o) => {
      const sl = o.slices?.[0];
      const segs = sl?.segments ?? [];
      if (!segs.length || !(+o.total_amount > 0)) return null;
      const durMin = parseISODur(sl.duration)
        ?? Math.round((Date.parse(segs[segs.length - 1].arriving_at) - Date.parse(segs[0].departing_at)) / 60000);
      return {
        price: +o.total_amount,
        currency: o.total_currency,
        carrier: o.owner?.iata_code ?? segs[0].marketing_carrier?.iata_code,
        cabin: q.cabin === "BUSINESS" ? "BUSINESS" : "ECONOMY",
        transfers: segs.length - 1,
        durMin,
        bookable: true,
        // Sandbox tokens return simulated flights (fake nonstops, the "ZZ"
        // carrier) — flag them so the UI never presents them as real.
        ...(env.DUFFEL_KEY.startsWith("duffel_test") ? { testData: true } : {}),
        itineraries: [{
          duration: durMin != null ? isoDur(durMin) : null,
          segments: segs.map((s) => ({
            from: s.origin?.iata_code, to: s.destination?.iata_code,
            dep: s.departing_at, arr: s.arriving_at,
            carrier: s.marketing_carrier?.iata_code ?? "", num: s.marketing_carrier_flight_number ?? "",
          })),
        }],
      };
    })
    .filter((o) => o && (!o.currency || o.currency === "USD"))
    .sort((a, b) => a.price - b.price)
    .slice(0, 10);
}

/* ── Built connections ──────────────────────────────────────────────────
 * When the fare cache has no direct answer for a route (TPA→NRT), don't
 * give up: price origin→hub and hub→destination separately through the
 * hubs the client nominated (?via=SEA,ORD,…) and stitch the two cheapest
 * compatible fares into one plan with a real, verified layover. These are
 * two separate tickets (self-transfer), and every result says so.
 */
const isoDur = (min) => `PT${Math.floor(min / 60)}H${min % 60}M`;
const offsetOf = (ts) => /([+-]\d{2}:\d{2}|Z)$/.exec(ts ?? "")?.[1] ?? "Z";
function localISO(epochMs, offset) {
  const shift = offset === "Z" ? 0
    : (offset[0] === "-" ? -1 : 1) * (+offset.slice(1, 3) * 60 + +offset.slice(4, 6));
  return new Date(epochMs + shift * 60000).toISOString().slice(0, 19) + (offset === "Z" ? "Z" : offset);
}

/** Stitch per-hub leg fares into ranked self-transfer itineraries.
 *  Exported for tests. Layover window: ≥2h (bags must be recollected),
 *  ≤26h (allows a next-morning second leg, flagged as overnight). */
export function synthesizeConnections(hubLegs, { minLayoverMin = 120, maxLayoverMin = 26 * 60 } = {}) {
  const usable = (list) => (list ?? []).filter(
    (o) => o.price > 0 && o.durMin && o.itineraries?.[0]?.segments?.[0]?.dep
  );
  const out = [];
  for (const { hub, leg1, leg2 } of hubLegs) {
    const first = usable(leg1).sort((a, b) => a.price - b.price)[0];
    if (!first) continue;
    const s1 = first.itineraries[0].segments[0];
    const dep1 = Date.parse(s1.dep);
    if (!Number.isFinite(dep1)) continue;
    const arr1 = dep1 + first.durMin * 60000;
    const best = usable(leg2)
      .map((o) => ({ o, dep2: Date.parse(o.itineraries[0].segments[0].dep) }))
      .filter((x) => Number.isFinite(x.dep2))
      .map((x) => ({ ...x, layover: Math.round((x.dep2 - arr1) / 60000) }))
      .filter((x) => x.layover >= minLayoverMin && x.layover <= maxLayoverMin)
      .sort((a, b) => a.o.price - b.o.price || a.layover - b.layover)[0];
    if (!best) continue;
    const s2 = best.o.itineraries[0].segments[0];
    out.push({
      price: Math.round((first.price + best.o.price) * 100) / 100,
      carrier: first.carrier,
      cabin: "ECONOMY",
      transfers: (first.transfers ?? 0) + (best.o.transfers ?? 0) + 1,
      selfTransfer: true,
      via: hub,
      layoverMin: best.layover,
      overnight: best.layover >= 12 * 60,
      itineraries: [{
        duration: isoDur(first.durMin + best.layover + best.o.durMin),
        segments: [
          { ...s1, to: hub, arr: localISO(arr1, offsetOf(s2.dep)) },
          { ...s2, from: hub },
        ],
      }],
    });
  }
  return out.sort((a, b) => a.price - b.price).slice(0, 4);
}

async function connectionOffers(env, q) {
  const hubs = (q.via ?? "").split(",").map((s) => s.trim().toUpperCase())
    .filter((h) => /^[A-Z]{3}$/.test(h) && h !== q.from && h !== q.to)
    .slice(0, 6);
  if (!hubs.length) return [];
  const next = new Date(q.date + "T00:00:00Z");
  next.setUTCDate(next.getUTCDate() + 1);
  const nextDate = next.toISOString().slice(0, 10);
  const safe = (p) => p.catch(() => []);
  // Probe hubs three at a time (≤9 provider calls in flight) so a burst
  // can't trip Travelpayouts' rate limit and poison unrelated lookups.
  const hubLegs = [];
  for (let i = 0; i < hubs.length; i += 3) {
    hubLegs.push(...await Promise.all(hubs.slice(i, i + 3).map(async (hub) => {
      const [leg1, leg2a, leg2b] = await Promise.all([
        safe(tpFlights(env, { from: q.from, to: hub, date: q.date })),
        safe(tpFlights(env, { from: hub, to: q.to, date: q.date })),
        safe(tpFlights(env, { from: hub, to: q.to, date: nextDate })),
      ]);
      return { hub, leg1, leg2: [...leg2a, ...leg2b] };
    })));
  }
  return synthesizeConnections(hubLegs);
}

/* ── Seats.aero award search ────────────────────────────────────────────── */

async function seatsGet(env, url) {
  const res = await fetch(url, {
    headers: { "Partner-Authorization": env.SEATSAERO_KEY, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Seats.aero failed: ${res.status}`);
  return res.json();
}

const shiftDate = (d, n) => {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

/** Cached award availability for a route+date, one row per program.
 *  Cabin blocks only when bookable. flexDays widens the window (±N) so
 *  the app can say "no space on your date — but there IS on the 17th". */
async function seatsSearch(env, from, to, date, flexDays = 0) {
  const su = new URL("https://seats.aero/partnerapi/search");
  su.searchParams.set("origin_airport", from);
  su.searchParams.set("destination_airport", to);
  su.searchParams.set("start_date", flexDays ? shiftDate(date, -flexDays) : date);
  su.searchParams.set("end_date", flexDays ? shiftDate(date, flexDays) : date);
  su.searchParams.set("take", flexDays ? "300" : "100");
  const j = await seatsGet(env, su.toString());
  const cabin = (a, c) => (a[`${c}Available`] ? {
    miles: +a[`${c}MileageCost`] || null,
    taxes: a[`${c}TotalTaxes`] != null ? Math.round(+a[`${c}TotalTaxes`]) / 100 : null,
    currency: a.TaxesCurrency ?? "USD",
    seats: a[`${c}RemainingSeats`] ?? null,
    direct: !!a[`${c}Direct`],
    airlines: a[`${c}Airlines`] ?? "",
  } : null);
  return (j.data ?? []).map((a) => ({
    id: a.ID, source: a.Source, date: a.Date,
    economy: cabin(a, "Y"), business: cabin(a, "J"),
  }));
}

/** Enrich the cheapest availability rows with flight-level detail (real
 *  departure/arrival times, flight numbers, duration) from the trips
 *  endpoint. Detail is a bonus — any failure leaves the row date-level. */
async function attachTripDetail(env, rows, max = 4) {
  const score = (r) => Math.min(r.economy?.miles ?? 9e9, r.business?.miles ?? 9e9);
  const cands = rows.filter((r) => (r.economy || r.business) && r.id)
    .sort((a, b) => score(a) - score(b)).slice(0, max);
  await Promise.all(cands.map(async (r) => {
    try {
      const j = await seatsGet(env, `https://seats.aero/partnerapi/trips/${r.id}`);
      for (const ck of ["economy", "business"]) {
        const block = r[ck];
        if (!block) continue;
        const t = (j.data ?? [])
          .filter((t) => (t.Cabin ?? "").toLowerCase() === ck && +t.MileageCost)
          .sort((a, b) => +a.MileageCost - +b.MileageCost)[0];
        if (t) Object.assign(block, {
          dep: t.DepartsAt ?? null, arr: t.ArrivesAt ?? null,
          flightNos: t.FlightNumbers ?? null,
          durMin: t.TotalDuration ?? null,
          stops: t.Stops ?? null,
        });
      }
    } catch { /* keep date-level block */ }
  }));
}

/** No award space on the direct pair → check the same hubs the cash search
 *  uses for a SAME-PROGRAM pair of bookings (origin→hub + hub→destination,
 *  same day). One program keeps the funding story simple: one transfer,
 *  two award bookings. Availability is date-level, so plans are labeled as
 *  two separate tickets. */
async function awardConnections(env, q) {
  const hubs = (q.via ?? "").split(",").map((s) => s.trim().toUpperCase())
    .filter((h) => /^[A-Z]{3}$/.test(h) && h !== q.from && h !== q.to)
    .slice(0, 6);
  if (!hubs.length) return [];
  const out = [];
  for (let i = 0; i < hubs.length; i += 3) {
    await Promise.all(hubs.slice(i, i + 3).map(async (hub) => {
      const [l1, l2] = await Promise.all([
        seatsSearch(env, q.from, hub, q.date).catch(() => []),
        seatsSearch(env, hub, q.to, q.date).catch(() => []),
      ]);
      const bestBy = (rows, ck) => {
        const m = {};
        for (const r of rows) {
          const b = r[ck];
          if (b?.miles && (!m[r.source] || b.miles < m[r.source].miles)) m[r.source] = b;
        }
        return m;
      };
      for (const ck of ["economy", "business"]) {
        const a = bestBy(l1, ck), b = bestBy(l2, ck);
        for (const source of Object.keys(a)) {
          if (!b[source]) continue;
          out.push({
            source, date: q.date, via: hub,
            economy: null, business: null,
            [ck]: {
              miles: a[source].miles + b[source].miles,
              taxes: Math.round(((a[source].taxes ?? 0) + (b[source].taxes ?? 0)) * 100) / 100,
              currency: a[source].currency,
              seats: Math.min(a[source].seats ?? 9, b[source].seats ?? 9),
              direct: false,
              airlines: [a[source].airlines, b[source].airlines].filter(Boolean).join(" + "),
            },
          });
        }
      }
    }));
  }
  return out;
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
        // Real bookable offers first, when Duffel is configured with a LIVE
        // token. Sandbox tokens are ignored — simulated flights must never
        // shadow the real cached market fares below.
        let real = [];
        if (env.DUFFEL_KEY && !env.DUFFEL_KEY.startsWith("duffel_test")) {
          try { real = await duffelFlights(env, q); } catch { /* cached-fare path below */ }
        }
        if (real.length) {
          // A user-forced layover still builds through the chosen hub too.
          if (q.force && q.via && env.TRAVELPAYOUTS_TOKEN) {
            return json([...real, ...(await connectionOffers(env, q))]);
          }
          return json(real);
        }
        if (!env.AMADEUS_KEY && env.TRAVELPAYOUTS_TOKEN) {
          // Escalating search: exact one-way → live round-trip fare for the
          // trip's real dates → connections built through hubs. Any answer
          // at a given level stops the escalation (no needless fan-out).
          // force=1 (a user-chosen layover) always builds through the hubs
          // and returns those plans alongside whatever the cache had.
          let offers = await tpFlights(env, q);
          if (!offers.length && q.ret) offers = await tpFlights(env, q, q.ret).catch(() => []);
          if (q.force && q.via) return json([...offers, ...(await connectionOffers(env, q))]);
          if (offers.length || !q.via) return json(offers);
          return json(await connectionOffers(env, q));
        }
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
      if (url.pathname === "/api/trips") {
        if (!env.MERIDIAN_TRIPS) {
          return json({ error: "trip storage not configured — create a KV namespace and bind it as MERIDIAN_TRIPS" }, 501);
        }
        if (req.method === "POST") {
          const body = await req.text();
          if (body.length > 120_000) return json({ error: "trip too large" }, 413);
          const alphabet = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
          let code = "";
          for (let attempt = 0; attempt < 5; attempt++) {
            const buf = new Uint8Array(8);
            crypto.getRandomValues(buf);
            code = [...buf].map((b) => alphabet[b % alphabet.length]).join("");
            if (!(await env.MERIDIAN_TRIPS.get(code))) break;
          }
          await env.MERIDIAN_TRIPS.put(code, body, { expirationTtl: 60 * 60 * 24 * 90 });
          return json({ code });
        }
        const saved = await env.MERIDIAN_TRIPS.get((q.code ?? "").toUpperCase().trim());
        if (!saved) return json({ error: "no trip found for that code (codes expire after 90 days)" }, 404);
        return new Response(saved, { headers: CORS });
      }
      if (url.pathname === "/api/awards") {
        if (!env.SEATSAERO_KEY) return json({ error: "seats.aero not configured" }, 501);
        const rows = await seatsSearch(env, q.from, q.to, q.date, Math.min(+q.flex || 0, 3));
        // Only the exact requested date counts as "the answer" — nearby-date
        // rows ride along so the app can offer a date shift.
        const exact = rows.filter((r) => r.date === q.date);
        const hasSpace = exact.some((r) => r.economy || r.business);
        if (hasSpace) {
          // Real times & flight numbers for the rows the app will show.
          if (q.detail) await attachTripDetail(env, exact);
          return json(rows);
        }
        // No direct award space that day → try two-booking plans via hubs.
        if (!q.via) return json(rows);
        return json([...rows, ...(await awardConnections(env, q))]);
      }
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: e.message }, 502);
    }
  },
};
