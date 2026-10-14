import { SOURCES } from "../data/transferPartners.js";
import { DEFAULT_PAX, seatsOf, roomsOf, partyFare } from "./party.js";

/**
 * Trip ledger — the full cost rundown for the whole party.
 * Aggregates flights (long-haul, points or cash), hotels (points or cash,
 * per room), every between-cities hop with the mode the traveler chose
 * (a JR Pass replaces Japan rail tickets when it's cheaper), and airport
 * transfers into display lines, per-source points usage, and totals.
 */
export function buildLedger({ flights, hotels, route, jr, hops = [], pax = DEFAULT_PAX, noReturn = false }) {
  const lines = [];
  const usage = {};
  let cash = 0;
  let retail = 0;
  const seats = seatsOf(pax), rooms = roomsOf(pax);
  const spend = (src, pts) => { usage[src] = (usage[src] ?? 0) + pts; };
  const k = (p) => `${(p / 1000).toFixed(0)}K`;

  // ── long-haul flights ──
  flights.forEach(({ label, f, mode, path }) => {
    if (f.noReturn) return;
    retail += partyFare(f.cash ?? 0, pax);
    if (mode === "points" && path && f.points) {
      spend(path.source, path.srcPts);
      cash += (f.fees ?? 0) * seats;
      lines.push({
        group: "Flights", label: `${label} · ${f.airline} ${f.cabin}`,
        value: `${k(path.srcPts)} ${SOURCES[path.source].short} + $${Math.round((f.fees ?? 0) * seats)}`,
        sub: [path.type === "transfer" ? `→ ${SOURCES[f.programId].short}` : null, seats > 1 ? `${seats} award seats` : null].filter(Boolean).join(" · ") || null,
        est: f.est,
      });
    } else if (f.points && f.cash == null) {
      // Award-only row (live space with no cash comparison): price it in
      // miles — never assume a cash figure that doesn't exist.
      cash += (f.fees ?? 0) * seats;
      lines.push({
        group: "Flights", label: `${label} · ${f.airline} ${f.cabin}`,
        value: `${k(f.points * seats)} ${SOURCES[f.programId]?.short ?? "miles"} + $${Math.round((f.fees ?? 0) * seats)}`,
        sub: path ? null : "needs miles held in that program — no card transfer path",
        est: f.est,
      });
    } else {
      const c = partyFare(f.cash ?? 0, pax);
      cash += c;
      lines.push({
        group: "Flights", label: `${label} · ${f.airline} ${f.cabin}`, value: `$${c.toLocaleString()} cash`,
        sub: seats > 1 || pax.infants ? `${seats} × $${Math.round(f.cash ?? 0).toLocaleString()}${pax.infants ? ` + ${pax.infants} lap infant${pax.infants > 1 ? "s" : ""} (~10%)` : ""}` : null,
        est: f.est,
      });
    }
  });

  // ── hotels ──
  hotels.forEach(({ hotel, nights, mode, path }) => {
    const stay = (hotel.cash ?? 0) * nights * rooms;
    retail += stay;
    const roomNote = rooms > 1 ? `${rooms} rooms` : null;
    if (mode === "points" && path && hotel.pts) {
      spend(path.source, path.srcPts);
      lines.push({
        group: "Hotels", label: `${hotel.name} · ${nights} nt`,
        value: `${k(path.srcPts)} ${SOURCES[path.source].short}`,
        sub: [path.type === "transfer" ? `→ ${SOURCES[hotel.pid].short} (${k(hotel.pts * nights * rooms)})` : null, roomNote].filter(Boolean).join(" · ") || null,
        test: !!hotel.testRate,
      });
    } else {
      cash += stay;
      lines.push({ group: "Hotels", label: `${hotel.name} · ${nights} nt`, value: `$${Math.round(stay).toLocaleString()} cash`, sub: roomNote, test: !!hotel.testRate });
    }
  });

  // ── between cities ──
  const jrHops = hops.filter((h) => h.choice?.id === "rail" && h.choice.jr !== undefined && h.choice.jr !== false);
  const jrTickets = jrHops.reduce((s, h) => s + h.choice.total, 0);
  const passUsd = jr?.worthIt ? Math.round(jr.pass.cost / 150) * seats : null;
  const usePass = passUsd != null && jrHops.length > 0 && passUsd < jrTickets;
  hops.forEach((h) => {
    const ch = h.choice;
    if (!ch) {
      lines.push({ group: "Ground", label: `${h.a.name} → ${h.b.name}`, value: "—", sub: "no practical option found — check Rome2rio", est: true });
      return;
    }
    const covered = usePass && jrHops.includes(h);
    if (!covered) { cash += ch.total; retail += ch.total; }
    const pub = ch.est === false && ch.fare; // a published fare, in its own currency
    lines.push({
      group: "Ground", label: `${h.a.name} → ${h.b.name} · ${ch.label}`,
      value: covered ? "JR Pass" : `$${ch.total.toLocaleString()}`,
      sub: [ch.svc,
        pub ? `${ch.fare.symbol}${(ch.fare.local * seats).toLocaleString("en-US")} published fare`
          : ch.perVehicle ? (ch.vehicles > 1 ? `${ch.vehicles} cars` : "per car") : seats > 1 ? `${seats} × $${ch.pp}` : null,
      ].filter(Boolean).join(" · "),
      est: !covered && !pub,
    });
  });
  if (usePass) {
    cash += passUsd; retail += passUsd;
    lines.push({ group: "Ground", label: `${jr.pass.name}${seats > 1 ? ` × ${seats}` : ""}`, value: `$${passUsd.toLocaleString()}`,
      sub: `covers ${jrHops.length} JR ride${jrHops.length > 1 ? "s" : ""} — saves ≈ $${(jrTickets - passUsd).toLocaleString()} vs tickets` });
  }

  // ── airport transfers (short ones; long rides are hops above) ──
  if (route) {
    const inHop = hops.some((h) => h.key.startsWith("@")), outHop = hops.some((h) => h.key.includes(">@"));
    const per = (inHop ? 0 : route.inGw.usd) + (noReturn || outHop ? 0 : route.outGw.usd);
    if (per > 0) {
      const t = Math.round(per * seats);
      cash += t; retail += t;
      lines.push({ group: "Ground", label: "Airport transfers", value: `$${t.toLocaleString()}`, sub: "train or taxi between the airport and your hotel", est: true });
    }
  }

  return { lines, usage, cash: Math.round(cash), retail: Math.round(retail) };
}
