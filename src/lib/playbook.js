import { SOURCES } from "../data/transferPartners.js";
import { bookLink, cashSearchLink, seatsSearchLink } from "./bookLinks.js";
import { fmtDay } from "./dates.js";

/**
 * Booking playbook — the chosen trip turned into an ordered list of
 * bookings, each with the price Meridian saw, a pre-filled link and the
 * exact steps (and traps) to get that price. Points legs spell out the
 * transfer path and insist award space is confirmed BEFORE moving points.
 *
 * Output is plain data (strings, numbers, http links) so the same steps
 * render in the app, the share page and the PDF without live lookups.
 */

// Where each card currency's transfers are made.
const CARD_PORTAL = {
  amexMR: "https://global.americanexpress.com/rewards/transfer",
  chaseUR: "https://ultimaterewards.chase.com/",
  citiTYP: "https://www.thankyou.com/",
  bilt: "https://www.biltrewards.com/",
};
const HOTEL_PROGRAM = {
  hyatt: "https://world.hyatt.com/",
  marriott: "https://www.marriott.com/loyalty.mi",
  hilton: "https://www.hilton.com/en/hilton-honors/",
};
// Program quirks that cost people money when missed.
const PROGRAM_NOTES = {
  ana: "ANA partner awards are round-trip only — price and book both directions as one award.",
  virginAtlantic: "Virgin Atlantic adds carrier surcharges on some flights — check the taxes on the booking page before transferring.",
  emirates: "Emirates awards often carry high carrier surcharges — compare the taxes with the cash fare first.",
  flyingBlue: "Flying Blue prices move with demand — the miles shown can change before you book.",
};

const usd = (n) => `$${Math.round(n ?? 0).toLocaleString("en-US")}`;
const kpts = (p) => `${+(p / 1000).toFixed(1)}K`;
const short = (id) => SOURCES[id]?.short ?? id;
const enc = encodeURIComponent;
const on = (iso) => (iso ? ` on ${fmtDay(iso)}` : "");

/** Pre-filled hotel search for the exact property and dates. */
export function hotelSearchLink(name, city, checkIn, checkOut) {
  if (!name) return null;
  const q = `ss=${enc([name, city].filter(Boolean).join(", "))}`;
  const d = checkIn && checkOut ? `&checkin=${checkIn}&checkout=${checkOut}` : "";
  return `https://www.booking.com/searchresults.html?${q}${d}&no_rooms=1`;
}

/** Door-to-door options (train, bus, ferry) between two places. */
export const groundSearchLink = (from, to) =>
  from && to ? `https://www.rome2rio.com/map/${enc(from)}/${enc(to)}` : null;

function transferSteps(path, programId) {
  if (path?.type !== "transfer") return { how: [], warn: [], links: [] };
  const card = short(path.source), prog = short(programId);
  const ratio = path.ratio && path.ratio !== 1 ? ` (1:${path.ratio})` : " (1:1)";
  const how = [
    `Make sure your ${prog} account exists and its name matches your ${card} account exactly.`,
    `Transfer ${path.srcPts.toLocaleString()} ${card} → ${prog}${ratio}, in 1,000-point blocks.`,
    path.days
      ? `This transfer takes about ${path.days} day${path.days > 1 ? "s" : ""} — seats can vanish meanwhile; ask the program if it can hold the award.`
      : "Transfers usually land within minutes — refresh your balance, then book straight away.",
  ];
  return {
    how,
    warn: ["Transfers are one-way: points can't be moved back to the card."],
    links: CARD_PORTAL[path.source] ? [{ label: `${card} transfer page`, url: CARD_PORTAL[path.source] }] : [],
  };
}

