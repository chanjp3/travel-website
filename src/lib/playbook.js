import { SOURCES } from "../data/transferPartners.js";
import { bookLink, cashSearchLink, seatsSearchLink } from "./bookLinks.js";
import { fmtDay } from "./dates.js";
import { DEFAULT_PAX, seatsOf, roomsOf, partyFare } from "./party.js";

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

function flightStep({ dir, from, to, date, f, mode, path }, pax) {
  if (f.rtIncluded || f.noReturn) return null; // booked with the outbound round-trip fare / no way home
  const seats = seatsOf(pax);
  const base = { kind: "flight", dir, title: `${dir} flight · ${from} → ${to}`, date, sub: [f.airline, f.cabin, f.flightNos].filter(Boolean).join(" · ") };
  const usePoints = (mode === "points" && path && f.points) || (f.points && f.cash == null);

  if (usePoints) {
    const t = transferSteps(path, f.programId);
    const prog = short(f.programId);
    const progLink = bookLink(f.programId, from, to, date, f.cabin);
    const how = [
      `Search ${prog} for ${from} → ${to}${on(date)}${f.cabin ? ` in ${f.cabin}` : ""}${seats > 1 ? ` for ${seats} passengers` : ""}${f.flightNos ? ` — look for ${f.flightNos}` : ""}. Confirm ${seats > 1 ? `${seats} seats show` : "the seat shows"} at ${kpts(f.points)} miles${seats > 1 ? " each" : ""} before moving any points.`,
      ...t.how,
      `Book the award on ${prog} and note the confirmation code.`,
    ];
    const warn = [
      ...t.warn,
      !path && "No card in your balances transfers here — this needs miles you already hold in the program.",
      f.est && "This award price is a chart estimate — the real price shows on the program's site.",
      f.twoBookings && `Two separate award tickets via ${f.viaHub} — leave a long connection; a delay on the first won't protect the second.`,
      f.seats != null && f.seats < seats && `Only ${f.seats} award seat${f.seats !== 1 ? "s" : ""} showed — not enough for ${seats}; check before transferring.`,
      pax.infants && "Lap infants on awards usually pay a fee or 10% of the cash fare — call the program to add them.",
      PROGRAM_NOTES[f.programId],
    ].filter(Boolean);
    return {
      ...base, rank: 1, pay: "points",
      price: `${kpts(f.points * seats)} ${prog} + ${usd((f.fees ?? 0) * seats)} taxes`,
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
    `Search ${from} → ${to}${on(date)}${f.cabin ? ` in ${f.cabin}` : ""}${seats > 1 || pax.infants ? ` for ${seats + (pax.infants ?? 0)} travelers` : ""}${f.flightNos ? ` and pick ${f.flightNos}` : ""}.`,
    rt ? `This is a round-trip fare — book both directions together in one booking (${usd(partyFare(f.rtTotal, pax))} total).` : null,
    "Choose the airline's own booking option where you can — changes and disruptions are far easier to fix than through an agency.",
    "If the price is higher than shown, fares have moved since Meridian checked — re-check the flights page or pick another option.",
  ].filter(Boolean);
  const warn = [
    f.selfTransfer && `Self-transfer via ${f.hub}: two separate tickets — collect bags and re-check${f.layover ? ` (${f.layover} connection)` : ""}; a missed connection isn't protected.`,
    f.est && "No live fare was found — this price is an estimate.",
  ].filter(Boolean);
  return {
    ...base, rank: 2, pay: "cash",
    price: rt ? usd(partyFare(f.rtTotal, pax)) : usd(partyFare(f.cash, pax)),
    priceSub: [rt ? "round trip, both directions" : null, seats > 1 ? `${usd(rt ? f.rtTotal : f.cash)} per person` : null, f.est ? "estimate" : null].filter(Boolean).join(" · ") || null,
    how, warn,
    links: [{ label: "Open in Google Flights", url: cashSearchLink(from, to, date, f.cabin) }].filter((l) => l.url),
  };
}

function hotelStep({ cityName, stay, hc }, pax) {
  const h = hc.hotel;
  const rooms = roomsOf(pax);
  const nts = `${hc.nights} night${hc.nights === 1 ? "" : "s"}`;
  const dates = stay?.checkIn ? `${fmtDay(stay.checkIn)} → ${fmtDay(stay.checkOut)}` : nts;
  const base = { kind: "hotel", title: `${h.name} · ${cityName}`, date: stay?.checkIn ?? null, sub: stay?.checkOut ? `${nts} · check out ${fmtDay(stay.checkOut)}` : nts };

  if (hc.mode === "points" && hc.path && h.pts) {
    const t = transferSteps(hc.path, h.pid);
    const total = h.pts * hc.nights * rooms;
    return {
      ...base, rank: 3, pay: "points",
      price: `${kpts(total)} ${h.program}`,
      priceSub: hc.path.type === "transfer" ? `${kpts(hc.path.srcPts)} ${short(hc.path.source)} → ${h.program}` : `${kpts(h.pts)}/night`,
      how: [
        `Search ${h.program} for ${h.name}, ${dates}, and confirm ${rooms > 1 ? `${rooms} standard award rooms` : "a standard award room"} at about ${kpts(h.pts)} a night before moving points.`,
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
    price: usd((h.cash ?? 0) * hc.nights * rooms),
    priceSub: `${usd(h.cash)}/night${rooms > 1 ? ` × ${rooms} rooms` : ""}`,
    how: [
      `Search ${h.name} for ${dates}${rooms > 1 ? `, ${rooms} rooms` : ""}.`,
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

const GROUND_HOW = {
  flight: (h) => [`Search ${h.choice.svc}${on(h.date)} — short-haul fares are cheapest a few weeks out.`, "Check the bag allowance: budget airlines charge for checked bags and sometimes cabin bags."],
  hsr: (h) => [`Book ${h.choice.svc ?? "high-speed rail"} from ${h.a.name} to ${h.b.name}${on(h.date)} with the operator or a rail app.`, "Advance fares are cheapest weeks ahead and usually non-refundable; seats on fast trains can sell out on busy days."],
  train: (h) => [`Book ${h.choice.svc ?? "the train"} from ${h.a.name} to ${h.b.name}${on(h.date)}.`, "Regional trains often need no reservation — intercity and overnight trains do."],
  bus: (h) => [`Book a coach from ${h.a.name} to ${h.b.name}${on(h.date)} — FlixBus, national operators or 12Go in Asia.`, "Buses sell seat by seat; book a day or more ahead in high season."],
  ferry: (h) => [`Book the ferry from ${h.a.name} to ${h.b.name}${on(h.date)} with the operator or Direct Ferries.`, "Check sailing days and times first — many routes don't sail daily, and bad weather cancels crossings."],
  car: (h) => [`Book a one-way rental from ${h.a.name} to ${h.b.name}${on(h.date)}.`, "Compare the one-way drop fee; bring an International Driving Permit where it's required."],
  private: (h) => [`Book a private transfer from ${h.a.name} to ${h.b.name}${on(h.date)} — confirm the price is per car, with luggage.`],
};
function groundStep(h, jrPass) {
  const ch = h.choice;
  if (!ch) return null;
  const base = { kind: ch.mode === "flight" ? "flight" : "ground", title: `${h.a.name} → ${h.b.name}`, date: h.date, sub: `${ch.label}${ch.svc ? ` · ${ch.svc}` : ""}` };
  if (jrPass && ch.id === "rail" && ch.jr !== undefined && ch.jr !== false) {
    return {
      ...base, rank: 4, pay: "pass", price: "JR Pass", priceSub: ch.jr === "hikari" ? "ride Hikari, or pay the Nozomi supplement" : null,
      how: ["Covered by your JR Pass — reserve a seat free at a JR ticket office or ticket machine before boarding."],
      warn: [], links: [],
    };
  }
  const japanRail = ch.id === "rail" && ch.jr !== undefined;
  return {
    ...base, rank: 4, pay: "cash", price: usd(ch.total),
    priceSub: [ch.perVehicle ? (ch.vehicles > 1 ? `${ch.vehicles} cars` : "per car") : null, "estimate"].filter(Boolean).join(" · "),
    how: japanRail
      ? ["Book Shinkansen seats online (Tokaido/Sanyo lines via smartEX) or buy at the station on the day.", "Reserved seats sell out in peak weeks (Golden Week, Obon, New Year) — book early then."]
      : (GROUND_HOW[ch.mode] ?? GROUND_HOW.train)(h),
    warn: ["Price is an estimate — check live times and fares before you book.", ch.note].filter(Boolean),
    links: [
      japanRail ? { label: "smartEX (Shinkansen)", url: "https://smart-ex.jp/en/" } : null,
      ch.link ? { label: ch.mode === "flight" ? "Open in Google Flights" : "Live times & prices", url: ch.link } : null,
    ].filter((l) => l?.url),
  };
}

/**
 * flights: [{dir, from, to, date, f, mode, path}]
 * hotels:  [{cityName, stay, hc}]  (hc = an App hotelChoices entry)
 * hops:    between-cities hops [{a, b, date, choice}] (choice = picked mode)
 * jr:      jrPassAnalysis result (or null)
 * pax:     {adults, children, infants}
 */
export function buildPlaybook({ flights = [], hotels = [], hops = [], jr = null, pax = DEFAULT_PAX }) {
  const seats = seatsOf(pax);
  // The pass only when it beats the JR tickets the traveler actually rides.
  const jrHops = hops.filter((h) => h.choice?.id === "rail" && h.choice.jr !== undefined && h.choice.jr !== false);
  const passUsd = jr?.worthIt ? Math.round(jr.pass.cost / 150) * seats : null;
  const jrPass = passUsd != null && jrHops.length > 0 && passUsd < jrHops.reduce((s, h) => s + h.choice.total, 0);
  const steps = [
    ...flights.map((f) => flightStep(f, pax)),
    ...hops.map((h) => groundStep(h, jrPass)),
    ...hotels.map((h) => hotelStep(h, pax)),
  ].filter(Boolean);
  if (jrPass) {
    steps.push({
      kind: "ground", rank: 4, pay: "cash", title: jr.pass.name, date: null, sub: `Japan rail${seats > 1 ? ` · ${seats} passes` : ""}`,
      price: usd(passUsd), priceSub: `¥${(jr.pass.cost * seats).toLocaleString()} · cheaper than single tickets`,
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
