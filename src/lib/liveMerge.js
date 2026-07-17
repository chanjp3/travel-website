/**
 * Live-data merge layer. Estimate engines always produce a full option set;
 * when the Amadeus worker returns real offers for the chosen dates, these
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

/** Merge live flight offers (one cabin, one date) into a leg's option set. */
export function mergeLiveLeg(leg, offers, cabin) {
  if (!leg || !offers?.length) return leg ? { ...leg, live: false } : leg;
  const usable = offers
    .filter((o) => o.price > 0 && o.itineraries?.[0]?.segments?.length)
    .sort((a, b) => a.price - b.price);
  if (!usable.length) return { ...leg, live: false };

  const bestCash = Math.round(usable[0].price);
  const liveRows = usable.slice(0, 3).map((o, i) => {
    const it = o.itineraries[0];
    const segs = it.segments;
    return {
      id: `live-${cabin}-${i}`,
      airline: airlineName(o.carrier ?? segs[0].carrier),
      cabin, programId: null, points: null, fees: 0,
      cash: Math.round(o.price),
      via: segs.length > 1 ? `via ${segs.slice(0, -1).map((s) => s.to).join(", ")}` : "nonstop",
      dur: hmStr(parseDur(it.duration)),
      dep: timeOf(segs[0].dep), arr: timeOf(segs[segs.length - 1].arr),
      flightNos: segs.map((s) => `${s.carrier}${s.num}`).join(" · "),
      stops: segs.length - 1, est: false, live: true, cashOnly: true,
    };
  });

  const options = leg.options
    .filter((f) => !(f.cashOnly && f.cabin === cabin))
    .map((f) => (f.cabin === cabin && f.points ? { ...f, cash: bestCash, liveCash: true } : f));
  options.push(...liveRows);
  options.sort((a, b) =>
    a.cabin === b.cabin ? (a.points ?? 9e9) - (b.points ?? 9e9) : a.cabin === "Economy" ? -1 : 1
  );
  return { ...leg, options, live: true, bestCash };
}

const BRANDS = ["hyatt", "conrad", "hilton", "marriott", "ritz", "westin", "sheraton"];
const titleCase = (s) =>
  (s ?? "").toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase()).replace(/\s+/g, " ").trim();

/** Merge live hotel offers into a city's hotel shortlist. */
export function mergeLiveHotels(base, offers, nights) {
  if (!offers?.length) return { ...base, live: false };
  const priced = offers.filter((o) => o.price > 0 && o.name);
  if (!priced.length) return { ...base, live: false };
  const n = Math.max(nights, 1);

  // Reprice curated rows when a live offer shares the brand keyword.
  const hotels = base.hotels.map((h) => {
    const brand = BRANDS.find((b) => h.name.toLowerCase().includes(b));
    const match = brand && priced.find((o) => o.name.toLowerCase().includes(brand));
    return match ? { ...h, cash: Math.round(match.price / n), liveCash: true } : h;
  });

  // Append the two cheapest live properties as bookable cash options.
  const named = new Set(hotels.map((h) => h.name.toLowerCase()));
  const extras = [...priced]
    .sort((a, b) => a.price - b.price)
    .filter((o) => !named.has(titleCase(o.name).toLowerCase()))
    .slice(0, 2)
    .map((o) => ({
      name: titleCase(o.name), program: "cash", pid: null, pts: null,
      cash: Math.round(o.price / n), view: null, quality: null,
      note: "Live rate for your dates via Amadeus", live: true,
    }));

  return { hotels: [...hotels, ...extras], sample: false, live: true };
}