function flightStep({ dir, from, to, date, f, mode, path }) {
  if (f.rtIncluded) return null; // booked with the outbound round-trip fare
  const base = { kind: "flight", dir, title: `${dir} flight · ${from} → ${to}`, date, sub: [f.airline, f.cabin, f.flightNos].filter(Boolean).join(" · ") };
  const usePoints = (mode === "points" && path && f.points) || (f.points && f.cash == null);

  if (usePoints) {
    const t = transferSteps(path, f.programId);
    const prog = short(f.programId);
    const progLink = bookLink(f.programId, from, to, date, f.cabin);
    const how = [
      `Search ${prog} for ${from} → ${to}${on(date)}${f.cabin ? ` in ${f.cabin}` : ""}${f.flightNos ? ` — look for ${f.flightNos}` : ""}. Confirm the seat shows at ${kpts(f.points)} miles before moving any points.`,
      ...t.how,
      `Book the award on ${prog} and note the confirmation code.`,
    ];
    const warn = [
      ...t.warn,
      !path && "No card in your balances transfers here — this needs miles you already hold in the program.",
      f.est && "This award price is a chart estimate — the real price shows on the program's site.",
      f.twoBookings && `Two separate award tickets via ${f.viaHub} — leave a long connection; a delay on the first won't protect the second.`,
      PROGRAM_NOTES[f.programId],
    ].filter(Boolean);
    return {
      ...base, rank: 1, pay: "points",
      price: `${kpts(f.points)} ${prog} + ${usd(f.fees ?? 0)} taxes`,
      priceSub: path?.type === "transfer" ? `${kpts(path.srcPts)} ${short(path.source)} → ${prog}` : null,
      how, warn,
      links: [
        progLink && { label: `Search ${prog} awards`, url: progLink },
        { label: "Check space on Seats.aero", url: seatsSearchLink(from, to, date) },
        ...t.links,
      ].filter(Boolean),
    };
  }

  const rt = f.roundTrip && f.rtTotal;
  const how = [
    `Search ${from} → ${to}${on(date)}${f.cabin ? ` in ${f.cabin}` : ""}${f.flightNos ? ` and pick ${f.flightNos}` : ""}.`,
    rt ? `This is a round-trip fare — book both directions together in one booking (${usd(f.rtTotal)} total).` : null,
    "Choose the airline's own booking option where you can — changes and disruptions are far easier to fix than through an agency.",
    "If the price is higher than shown, fares have moved since Meridian checked — re-check the flights page or pick another option.",
  ].filter(Boolean);
  const warn = [
    f.selfTransfer && `Self-transfer via ${f.hub}: two separate tickets — collect bags and re-check${f.layover ? ` (${f.layover} connection)` : ""}; a missed connection isn't protected.`,
    f.est && "No live fare was found — this price is an estimate.",
  ].filter(Boolean);
  return {
    ...base, rank: 2, pay: "cash",
    price: rt ? usd(f.rtTotal) : usd(f.cash),
    priceSub: rt ? "round trip, both directions" : f.est ? "estimate" : null,
    how, warn,
    links: [{ label: "Open in Google Flights", url: cashSearchLink(from, to, date, f.cabin) }].filter((l) => l.url),
  };
}

function hotelStep({ cityName, stay, hc }) {
  const h = hc.hotel;
  const nts = `${hc.nights} night${hc.nights === 1 ? "" : "s"}`;
  const dates = stay?.checkIn ? `${fmtDay(stay.checkIn)} → ${fmtDay(stay.checkOut)}` : nts;
  const base = { kind: "hotel", title: `${h.name} · ${cityName}`, date: stay?.checkIn ?? null, sub: stay?.checkOut ? `${nts} · check out ${fmtDay(stay.checkOut)}` : nts };

  if (hc.mode === "points" && hc.path && h.pts) {
    const t = transferSteps(hc.path, h.pid);
    const total = h.pts * hc.nights;
    return {
      ...base, rank: 3, pay: "points",
      price: `${kpts(total)} ${h.program}`,
      priceSub: hc.path.type === "transfer" ? `${kpts(hc.path.srcPts)} ${short(hc.path.source)} → ${h.program}` : `${kpts(h.pts)}/night`,
      how: [
        `Search ${h.program} for ${h.name}, ${dates}, and confirm a standard award room at about ${kpts(h.pts)} a night before moving points.`,
        ...t.how,
        "Book the award and note the confirmation code — most hotel awards cancel free until shortly before arrival.",
      ],
      warn: [...t.warn, "The points price is an estimate at the program's typical value — the real award price shows on its site."],
      links: [
        HOTEL_PROGRAM[h.pid] && { label: `${h.program} awards`, url: HOTEL_PROGRAM[h.pid] },
        ...t.links,
      ].filter(Boolean),
    };
  }

  return {
    ...base, rank: 5, pay: "cash",
    price: usd((h.cash ?? 0) * hc.nights),
    priceSub: `${usd(h.cash)}/night`,
    how: [
      `Search ${h.name} for ${dates}.`,
      "Choose a free-cancellation rate so a later change elsewhere in the trip doesn't cost you.",
      h.pid ? `Booking direct with ${h.program} usually matches the price and earns points and member perks.` : null,
    ].filter(Boolean),
    warn: [
      h.testRate && "Test rate from a sandbox key — not a real price.",
      hc.sample && "Sample listing — confirm the hotel and its rate.",
    ].filter(Boolean),
    links: [{ label: "Find this hotel", url: hotelSearchLink(h.name, cityName, stay?.checkIn, stay?.checkOut) }].filter((l) => l.url),
  };
}

