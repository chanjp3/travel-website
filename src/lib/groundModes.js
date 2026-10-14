/**
 * Between-cities options: every practical way to make a hop — flight,
 * train (high-speed where it runs), bus, ferry, rental car, private car —
 * each with a door-to-door time and a price for the whole party.
 *
 * Prices are ESTIMATES (est: true) until live rail/bus/ferry feeds are
 * connected; each option carries a link to check live times and fares.
 * Published fares (Shinkansen, KTX, Taiwan HSR — fixed-price networks)
 * come first and are real (est: false); curated corridor data (Eurostar,
 * Frecciarossa…) and then the generic train model fill in elsewhere.
 * Train, bus and ferry hops in Omio's countries carry a booking link
 * (`book`) that the app routes through the affiliate redirect.
 *
 * Water awareness: a coarse grid search over the world's land outline
 * finds the overland distance between the two places. No land route (an
 * island, an open strait) or an absurd detour means a ferry or a flight;
 * bridges and tunnels (Channel Tunnel, Øresund, Seikan…) count as land.
 * Land modes are timed and priced on that road distance, not the crow's.
 */
import * as topojson from "topojson-client";
import { geoInterpolate } from "d3";
import { WORLD } from "../data/atlas/worldTopo.js";
import { AIRPORTS } from "./airports.js";
import { km, flightMin, cashEst } from "./geo.js";
import { seatsOf, peopleOf } from "./party.js";
import { publishedFare } from "../data/fixedFares.js";

export const MODE_LABEL = {
  flight: "Flight", hsr: "High-speed train", train: "Train", bus: "Bus",
  ferry: "Ferry", car: "Rental car", private: "Private car",
};
export const MODE_ICON = { flight: "✈", hsr: "🚄", train: "🚆", bus: "🚌", ferry: "⛴", car: "🚗", private: "🚘" };

