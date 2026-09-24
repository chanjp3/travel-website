import { SOURCES } from "../data/transferPartners.js";

/**
 * Shareable itinerary snapshot (v1): the itinerary page resolved into
 * plain data — what the planner chose and what it cost at that moment.
 * The share page renders it without any live lookups. Every field is a
 * plain string/number; the page escapes all of it.
 */
const short = (id) => SOURCES[id]?.short ?? null;

function flightPay(f, mode, path) {
  if (f.rtIncluded) return { kind: "included" };
  if (mode === "points" && path && f.points) {
    return { kind: "points", points: path.srcPts, source: short(path.source), program: short(f.programId), fees: f.fees ?? 0, transfer: path.type === "transfer" };
  }
  if (f.points && f.cash == null) return { kind: "miles", points: f.points, program: short(f.programId), fees: f.fees ?? 0 };
  return { kind: "cash", cash: f.cash ?? 0, roundTrip: !!f.roundTrip, rtTotal: f.rtTotal ?? null };
}

function flightOf({ dir, from, to, date, f, mode, path }) {
  return {
    dir, from, to, date,
    airline: f.airline ?? null, cabin: f.cabin ?? null,
    dep: f.dep ?? null, arr: f.arr ?? null, dur: f.dur ?? null,
    via: f.via ?? null, flightNos: f.flightNos ?? null,
    segs: (f.segs ?? []).map((s) => ({ from: s.from, to: s.to, dep: s.dep ?? null, arr: s.arr ?? null, carrier: s.carrier ?? "", num: s.num ?? "" })),
    chain: f.twoBookings && f.viaHub ? [from, f.viaHub, to] : null,
    pay: flightPay(f, mode, path),
    flags: {
      est: !!f.est, selfTransfer: !!f.selfTransfer, layover: f.layover ?? null,
      twoBookings: !!f.twoBookings, awardLive: !!f.awardLive, gfLive: !!f.gfLive,
    },
  };
}

function hotelOf({ cityName, stay, hc }) {
  const h = hc.hotel;
  const pay = hc.mode === "points" && hc.path
    ? { kind: "points", points: hc.path.srcPts, source: short(hc.path.source), program: h.program ?? null, transfer: hc.path.type === "transfer" }
    : { kind: "cash", nightly: h.cash ?? 0, total: (h.cash ?? 0) * hc.nights };
  return {
    city: cityName, name: h.name, stars: h.stars ?? null, rating: h.quality ?? null,
    nights: hc.nights, checkIn: stay?.checkIn ?? null, checkOut: stay?.checkOut ?? null,
    pay, flags: { testRate: !!h.testRate, sample: !!hc.sample },
  };
}

export function buildShareSnapshot({ originName, stops, departDate, returnDate, openJaw, cabin, flights, hotels, ledger, days }) {
  const pointsUsed = Object.entries(ledger.usage ?? {}).map(([src, pts]) => ({ source: short(src) ?? src, points: pts }));
  return {
    v: 1,
    title: `${originName} → ${stops.map((s) => s.name).join(" → ")}`,
    departDate, returnDate, cabin, openJaw: !!openJaw,
    stops: stops.map((s) => ({ name: s.name, nights: s.nights, checkIn: s.checkIn ?? null, checkOut: s.checkOut ?? null })),
    flights: flights.map(flightOf),
    hotels: hotels.map(hotelOf),
    costs: {
      lines: ledger.lines.map((l) => ({ group: l.group, label: l.label, value: l.value, sub: l.sub ?? null, est: !!l.est, test: !!l.test })),
      cash: ledger.cash, retail: ledger.retail, pointsUsed,
    },
    days: days.map((d) => ({ day: d.day, date: d.date ?? null, title: d.title, items: d.items.map((it) => ({ icon: it.icon, t: it.t, n: it.n })) })),
  };
}