function groundStep({ fromName, toName, fromAir, toAir, date, leg, jr }) {
  const base = { kind: leg.mode === "flight" ? "flight" : "ground", title: `${fromName} → ${toName}`, date, sub: leg.svc };
  if (leg.mode === "flight") {
    return {
      ...base, rank: 2, pay: "cash", price: usd(leg.usd), priceSub: "estimate",
      how: [
        `Search ${fromAir} → ${toAir}${on(date)}.`,
        "Short-haul fares are cheapest booked a few weeks out; check the baggage allowance on budget airlines.",
      ],
      warn: ["Regional flight price is an estimate — live pricing comes in a later build."],
      links: [{ label: "Open in Google Flights", url: cashSearchLink(fromAir, toAir, date, "Economy") }].filter((l) => l.url),
    };
  }
  const japan = leg.pack === "japan" || leg.jr !== undefined;
  if (japan && jr?.worthIt) {
    return {
      ...base, rank: 4, pay: "pass", price: "JR Pass", priceSub: leg.jr === "hikari" ? "ride Hikari, or pay the Nozomi supplement" : null,
      how: ["Covered by your JR Pass — reserve a seat free at a JR ticket office or ticket machine before boarding."],
      warn: [], links: [],
    };
  }
  if (japan) {
    return {
      ...base, rank: 4, pay: "cash", price: usd(leg.usd), priceSub: leg.yen ? `¥${leg.yen.toLocaleString()}` : null,
      how: [
        "Book Shinkansen seats online (Tokaido/Sanyo lines via smartEX) or buy at the station on the day.",
        "Reserved seats sell out in peak weeks (Golden Week, Obon, New Year) — book early then.",
      ],
      warn: [],
      links: [{ label: "smartEX (Shinkansen)", url: "https://smart-ex.jp/en/" }],
    };
  }
  return {
    ...base, rank: 4, pay: "cash", price: usd(leg.usd), priceSub: "estimate",
    how: [
      `Compare train, bus and ferry options from ${fromName} to ${toName}${date ? ` for ${fmtDay(date)}` : ""}.`,
      "Book the operator directly once you've picked — advance rail fares are cheapest weeks ahead and usually non-refundable.",
    ],
    warn: ["Ground price is an estimate — live rail, bus and ferry pricing comes in a later build."],
    links: [{ label: "Compare on Rome2rio", url: groundSearchLink(fromName, toName) }].filter((l) => l.url),
  };
}

/**
 * flights: [{dir, from, to, date, f, mode, path}]
 * hotels:  [{cityName, stay, hc}]  (hc = an App hotelChoices entry)
 * ground:  [{fromName, toName, fromAir, toAir, date, leg}]
 * jr:      jrPassAnalysis result (or null)
 */
export function buildPlaybook({ flights = [], hotels = [], ground = [], jr = null }) {
  const steps = [
    ...flights.map(flightStep),
    ...ground.map((g) => groundStep({ ...g, jr })),
    ...hotels.map(hotelStep),
  ].filter(Boolean);
  if (jr?.worthIt) {
    steps.push({
      kind: "ground", rank: 4, pay: "cash", title: jr.pass.name, date: null, sub: "Japan rail",
      price: `¥${jr.pass.cost.toLocaleString()}`, priceSub: `saves ≈ ¥${(jr.jrYen - jr.pass.cost).toLocaleString()} vs single tickets`,
      how: ["Buy the pass from the official site or an authorised seller before you go, then exchange or activate it in Japan."],
      warn: [], links: [{ label: "Official JR Pass site", url: "https://japanrailpass.net/en/" }],
    });
  }
  // Scarcest first: award seats, then cash flights (fares rise), points
  // hotels, ground transport, and refundable cash hotels last.
  steps.sort((a, b) => a.rank - b.rank || String(a.date ?? "").localeCompare(String(b.date ?? "")));
  steps.forEach((s, i) => { s.n = i + 1; s.id = `${s.kind}:${s.title}:${s.date ?? ""}`; delete s.rank; });

  const transfers = steps.filter((s) => s.pay === "points" && s.priceSub?.includes("→")).length;
  return {
    steps,
    tips: [
      "Book in the order below — the scarce pieces (award seats, cheap fares) first, refundable hotels last.",
      transfers ? "Never transfer points speculatively: confirm the exact award is bookable, transfer, then book in one sitting." : null,
      "Pay cash bookings with a card that includes trip-delay and cancellation cover.",
      "Save every confirmation code below — the share link and PDF carry this checklist too.",
    ].filter(Boolean),
  };
}
