/**
 * Live-data merge layer. Estimate engines always produce a full option set;
 * when the worker returns real offers for the chosen dates, these
 * functions splice them in:
 *   - real cash itineraries replace the distance-model cash rows
 *   - award rows get their cash comparison repriced against the best live
 *     fare, so ¢/pt point values are computed from real market prices
 * Everything fails soft: no offers → the estimate set is returned untouched.
 */
import { airlineName } from "../data/airlines.js";

const parseDur = (iso) => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(iso ?? "");
  return (+(m?.[1] ?? 0)) * 60 + (+(m?.[2] ?? 0));
};
const hmStr = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
const timeOf = (ts) => (ts ? ts.slice(11, 16) : null);

/** Merge live flight offers (one date) into a leg's option set. Offers carry
 *  their own cabin when the provider only serves one (Aviasales cached fares
 *  are economy market prices); otherwise they're the requested cabin. */
export function mergeLiveLeg(leg, offers, cabin) {
  if (!leg || !offers?.length) return leg ? { ...leg, live: false } : leg;
  const usable = offers
    .filter((o) => o.price > 0 && o.itineraries?.[0]?.segments?.length)
    .sort((a, b) => a.price - b.price);
  if (!usable.length) return { ...leg, live: false };

  const offerCabin = (o) => (o.cabin === "ECONOMY" ? "Economy" : o.cabin === "BUSINESS" ? "Business" : cabin);
  const liveRows = usable.slice(0, 3).map((o, i) => {
    const it = o.itineraries[0];
    const segs = it.segments;
    const stops = o.transfers ?? segs.length - 1;
    return {
      id: `live-${cabin}-${i}`,
      airline: airlineName(o.carrier ?? segs[0].carrier),
      cabin: offerCabin(o), programId: null, points: null, fees: 0,
      cash: Math.round(o.price),
      via: segs.length > 1
        ? `via ${segs.slice(0, -1).map((s) => s.to).join(", ")}`
        : stops > 0 ? `${stops} stop${stops !== 1 ? "s" : ""}` : "nonstop",
      dur: it.duration ? hmStr(parseDur(it.duration)) : "",
      dep: timeOf(segs[0].dep), arr: timeOf(segs[segs.length - 1].arr),
      flightNos: segs.map((s) => `${s.carrier}${s.num}`).join(" · "),
      stops, est: false, live: true, cashOnly: true,
    };
  });

  // Award rows only reprice against live fares of their own cabin.
  const bestByCabin = {};
  for (const r of liveRows) bestByCabin[r.cabin] = Math.min(bestByCabin[r.cabin] ?? 9e9, r.cash);
  const bestCash = liveRows[0].cash;
  const options = leg.options
    .filter((f) => !(f.cashOnly && bestByCabin[f.cabin] != null))
    .map((f) => (f.points && bestByCabin[f.cabin] != null ? { ...f, cash: bestByCabin[f.cabin], liveCash: true } : f));
  options.push(...liveRows);
  options.sort((a, b) =>
    a.cabin === b.cabin ? (a.points ?? 9e9) - (b.points ?? 9e9) : a.cabin === "Economy" ? -1 : 1
  );
  return { ...leg, options, live: true, bestCash };
}

/**
 * Seats.aero source → loyalty program the funding engine can pay into.
 * Programs Seats.aero tracks but our transfer tables don't cover (AA, Flying
 * Blue…) are ignored rather than shown as unfundable rows.
 */
const SEATSAERO_SOURCES = {
  virginatlantic: "virginAtlantic",
  aeroplan: "aeroplan",
  united: "united",
  delta: "delta",
  alaska: "alaska",
};
const CABIN_KEY = { Economy: "economy", Business: "business" };

/**
 * Merge Seats.aero award space into a leg's options.
 *   rows = null      → not configured / failed: chart estimates untouched
 *   match found      → row repriced to real miles/taxes, marked awardLive
 *   tracked, no space → chart row flagged noSpace (shown, warned, deprioritized)
 */