const HSR = new Set(["JP", "CN", "KR", "TW", "FR", "ES", "IT", "DE", "BE", "NL", "GB", "CH", "AT", "SE", "TR", "MA", "SA", "UZ", "PT", "PL", "CZ", "FI", "NO", "DK"]);
const EU_RAIL = new Set(["AT", "BE", "BG", "CH", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GB", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "NL", "NO", "PL", "PT", "RO", "RS", "SE", "SI", "SK", "BA", "ME", "MK", "AL", "MD", "UA", "BY", "LI", "MC"]);
// Dense passenger networks only; sparse ones (US, Australia, most of the
// Americas and Africa) are left to curated corridors and the live link.
const RAIL = new Set([...EU_RAIL, "JP", "KR", "TW", "CN", "IN", "TH", "VN", "MY", "SG", "LK", "RU", "KZ", "UZ", "TR", "EG", "MA", "IL", "IR", "PK", "BD"]);
// Countries where a train crossing the border is a normal thing to book.
const RAIL_NETWORK = (a, b) =>
  a === b ? RAIL.has(a) : (EU_RAIL.has(a) && EU_RAIL.has(b)) ||
  [["CN", "HK"], ["MY", "SG"], ["TH", "MY"], ["CN", "VN"], ["CN", "LA"], ["TH", "LA"]].some(([x, y]) => (a === x && b === y) || (a === y && b === x));

// North American corridors with real intercity passenger rail.
const NA_RAIL = [
  [38.5, -77.6, 42.6, -70.8],   // Northeast Corridor: Washington–New York–Boston
  [40.6, -76.0, 45.6, -73.3],   // Empire / Adirondack: New York–Albany–Montreal
  [32.5, -121.0, 38.8, -116.9], // California: San Diego–LA–Bay Area–Sacramento
  [43.9, -123.4, 49.4, -121.9], // Cascades: Eugene–Portland–Seattle–Vancouver
  [41.5, -88.5, 43.2, -87.5],   // Chicago–Milwaukee
  [42.9, -80.1, 46.9, -71.1],   // VIA corridor: Toronto–Ottawa–Montreal–Quebec
];
const inNARail = (p) => NA_RAIL.find(([y0, x0, y1, x1]) => p.lat >= y0 && p.lat <= y1 && p.lon >= x0 && p.lon <= x1);

// Omio sells trains, buses and ferries here (Europe, UK, US, Canada).
const OMIO = new Set([...EU_RAIL, "IS", "US", "CA"]);
const slug = (name) => String(name ?? "").replace(/\s*\(.+\)$/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** Omio's route page for a hop (English site) — pre-filled search widget. */
export const omioUrl = (mode, a, b) =>
  `https://www.omio.com/${mode === "bus" ? "buses" : mode === "ferry" ? "ferries" : "trains"}/${slug(a.name)}/${slug(b.name)}`;

const ASIA_CHEAP = new Set(["TH", "VN", "KH", "LA", "MM", "ID", "PH", "MY", "IN", "LK", "NP", "BD", "PK", "EG", "MA", "MX", "PE", "BO", "CO", "EC", "GT", "TR", "TN", "KE", "TZ"]);
const PRICEY = new Set(["US", "CA", "AU", "NZ", "JP", "GB", "CH", "NO", "SE", "DK", "FI", "IS", "IE", "FR", "DE", "NL", "BE", "AT", "IT", "ES", "SG", "AE", "IL", "KR", "HK"]);

// Bridges and tunnels: cells along these segments count as land.
const FIXED_LINKS = [
  [[51.15, 0.87], [50.90, 2.10]],    // Channel Tunnel (Ashford ↔ Calais, landfall to landfall)
  [[55.65, 12.60], [55.58, 13.00]],  // Øresund
  [[55.31, 10.80], [55.33, 11.14]],  // Great Belt
  [[55.50, 9.73], [55.56, 9.75]],    // Little Belt
  [[40.82, 140.74], [41.77, 140.73]],// Seikan
  [[33.96, 130.94], [33.88, 130.88]],// Kanmon
  [[34.66, 133.92], [34.34, 134.05]],// Seto Ohashi
  [[34.69, 135.19], [34.10, 134.60]],// Akashi–Naruto
  [[5.40, 100.37], [5.41, 100.31]],  // Penang
  [[1.46, 103.76], [1.35, 103.82]],  // Johor–Singapore causeway
  [[26.20, 50.20], [26.20, 50.55]],  // King Fahd Causeway
  [[46.23, -63.67], [46.30, -63.85]],// Confederation Bridge
  [[22.30, 114.17], [22.20, 113.54]],// Hong Kong–Zhuhai–Macau
  [[41.10, 29.05], [41.02, 29.00]],  // Bosphorus
  [[40.35, 26.65], [40.30, 26.75]],  // Dardanelles (1915 Çanakkale)
];
// Road-linked land too small or fine-grained for the coarse outline.
const ROAD_LINKED = [
  [24.4, -82.0, 25.6, -80.2],    // Florida Keys
  [45.36, 12.20, 45.52, 12.45],  // Venice
  [1.15, 103.6, 1.48, 104.1],    // Singapore
  [22.10, 113.4, 22.58, 114.45], // Hong Kong & Macau
  [54.95, 10.85, 56.15, 12.75],  // Zealand (Copenhagen)
  [54.95, 9.65, 55.65, 10.90],   // Funen
];
// Straits a coarse outline may close up but no road crosses.
const SEA_GATES = [
  [35.75, -6.05, 36.20, -5.15],  // Gibraltar
  [37.85, 15.50, 38.30, 15.75],  // Messina
  [53.6, -6.0, 55.4, -3.0],      // Irish Sea (north channel area)
];
const inBoxes = (boxes, lat, lon) => boxes.some(([y0, x0, y1, x1]) => lat >= y0 && lat <= y1 && lon >= x0 && lon <= x1);

/* Fast land mask: even-odd ray casting over the merged land outline, with
   edges bucketed into 1° latitude bands — microseconds per point. */
let BANDS = null;
function bands() {
  if (BANDS) return BANDS;
  const merged = topojson.merge(WORLD, WORLD.objects.countries.geometries);
  BANDS = new Map();
  for (const poly of merged.coordinates) for (const ring of poly) {
    for (let i = 1; i < ring.length; i++) {
      const [x1, y1] = ring[i - 1], [x2, y2] = ring[i];
      if (Math.abs(x2 - x1) > 180 || y1 === y2) continue; // antimeridian jump / flat
      for (let band = Math.floor(Math.min(y1, y2)); band <= Math.floor(Math.max(y1, y2)); band++) {
        if (!BANDS.has(band)) BANDS.set(band, []);
        BANDS.get(band).push([x1, y1, x2, y2]);
      }
    }
  }
  return BANDS;
}
function rawLand(lat, lon) {
  const edges = bands().get(Math.floor(lat));
  if (!edges) return false;
  let inside = false;
  for (const [x1, y1, x2, y2] of edges) {
    if ((y1 > lat) !== (y2 > lat) && lon < x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1)) inside = !inside;
  }
  return inside;
}
const isLand = (lat, lon) =>
  !inBoxes(SEA_GATES, lat, lon) && (rawLand(lat, lon) || inBoxes(ROAD_LINKED, lat, lon));

/** Shortest overland distance (km) on a coarse grid, or null when the
 *  only land route is absurd (> 2.4× the crow flies) or doesn't exist. */
function overland(a, b, d) {
  let step = Math.min(0.6, Math.max(0.06, d / 70 / 111));
  const margin = Math.max(1, Math.min(14, (d * 0.7) / 111));
  const lat0 = Math.min(a.lat, b.lat) - margin, lat1 = Math.max(a.lat, b.lat) + margin;
  const lon0 = Math.min(a.lon, b.lon) - margin, lon1 = Math.max(a.lon, b.lon) + margin;
  while (((lat1 - lat0) / step) * ((lon1 - lon0) / step) > 60000) step *= 1.25;
  const nx = Math.ceil((lon1 - lon0) / step) + 1, ny = Math.ceil((lat1 - lat0) / step) + 1;
  const cell = (lat, lon) => [Math.round((lon - lon0) / step), Math.round((lat - lat0) / step)];
  const mask = new Int8Array(nx * ny).fill(-1); // -1 unknown, 0 water, 1 land
  const land = (i, j) => {
    const k = j * nx + i;
    if (mask[k] < 0) mask[k] = isLand(lat0 + j * step, lon0 + i * step) ? 1 : 0;
    return mask[k] === 1;
  };
  for (const [[ya, xa], [yb, xb]] of FIXED_LINKS) {
    const n = Math.ceil(Math.hypot(ya - yb, xa - xb) / (step / 2)) + 1;
    for (let t = 0; t <= n; t++) {
      const [i, j] = cell(ya + ((yb - ya) * t) / n, xa + ((xb - xa) * t) / n);
      // a plus-shaped brush keeps the link orthogonally connected
      for (const [di, dj] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj;
        if (ii >= 0 && jj >= 0 && ii < nx && jj < ny) mask[jj * nx + ii] = 1;
      }
    }
  }
  const [si, sj] = cell(a.lat, a.lon), [gi, gj] = cell(b.lat, b.lon);
  mask[sj * nx + si] = 1; mask[gj * nx + gi] = 1; // coastal ends always count
  const kmX = (j) => step * 111 * Math.cos(((lat0 + j * step) * Math.PI) / 180), kmY = step * 111;
  const h = (i, j) => km({ lat: lat0 + j * step, lon: lon0 + i * step }, b);
  const limit = 2.4 * d + 80;
  // A* over 8 neighbours (no corner-cutting across water)
  const g = new Float64Array(nx * ny).fill(Infinity);
  const heap = [];
  const push = (f, k) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  const start = sj * nx + si, goal = gj * nx + gi;
  g[start] = 0; push(h(si, sj), start);
  while (heap.length) {
    const [f, k] = pop();
    if (k === goal) return g[k];
    if (f > limit) return null;
    const i = k % nx, j = (k - i) / nx;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= nx || nj >= ny || !land(ni, nj)) continue;
      if (di && dj && !(land(i + di, j) && land(i, j + dj))) continue;
      const nk = nj * nx + ni;
      const c = g[k] + Math.hypot(di * kmX(j), dj * kmY);
      if (c < g[nk]) { g[nk] = c; push(c + h(ni, nj), nk); }
    }
  }
  return null;
}

