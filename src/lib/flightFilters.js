/**
 * Google Flights-style controls over merged flight rows, shared by the map
 * flow and the flight desk: sort by best / cheapest / fastest, cap the
 * number of stops, hide separate-ticket plans, skip overnight layovers,
 * and never connect through airports the traveler wants to avoid.
 */
import { airlineName } from "../data/airlines.js";

const parseDur = (s) => {
  const m = /(\d+)h\s*(\d+)?/.exec(s ?? "");
  return m ? +m[1] * 60 + (+m[2] || 0) : null;
};

/** Door-to-door minutes, from segment stamps when they carry offsets. */
export function durMinOf(f) {
  if (f.durMin) return f.durMin;
  const segs = f.segs;
  const a = segs?.[0]?.dep, b = segs?.[segs.length - 1]?.arr;
  if (a && b && /[+-]\d{2}:?\d{2}$|Z$/.test(a) && /[+-]\d{2}:?\d{2}$|Z$/.test(b)) {
    const d = (Date.parse(b) - Date.parse(a)) / 60000;
    if (Number.isFinite(d) && d > 0 && d < 72 * 60) return Math.round(d);
  }
  return parseDur(f.dur);
}

/** Number of stops, or null when the source doesn't say. */
export const stopsOf = (f) =>
  f.stops != null ? f.stops : f.segs?.length > 1 ? f.segs.length - 1 : f.direct ? 0 : null;

/** Airports the itinerary changes planes in. */
export function connectAirports(f) {
  if (f.segs?.length > 1) return f.segs.slice(0, -1).map((s) => s.to);
  if (f.hub) return [f.hub];
  if (f.viaHub) return [f.viaHub];
  return [];
}

/** Airlines on the itinerary, by display name: the operating carrier of
 *  every segment, plus the row's own label (seed rows have no segments;
 *  a self-transfer plan reads "Alaska + ANA"). */
export function airlinesOf(f) {
  const out = [];
  const add = (n) => { if (n && !out.includes(n)) out.push(n); };
  for (const s of f.segs ?? []) if (s.carrier) add(airlineName(s.carrier));
  for (const n of String(f.airline ?? "").split(/\s*[+/]\s*/)) add(n.trim());
  return out;
}

/** Every airline across a set of rows, most frequent first — the filter chips. */
export function airlineOptions(rows) {
  const n = new Map();
  for (const f of rows ?? []) for (const a of airlinesOf(f)) n.set(a, (n.get(a) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([a]) => a);
}

/** Layover-length choices (minutes; 0 = no limit). */
export const LAY_MINS = [[0, "Any layover length"], [60, "Layovers ≥ 1h"], [120, "Layovers ≥ 2h"], [180, "Layovers ≥ 3h"], [240, "Layovers ≥ 4h"]];
export const LAY_MAXES = [[0, "No layover cap"], [120, "Layovers ≤ 2h"], [180, "Layovers ≤ 3h"], [240, "Layovers ≤ 4h"], [360, "Layovers ≤ 6h"], [480, "Layovers ≤ 8h"], [720, "Layovers ≤ 12h"]];

/** Layovers with their length when computable: [{at, min, overnight}]. */
export function layoversOf(f) {
  const segs = f.segs ?? [];
  const out = [];
  for (let i = 1; i < segs.length; i++) {
    const a = Date.parse(segs[i - 1].arr), b = Date.parse(segs[i].dep);
    const min = Number.isFinite(a) && Number.isFinite(b) && b > a ? Math.round((b - a) / 60000) : null;
    const hr = +String(segs[i].dep ?? "").slice(11, 13);
    out.push({ at: segs[i].from, min, overnight: min != null && (min >= 8 * 60 || (min >= 4 * 60 && (hr < 6 || hr >= 23))) });
  }
  if (!out.length && f.selfTransfer && f.hub) out.push({ at: f.hub, min: null, overnight: !!f.overnight });
  return out;
}

const separate = (f) => !!(f.selfTransfer || f.twoBookings);

export function filterFlights(rows, v = {}) {
  const avoid = new Set(String(v.avoid ?? "").toUpperCase().split(/[^A-Z]+/).filter((x) => x.length === 3));
  const cap = v.stops === "0" ? 0 : v.stops === "1" ? 1 : v.stops === "2" ? 2 : null;
  return rows.filter((f) => {
    const st = stopsOf(f);
    if (cap != null && (st == null ? cap === 0 : st > cap)) return false;
    if (v.hideSep && separate(f)) return false;
    if (v.overnight === false && (f.overnight || layoversOf(f).some((l) => l.overnight))) return false;
    if (avoid.size && connectAirports(f).some((a) => avoid.has(a))) return false;
    // Airlines: keep a row when any of its carriers is chosen (so a
    // separate-ticket plan with ANA on the onward leg survives "ANA").
    const want = Array.isArray(v.airlines) && v.airlines.length ? v.airlines : null;
    if (want && !airlinesOf(f).some((a) => want.includes(a))) return false;
    // Layover length, judged only where the times are known.
    const layMin = +v.layMin || 0, layMax = +v.layMax || 0;
    if (layMin || layMax) {
      const mins = layoversOf(f).map((l) => l.min).filter((m) => m != null);
      if (layMin && mins.some((m) => m < layMin)) return false;
      if (layMax && mins.some((m) => m > layMax)) return false;
    }
    return true;
  });
}

/** Sort one kind of row (cash or award) — prices never mix units. */
function sortKind(rows, sort) {
  if (rows.length < 2) return rows;
  const price = (f) => (f.points ? f.points : f.cash ?? Infinity);
  const durs = rows.map(durMinOf).filter((d) => d != null).sort((a, b) => a - b);
  const medDur = durs.length ? durs[Math.floor(durs.length / 2)] : 600;
  const dur = (f) => durMinOf(f) ?? medDur;
  if (sort === "cheapest") return [...rows].sort((a, b) => price(a) - price(b) || dur(a) - dur(b));
  if (sort === "fastest") return [...rows].sort((a, b) => dur(a) - dur(b) || price(a) - price(b));
  const minP = Math.min(...rows.map(price)) || 1, minD = Math.min(...rows.map(dur)) || 1;
  // "Best": price first, then time and stops — the Google Flights blend.
  const score = (f) => price(f) / minP + 0.7 * (dur(f) / minD) + 0.25 * (stopsOf(f) ?? 1) + (separate(f) ? 0.15 : 0);
  return [...rows].sort((a, b) => score(a) - score(b));
}

/** Does the itinerary change planes at `hub` (a chosen "connect via" airport)? */
export const connectsVia = (f, hub) => !!hub && connectAirports(f).includes(String(hub).toUpperCase());

/** Filter + sort, keeping cash rows ahead of award rows (cash-first).
 *  With `v.via` set, rows through that hub lead their group, in sort order. */
export function applyFlightView(rows, v = {}) {
  const kept = filterFlights(rows, v);
  const sort = v.sort ?? "best";
  const viaFirst = (list) => v.via
    ? [...list.filter((f) => connectsVia(f, v.via)), ...list.filter((f) => !connectsVia(f, v.via))]
    : list;
  return [...viaFirst(sortKind(kept.filter((f) => !f.points), sort)), ...viaFirst(sortKind(kept.filter((f) => f.points), sort))];
}

export const SORTS = [["best", "Best"], ["cheapest", "Cheapest"], ["fastest", "Fastest"]];
export const STOP_CAPS = [["any", "Any stops"], ["0", "Nonstop only"], ["1", "1 stop or fewer"], ["2", "2 stops or fewer"]];