export function mergeLiveAwards(leg, rows) {
  if (!leg || rows == null) return leg;
  const best = {}; // programId → { cabinKey → cheapest block }
  for (const r of rows) {
    const pid = SEATSAERO_SOURCES[r.source];
    if (!pid) continue;
    for (const ck of ["economy", "business"]) {
      const block = r[ck];
      if (!block?.miles) continue;
      const cur = (best[pid] ??= {})[ck];
      if (!cur || block.miles < cur.miles) best[pid][ck] = block;
    }
  }
  const options = leg.options.map((f) => {
    if (!f.points || !f.programId) return f;
    const hit = best[f.programId]?.[CABIN_KEY[f.cabin]];
    if (hit) {
      return {
        ...f,
        points: hit.miles,
        fees: hit.taxes ?? f.fees,
        est: false, awardLive: true,
        seats: hit.seats, direct: hit.direct,
        airline: hit.airlines || f.airline,
      };
    }
    // Seats.aero tracks this program — searched, nothing bookable that day.
    return f.programId in invert(SEATSAERO_SOURCES) ? { ...f, noSpace: true } : f;
  });
  options.sort((a, b) =>
    a.cabin === b.cabin ? (a.points ?? 9e9) - (b.points ?? 9e9) : a.cabin === "Economy" ? -1 : 1
  );
  return { ...leg, options, awardsLive: true };
}
const invert = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));

/**
 * Points-brand detector for live hotel names. When a live property belongs
 * to a bookable program, attach the program and a typical award rate derived
 * from its live cash price at the program's usual redemption value — so any
 * town's Hilton/Marriott/Hyatt shows whether points can cover it, funded
 * through the transfer-partner engine like everything else.
 */
const BRAND_PROGRAMS = [
  { re: /hyatt/i, pid: "hyatt", program: "Hyatt", cpp: 0.017, block: 1000 },
  { re: /hilton|conrad|waldorf|doubletree|curio|hampton|embassy suites/i, pid: "hilton", program: "Hilton", cpp: 0.005, block: 5000 },
  { re: /marriott|courtyard|sheraton|westin|ritz|st\.? regis|aloft|moxy|autograph|renaissance|le m[eé]ridien/i, pid: "marriott", program: "Marriott", cpp: 0.008, block: 2500 },
];
const brandFor = (name) => BRAND_PROGRAMS.find((b) => b.re.test(name ?? ""));
const titleCase = (s) =>
  (s ?? "").toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase()).replace(/\s+/g, " ").trim();

/** Merge live hotel offers into a city's hotel shortlist. */
export function mergeLiveHotels(base, offers, nights) {
  if (!offers?.length) return { ...base, live: false };
  const priced = offers.filter((o) => o.price > 0 && o.name);
  if (!priced.length) return { ...base, live: false };
  const n = Math.max(nights, 1);

  // Reprice curated rows when a live offer shares the points brand.
  const hotels = base.hotels.map((h) => {
    const brand = brandFor(h.name);
    const match = brand && priced.find((o) => brandFor(o.name)?.pid === brand.pid);
    return match ? { ...h, cash: Math.round(match.price / n), liveCash: true } : h;
  });

  // Append the cheapest live properties as bookable options; points brands
  // get an award estimate so "can I use points here?" is always answered.
  const covered = new Set(hotels.filter((h) => h.liveCash).map((h) => brandFor(h.name)?.pid));
  const named = new Set(hotels.map((h) => h.name.toLowerCase()));
  const extras = [...priced]
    .sort((a, b) => a.price - b.price)
    .filter((o) => !named.has(titleCase(o.name).toLowerCase()))
    .filter((o) => !covered.has(brandFor(o.name)?.pid) || !brandFor(o.name))
    .slice(0, base.hotels.length <= 2 ? 3 : 2)
    .map((o) => {
      const nightly = Math.round(o.price / n);
      const brand = brandFor(o.name);
      const pts = brand ? Math.round(nightly / brand.cpp / brand.block) * brand.block : null;
      return {
        name: titleCase(o.name),
        program: brand?.program ?? "cash", pid: brand?.pid ?? null,
        pts, cash: nightly, view: null, quality: o.rating ?? null, stars: o.stars ?? null, reviews: o.reviews ?? null, live: true,
        note: brand
          ? `Live rate · award estimate at typical ${brand.program} value`
          : "Live rate for your dates",
      };
    });

  return { hotels: [...hotels, ...extras], sample: false, live: true };
}