const routeCache = new Map();
/** How a hop can be made on the ground: {sea, roadKm}. `sea` = no
 *  sensible land route (islands, open straits, long sea detours). */
export function landRoute(a, b) {
  const key = `${a.lat.toFixed(2)},${a.lon.toFixed(2)}>${b.lat.toFixed(2)},${b.lon.toFixed(2)}`;
  if (routeCache.has(key)) return routeCache.get(key);
  const d = Math.max(1, km(a, b));
  let out;
  // Quick answer: the straight line stays on land the whole way.
  const n = Math.max(4, Math.min(80, Math.ceil(d / 10)));
  const ip = geoInterpolate([a.lon, a.lat], [b.lon, b.lat]);
  let dry = true;
  for (let i = 1; i < n && dry; i++) { const [lon, lat] = ip(i / n); if (!isLand(lat, lon)) dry = false; }
  if (dry) out = { sea: false, roadKm: Math.round(d * 1.25) };
  else {
    const L = overland(a, b, d);
    out = L == null ? { sea: true, roadKm: null } : { sea: false, roadKm: Math.round(Math.max(d * 1.25, L * 1.05)) };
  }
  routeCache.set(key, out);
  return out;
}

/** Nearest airport within reach (km), large ones preferred. */
export function nearestAirport(p, maxKm = 150) {
  let best = null, bd = Infinity;
  for (const ap of AIRPORTS) {
    const d = km(p, ap) * (ap.large ? 1 : 1.6);
    if (d < bd) { bd = d; best = ap; }
  }
  return best && km(p, best) <= maxKm ? best : null;
}

