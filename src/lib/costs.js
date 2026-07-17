import { SOURCES } from "../data/transferPartners.js";

/**
 * Trip ledger — the full cost rundown.
 * Aggregates flights (long-haul, points or cash), hotels (points or cash),
 * and all ground transport (rail + inter-stop flights, JR Pass applied when
 * it wins) into display lines, per-source points usage, and totals.
 */
export function buildLedger({ flights, hotels, route, jr }) {
  const lines = [];
  const usage = {};
  let cash = 0;
  let retail = 0;
  const spend = (src, pts) => { usage[src] = (usage[src] ?? 0) + pts; };

  // ── long-haul flights ──
  flights.forEach(({ label, f, mode, path }) => {
    retail += f.cash;
    if (mode === "points" && path && f.points) {
      spend(path.source, path.srcPts);
      cash += f.fees;
      lines.push({
        group: "Flights", label: `${label} · ${f.airline} ${f.cabin}`,
        value: `${(path.srcPts / 1000).toFixed(0)}K ${SOURCES[path.source].short} + $${f.fees}`,
        sub: path.type === "transfer" ? `→ ${SOURCES[f.programId].short}` : null,
        est: f.est,
      });
    } else {
      cash += f.cash;
      lines.push({ group: "Flights", label: `${label} · ${f.airline} ${f.cabin}`, value: `$${f.cash.toLocaleString()} cash`, est: f.est });
    }
  });

  // ── hotels ──
  hotels.forEach(({ hotel, nights, mode, path }) => {
    retail += hotel.cash * nights;
    if (mode === "points" && path && hotel.pts) {
      spend(path.source, path.srcPts);
      lines.push({
        group: "Hotels", label: `${hotel.name} · ${nights} nt`,
        value: `${(path.srcPts / 1000).toFixed(0)}K ${SOURCES[path.source].short}`,
        sub: path.type === "transfer" ? `→ ${SOURCES[hotel.pid].short} (${((hotel.pts * nights) / 1000).toFixed(0)}K)` : null,
      });
    } else {
      cash += hotel.cash * nights;
      lines.push({ group: "Hotels", label: `${hotel.name} · ${nights} nt`, value: `$${(hotel.cash * nights).toLocaleString()} cash` });
    }
  });

  // ── ground transport ──
  const railLegs = route.legs.filter((l) => l.mode === "rail");
  const flightLegs = route.legs.filter((l) => l.mode === "flight");
  const accessUsd = route.inGw.usd + route.outGw.usd;

  if (railLegs.length || accessUsd) {
    let railUsd = railLegs.reduce((s, l) => s + l.usd, 0) + accessUsd;
    let note = "point-to-point tickets";
    if (jr?.worthIt) {
      const railYen = railLegs.reduce((s, l) => s + (l.yen ?? 0), 0) + (route.totalYen - railLegs.reduce((s, l) => s + (l.yen ?? 0), 0));
      const paidYen = jr.pass.cost + Math.max(0, railYen - jr.jrYen);
      railUsd = paidYen / 150 + railLegs.filter((l) => l.yen === undefined).reduce((s, l) => s + l.usd, 0);
      note = `${jr.pass.name} applied — saves ¥${(jr.jrYen - jr.pass.cost).toLocaleString()}`;
    }
    cash += railUsd; retail += railUsd;
    lines.push({ group: "Ground", label: "Rail & airport transfers", value: `$${Math.round(railUsd).toLocaleString()}`, sub: note });
  }
  flightLegs.forEach((l) => {
    cash += l.usd; retail += l.usd;
    lines.push({ group: "Ground", label: `Regional flight · ${l.svc}`, value: `$${Math.round(l.usd).toLocaleString()} est.`, sub: "regional award support in a later build", est: true });
  });

  return { lines, usage, cash: Math.round(cash), retail: Math.round(retail) };
}
