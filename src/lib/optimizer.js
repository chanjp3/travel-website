/**
 * Route optimizer — generalized, mode-aware.
 * Brute-forces every ordering of the selected stops (≤8 is trivial compute).
 * Each inter-stop edge is rail if a corridor pack covers it, otherwise a
 * flight estimate. Entry/exit gateway logic: Japan-pack ends use the
 * HND/KIX access matrix (open-jaw discovery); everywhere else the end
 * city's own airport is the gateway.
 */
import { railEdge, packById } from "../data/corridors/index.js";
import { cityById } from "../data/world.js";
import { km, flightMin, cashEst } from "./geo.js";
import { routing } from "./flightsEngine.js";

export function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  arr.forEach((x, i) => {
    permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).forEach((p) => out.push([x, ...p]));
  });
  return out;
}

export function edgeFor(a, b) {
  const rail = railEdge(a, b);
  if (rail) return rail;
  const d = km(cityById[a], cityById[b]);
  // Short hops (a town near its anchor city) are ground legs, not flights.
  if (d < 300) {
    return {
      mode: "rail", min: Math.round(35 + (d / 70) * 60),
      usd: Math.round(6 + d * 0.18),
      svc: "Regional rail / drive", via: null,
    };
  }
  const r = routing(a, b);
  return {
    mode: "flight", min: r.min + 130, // +130m airport overhead both ends
    usd: cashEst(r.distKm, "Economy"),
    svc: r.via ? `Fly via ${r.via.air}` : "Fly nonstop",
    via: r.via?.air ?? null,
  };
}

function endGateway(cityId, originCity) {
  const c = cityById[cityId];
  const jp = packById("japan");
  if (c.pack === "japan" && jp.access[cityId]) {
    const h = jp.access[cityId].HND, k = jp.access[cityId].KIX;
    const hS = h.min + h.yen / 300, kS = k.min + k.yen / 300;
    return hS <= kS
      ? { gw: "HND", min: h.min, usd: h.yen / 150, yen: h.yen }
      : { gw: "KIX", min: k.min, usd: k.yen / 150, yen: k.yen };
  }
  return { gw: c.air, min: 45, usd: 15 }; // own airport, nominal local transfer
}

export function scoreRoutes(cityIds, wCost, originId, { endAt, startAt, inGwIata, outGwIata } = {}) {
  const wTime = 1 - wCost;
  const origin = cityById[originId];
  // startAt/endAt pin the first/last stop (where you land / where the trip
  // ends); the orderings in between still compete.
  let perms = permutations(cityIds);
  if (startAt && cityIds.includes(startAt) && cityIds.length > 1) {
    perms = perms.filter((p) => p[0] === startAt);
  }
  if (endAt && cityIds.includes(endAt) && cityIds.length > 1) {
    perms = perms.filter((p) => p[p.length - 1] === endAt);
  }

  // Explicitly chosen gateway airports override the access-matrix choice.
  const forceGw = (base, cityId, iata) => {
    if (!iata || base.gw === iata) return base;
    const c = cityById[cityId];
    const jp = packById("japan");
    const acc = c.pack === "japan" ? jp.access[cityId]?.[iata] : null;
    return acc
      ? { gw: iata, min: acc.min, usd: acc.yen / 150, yen: acc.yen }
      : { gw: iata, min: 60, usd: 20 };
  };

  const scored = perms.map((order) => {
    const inGw = forceGw(endGateway(order[0], origin), order[0], inGwIata);
    const outGw = forceGw(endGateway(order[order.length - 1], origin), order[order.length - 1], outGwIata);
    let groundMin = 0, groundUsd = 0, groundYen = 0;
    const legs = [];
    for (let i = 0; i < order.length - 1; i++) {
      const e = edgeFor(order[i], order[i + 1]);
      groundMin += e.min; groundUsd += e.usd; groundYen += e.yen ?? 0;
      legs.push({ from: order[i], to: order[i + 1], ...e });
    }
    // Long-haul positioning cost: time from origin to entry gw + exit gw home.
    const inLeg = routing(originId, order[0]);
    const outLeg = routing(order[order.length - 1], originId);
    const airMin = inLeg.min + outLeg.min;

    const totalMin = groundMin + inGw.min + outGw.min;
    const totalUsd = groundUsd + inGw.usd + outGw.usd;
    return {
      order, inGw, outGw, legs,
      groundMin, groundUsd,
      totalMin, totalUsd, airMin,
      totalYen: groundYen + (inGw.yen ?? 0) + (outGw.yen ?? 0),
      hasRail: legs.some((l) => l.mode === "rail"),
      hasJapanRail: legs.some((l) => l.mode === "rail" && l.jr !== undefined),
    };
  });

  const maxMin = Math.max(...scored.map((s) => s.totalMin + s.airMin));
  const maxUsd = Math.max(...scored.map((s) => s.totalUsd));
  scored.forEach((s) => {
    s.score = wCost * (s.totalUsd / maxUsd) + wTime * ((s.totalMin + s.airMin) / maxMin);
  });
  scored.sort((a, b) => a.score - b.score);

  const seen = new Set(); const top = [];
  for (const s of scored) {
    const key = [...s.order].join(">") + s.inGw.gw + s.outGw.gw;
    const mirror = [...s.order].reverse().join(">") + s.outGw.gw + s.inGw.gw;
    if (!endAt && !startAt && seen.has(mirror)) continue; // pinned ends: mirrors aren't equivalent
    seen.add(key); top.push(s);
    if (top.length === 3) break;
  }

  // Naive baseline: listed order, round trip through the first city's gateway.
  const naive = (() => {
    let m = 0, u = 0;
    for (let i = 0; i < cityIds.length - 1; i++) {
      const e = edgeFor(cityIds[i], cityIds[i + 1]);
      m += e.min; u += e.usd;
    }
    const back = edgeFor(cityIds[cityIds.length - 1], cityIds[0]);
    m += back.min; u += back.usd;
    const g = endGateway(cityIds[0]);
    m += g.min * 2; u += g.usd * 2;
    return { totalMin: m, totalUsd: u };
  })();

  return { top, naive };
}