const r2rLink = (a, b) =>
  a?.name && b?.name ? `https://www.rome2rio.com/map/${encodeURIComponent(a.name)}/${encodeURIComponent(b.name)}` : null;
const gfLink = (fa, ta, date) =>
  fa && ta ? `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${fa} to ${ta}${date ? ` on ${date}` : ""} one way`)}` : null;

/**
 * Options for one hop.
 *   a, b:   {name, lat, lon, iso2?, iata?}
 *   pax:    {adults, children, infants}
 *   rail:   curated corridor edge {min, usd|yen, svc} when one exists
 *   date:   travel day (ISO), used in links
 */
export function hopOptions({ a, b, pax, rail = null, date = null }) {
  const d = Math.max(1, km(a, b));
  const ca = a.iso2 ?? null, cb = b.iso2 ?? null;
  const seats = seatsOf(pax), people = peopleOf(pax);
  const vehicles = Math.max(1, Math.ceil(people / 4));
  const route = landRoute(a, b);
  const overWater = route.sea;
  const rd = route.roadKm ?? d; // road distance for land modes
  const cheap = ASIA_CHEAP.has(ca) || ASIA_CHEAP.has(cb);
  const pricey = PRICEY.has(ca) && PRICEY.has(cb);
  const us = ca === "US" || ca === "CA";
  const opts = [];
  const add = (mode, o) => opts.push({ mode, label: MODE_LABEL[mode], icon: MODE_ICON[mode], est: true, ...o });

  // Flight — both ends near an airport and far enough apart to be worth it.
  const fa = a.iata ? { iata: a.iata } : nearestAirport(a), fb = b.iata ? { iata: b.iata } : nearestAirport(b);
  if (fa && fb && fa.iata !== fb.iata && d >= (overWater ? 60 : 220)) {
    // budget carriers dominate short-haul in SE Asia, India and Europe
    const lvl = cheap ? 0.5 : EU_RAIL.has(ca) && EU_RAIL.has(cb) && d < 2000 ? 0.7 : 1;
    const pp = Math.round(cashEst(d, "Economy") * lvl);
    add("flight", {
      id: "flight", min: flightMin(d) + 150, pp, total: Math.round(pp * seats),
      svc: `${fa.iata} → ${fb.iata}`, note: "Includes ~2½ hours for getting to the airport, security and boarding.",
      link: gfLink(fa.iata, fb.iata, date) ?? r2rLink(a, b),
    });
  }

  if (!overWater) {
    // Train — a published fare first, then curated corridor data, else the
    // generic network model (dense networks only — sparse ones are left to
    // the live-price link).
    const pub = publishedFare(a, b);
    if (pub) {
      add(/kodama|train/i.test(pub.svc) ? "train" : "hsr", {
        id: "rail", min: pub.min + 30, pp: pub.usd, total: pub.usd * seats, svc: pub.svc, jr: pub.jr,
        est: false, fare: { local: pub.local, symbol: pub.symbol, currency: pub.currency, basis: pub.basis, seats },
        note: `${pub.basis}. Shown in ${pub.currency}; the dollar figure is approximate.`,
        book: { label: pub.book.label, url: pub.book.url }, link: r2rLink(a, b),
      });
    } else if (rail) {
      const pp = Math.round(rail.usd ?? (rail.yen ? rail.yen / 150 : 0));
      const fast = /shinkansen|nozomi|hikari|kodama|kagayaki|tsurugi|eurostar|tgv|ave|frecciarossa|ice|railjet|lyria/i.test(rail.svc ?? "");
      add(fast ? "hsr" : "train", { id: "rail", min: rail.min + 30, pp, total: pp * seats, svc: rail.svc, jr: rail.jr, link: r2rLink(a, b) });
    } else if (ca && cb && RAIL_NETWORK(ca, cb) && d <= 1600) {
      const hsr = HSR.has(ca) && HSR.has(cb) && d >= 120;
      const speed = hsr ? 190 : ca === "IN" ? 55 : 80;
      const perKm = ca === "JP" ? 0.17 : hsr && ["CN", "KR", "TW"].includes(ca) ? 0.08 : ca === "IN" ? 0.03
        : cheap ? 0.04 : EU_RAIL.has(ca) ? (hsr ? 0.13 : 0.1) : 0.07;
      const trackKm = rd / 1.1;
      const pp = Math.max(8, Math.round(trackKm * perKm));
      add(hsr ? "hsr" : "train", { id: "train", min: Math.round((trackKm / speed) * 60) + 40, pp, total: pp * seats, svc: hsr ? "High-speed rail" : "Intercity rail", link: r2rLink(a, b) });
    } else if (inNARail(a) && inNARail(a) === inNARail(b)) {
      const trackKm = rd / 1.1;
      const pp = Math.max(15, Math.round(trackKm * 0.2));
      add("train", { id: "train", min: Math.round((trackKm / 105) * 60) + 40, pp, total: pp * seats, svc: ca === "CA" && cb === "CA" ? "VIA Rail" : "Amtrak", link: r2rLink(a, b) });
    }
    // Bus — nearly everywhere on one landmass, up to long overnight runs.
    if (rd <= 1800) {
      const perKm = cheap ? 0.03 : us ? 0.1 : 0.06;
      const pp = Math.max(6, Math.round(rd * perKm));
      add("bus", { id: "bus", min: Math.round((rd / 65) * 60) + 30, pp, total: pp * seats, svc: rd > 700 ? "Long-distance / overnight coach" : "Intercity coach", link: r2rLink(a, b) });
    }
    // Rental car — per vehicle: rental days, fuel, tolls; one-way fees vary.
    if (d >= 40 && rd <= 1500) {
      const days = 1 + Math.floor(rd / 700);
      const fuelKm = us || cheap ? 0.08 : 0.13;
      const toll = ["JP", "FR", "IT", "ES", "PT", "HR", "GR"].includes(ca) ? 0.06 : 0;
      const daily = cheap ? 35 : pricey ? 60 : 50;
      const total = Math.round((days * daily + rd * (fuelKm + toll) + (ca !== cb ? 150 : 0)) * vehicles);
      add("car", { id: "car", min: Math.round((rd / 85) * 60) + 25, total, perVehicle: true, vehicles,
        svc: `${days} rental day${days !== 1 ? "s" : ""}, fuel${toll ? ", tolls" : ""}`,
        note: ca !== cb ? "Cross-border one-way rentals carry a drop fee — included as an estimate." : "One-way drop-off fees may apply.",
        link: r2rLink(a, b) });
    }
    // Private car / transfer — door to door, sensible up to ~4 hours.
    if (rd <= 300) {
      const rate = cheap ? 0.6 : pricey ? 2.0 : 1.2;
      const total = Math.round((25 + rd * rate) * vehicles);
      add("private", { id: "private", min: Math.round((rd / 75) * 60) + 10, total, perVehicle: true, vehicles, svc: "Driver, door to door", link: r2rLink(a, b) });
    }
  } else if (d <= 1200) {
    // Ferry — islands, open straits, and seas the roads go far around.
    const pp = Math.max(15, Math.round(d * 0.26));
    add("ferry", { id: "ferry", min: Math.round((d / 32) * 60) + 60, pp, total: pp * seats,
      svc: d > 300 ? "Overnight ferry" : "Ferry", note: "Check sailing days — many routes don't run daily.", link: r2rLink(a, b) });
  }

  // Book with Omio where it sells the route (never for airport hops).
  if (ca && cb && OMIO.has(ca) && OMIO.has(cb) && !a.airport && !b.airport) {
    for (const o of opts) {
      if (["train", "hsr", "bus", "ferry"].includes(o.mode) && !o.book) o.book = { partner: "omio", label: "Omio", url: omioUrl(o.mode, a, b) };
    }
  }

  // Tag cheapest / fastest / best balance.
  if (opts.length) {
    // "Best balance" prices time: ~$18 an hour per traveler on the move.
    opts.forEach((o) => { o.score = o.total + 18 * (o.min / 60) * people; });
    const cheapest = opts.reduce((x, y) => (y.total < x.total ? y : x));
    const fastest = opts.reduce((x, y) => (y.min < x.min ? y : x));
    const best = opts.reduce((x, y) => (y.score < x.score ? y : x));
    cheapest.tags = [...(cheapest.tags ?? []), "cheapest"];
    fastest.tags = [...(fastest.tags ?? []), "fastest"];
    best.tags = [...(best.tags ?? []), "best"];
  }
  opts.sort((x, y) => x.score - y.score);
  return { km: Math.round(d), roadKm: route.roadKm, overWater, options: opts, best: opts.find((o) => o.tags?.includes("best")) ?? opts[0] ?? null };
}

/** The chosen option for a hop: the traveler's pick, else the best balance. */
export const chosenOption = (hop, modeId) =>
  hop.options.find((o) => o.id === modeId) ?? hop.best ?? null;

export const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`);
