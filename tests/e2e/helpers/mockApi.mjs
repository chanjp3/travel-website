/**
 * The worker, mocked. Nothing listens on http://localhost:8788: Playwright
 * answers each request from fixtures, with the same CORS headers the real
 * worker sends, so the page cannot tell the difference. Every request is
 * recorded for assertions (`state.calls(path, predicate)`).
 */
import { API, flightOffers, awardRows, hotelsFor, placesFor, geocode, poiSearch, MAP_STYLE } from "./fixtures.mjs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Expose-Headers": "X-Meridian-Limit",
};

/**
 * opts.limit    value for X-Meridian-Limit on deep flight lookups ("signin", "user-cap", …)
 * opts.auth     {email, name}: sign-in is configured and a Bearer token is valid
 * opts.watches  initial award watchlist rows
 */
export async function mockApi(page, opts = {}) {
  const state = {
    requests: [],
    shares: new Map(),
    trips: new Map(),
    watches: [...(opts.watches ?? [])],
    limit: opts.limit ?? null,
    auth: opts.auth ?? null,
    nextWatchId: 1,
  };
  state.calls = (path, pred = () => true) => state.requests.filter((r) => r.path === path && pred(r));

  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const q = Object.fromEntries(url.searchParams);
    const headers = req.headers();
    const body = req.postData();
    const method = req.method();
    state.requests.push({ method, path: url.pathname, q, headers, body });

    const json = (data, status = 200, extra = {}) =>
      route.fulfill({ status, headers: { ...CORS, "Content-Type": "application/json", ...extra }, body: JSON.stringify(data) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });

    const signedIn = !!state.auth && /^Bearer \S+/.test(headers.authorization ?? "");
    const needsAuth = () => (state.auth ? json({ error: "signed out" }, 401) : json({ error: "sign-in not configured" }, 501));

    switch (url.pathname) {
      case "/api/flights": {
        if (!q.deep) return json([]); // the advisor's speculative probes: nothing to add
        const extra = state.limit ? { "X-Meridian-Limit": state.limit } : {};
        return json(flightOffers(q), 200, extra);
      }
      case "/api/awards":
        return json(q.detail ? awardRows(q) : []);
      case "/api/hotels":
        return json(hotelsFor(q));
      case "/api/places":
        return json(placesFor(q));
      case "/api/locations":
        return json([]);
      case "/api/auth/me":
        return signedIn ? json(state.auth) : needsAuth();
      case "/api/trips/mine":
        return signedIn ? json([]) : needsAuth();
      case "/api/trips": {
        if (method === "POST") {
          const code = `TEST${String(state.trips.size + 1).padStart(4, "0")}`;
          state.trips.set(code, body ?? "{}");
          return json({ code });
        }
        const saved = state.trips.get((q.code ?? "").toUpperCase().trim());
        return saved
          ? route.fulfill({ status: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: saved })
          : json({ error: "no trip found for that code (codes expire after 90 days)" }, 404);
      }
      case "/api/share": {
        if (method === "POST") {
          let snap;
          try { snap = JSON.parse(body ?? ""); } catch { return json({ error: "invalid itinerary" }, 400); }
          if (snap?.v !== 1 || typeof snap.title !== "string") return json({ error: "invalid itinerary" }, 400);
          const id = `share${state.shares.size + 1}test`;
          state.shares.set(id, { ...snap, sharedAt: new Date().toISOString() });
          return json({ id });
        }
        const saved = state.shares.get((q.id ?? "").toLowerCase());
        return saved ? json(saved) : json({ error: "this shared itinerary doesn't exist or has expired" }, 404);
      }
      case "/api/watch": {
        if (!signedIn) return needsAuth();
        if (method === "GET") return json(state.watches);
        if (method === "POST") {
          const b = JSON.parse(body ?? "{}");
          const dupe = state.watches.find((w) => w.from === b.from && w.to === b.to && w.date === b.date && w.cabin === b.cabin);
          if (dupe) return json(dupe);
          const w = {
            id: `w${state.nextWatchId++}`, from: b.from, to: b.to, date: b.date, flex: b.flex ?? 0, cabin: b.cabin,
            maxMiles: b.maxMiles ?? null, createdAt: new Date().toISOString(), checkedAt: null, hits: [], newHits: [], total: 0, error: null,
          };
          state.watches.push(w);
          return json(w);
        }
        if (method === "DELETE") {
          state.watches = state.watches.filter((w) => w.id !== q.id);
          return json({ ok: true });
        }
        return json({ error: "not found" }, 404);
      }
      case "/api/watch/check": {
        if (!signedIn) return needsAuth();
        const w = state.watches.find((x) => x.id === q.id);
        if (!w) return json({ error: "no such watch" }, 404);
        const hit = { date: w.date, miles: 88000, source: "united", taxes: 45, seats: 2, direct: true };
        Object.assign(w, { checkedAt: new Date().toISOString(), hits: [hit], newHits: [hit], total: 1 });
        return json(w);
      }
      case "/api/watch/seen": {
        if (!signedIn) return needsAuth();
        const w = state.watches.find((x) => x.id === q.id);
        if (!w) return json({ error: "no such watch" }, 404);
        w.newHits = [];
        return json(w);
      }
      default:
        return json({ error: "not found" }, 404);
    }
  });
  return state;
}

/**
 * Everything that is not the site or the mocked worker stays on this
 * machine: the town geocoder and OSM lookups get canned answers, the street
 * map a blank style, and anything else (fonts, partners, airlines) is
 * refused. Returns the list of attempted external host+path strings so a
 * test can prove no partner or airline was ever contacted.
 */
export async function blockExternal(page) {
  const external = [];
  await page.route(/^https?:\/\/(?!localhost[:/])/, async (route) => {
    const url = new URL(route.request().url());
    external.push(url.host + url.pathname);
    const json = (data) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    if (url.hostname === "geocoding-api.open-meteo.com") return json(geocode(url.searchParams.get("name")));
    if (url.hostname === "nominatim.openstreetmap.org") {
      return json(url.pathname.startsWith("/reverse") ? {} : poiSearch(url.searchParams.get("q")));
    }
    if (url.hostname === "tiles.openfreemap.org") return json(MAP_STYLE);
    return route.abort("blockedbyclient");
  });
  return external;
}

/** Hosts that must never appear in the external log. */
export const PARTNER_OR_AIRLINE = /omio|sjv\.io|impact|awin|partnerize|travelpayouts|aviasales|google\.com|aa\.com|delta\.com|united\.com|seats\.aero|booking\.com|rome2rio/i;
