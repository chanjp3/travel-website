/**
 * Alternate-gateway advisor. For a long-haul leg, checks whether a nearby
 * airport (< ~30 min from the origin or destination CITY) prices better —
 * live cash fares and live award space — and returns the single best tip.
 * Results are cached per pair+date; everything fails soft to null.
 */
import { liveFlights, liveAwards } from "../api/client.js";
import { alternatesNearCity } from "./airports.js";

const SOURCES_MAP = { virginatlantic: 1, aeroplan: 1, united: 1, delta: 1, alaska: 1 };
const cache = new Map();

const bestCashOf = (offers) =>
  offers?.length ? Math.min(...offers.filter((o) => o.price > 0).map((o) => Math.round(o.price))) : null;
const bestMilesOf = (rows, cabinKey) => {
  let best = null;
  for (const r of rows ?? []) {
    if (!SOURCES_MAP[r.source]) continue;
    const m = r[cabinKey]?.miles;
    if (m && (best == null || m < best)) best = m;
  }
  return best;
};

async function pricePair(dep, arr, date, cabin) {
  const key = `${dep}|${arr}|${date}|${cabin}`;
  if (cache.has(key)) return cache.get(key);
  const [offers, awards] = await Promise.all([
    liveFlights(dep, arr, date, cabin),
    liveAwards(dep, arr, date),
  ]);
  const out = {
    cash: bestCashOf(offers),
    miles: bestMilesOf(awards, cabin === "Business" ? "business" : "economy"),
  };
  cache.set(key, out);
  return out;
}

/**
 * depCity/arrCity are city objects ({lat,lon,name}) the leg's endpoints
 * serve; dep/arr are the current IATA pair. Returns the best improvement:
 * { alt, side: 'dep'|'arr', cash, miles, saveCash, saveMiles } or null.
 */
export async function bestAlternate({ dep, arr, date, cabin, depCity, arrCity }) {
  if (!date) return null;
  const primary = await pricePair(dep, arr, date, cabin);
  if (primary.cash == null && primary.miles == null) return null;

  const cands = [
    ...alternatesNearCity(arrCity, arr).map((a) => ({ side: "arr", alt: a, pair: [dep, a.iata] })),
    ...alternatesNearCity(depCity, dep).map((a) => ({ side: "dep", alt: a, pair: [a.iata, arr] })),
  ].slice(0, 3);

  let best = null;
  for (const c of cands) {
    const p = await pricePair(c.pair[0], c.pair[1], date, cabin);
    const saveCash = primary.cash != null && p.cash != null ? primary.cash - p.cash : 0;
    const saveMiles = primary.miles != null && p.miles != null ? primary.miles - p.miles : 0;
    const better =
      (saveCash > 0 && p.cash < primary.cash * 0.9) || saveMiles >= 5000;
    if (!better) continue;
    const score = Math.max(saveCash, saveMiles / 60); // rough $-equivalence for ranking
    if (!best || score > best.score) best = { ...c, cash: p.cash, miles: p.miles, saveCash, saveMiles, score, primary };
  }
  return best;
}
