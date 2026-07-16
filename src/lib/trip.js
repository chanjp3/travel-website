import { CITIES } from "../data/cities.js";
import { GATEWAYS } from "../data/rail.js";
import { ATTRACTIONS } from "../data/attractions.js";

/* ── formatting ────────────────────────────────────────────── */
export const hm = (min) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
export const usd = (n) => `$${Math.round(n).toLocaleString()}`;
export const yen = (n) => `¥${Math.round(n).toLocaleString()}`;
/** cents-per-point value of an award option vs. its cash fare */
export const cpp = (f) => (((f.cash - f.fees) / f.points) * 100).toFixed(1);

/* ── JR Pass break-even ────────────────────────────────────── */
/**
 * Compares the itinerary's JR-covered fares against the pass price.
 * Nozomi-priced legs flagged "hikari" are counted at Hikari-equivalent;
 * "part" legs are counted at 70% coverage; airport access at 60%
 * (Haneda monorail / Haruka are JR or JR-adjacent, private lines aren't).
 */
export function jrPassAnalysis(route) {
  if (!route) return null;
  let jrYen = 0;
  route.legs.forEach((l) => {
    if (l.jr) jrYen += l.jr === "hikari" ? l.yen - 320 : l.jr === "part" ? l.yen * 0.7 : l.yen;
  });
  jrYen += route.accessYen * 0.6;
  const tripDays = 1 + route.legs.length;
  const pass = tripDays <= 7
    ? { name: "7-day JR Pass", cost: 50000 }
    : { name: "14-day JR Pass", cost: 80000 };
  return { jrYen: Math.round(jrYen), pass, worthIt: jrYen > pass.cost };
}

/* ── day-by-day itinerary assembly ─────────────────────────── */
export function buildDays(route, nights) {
  const days = [];
  let d = 1;

  days.push({
    day: d++, city: null, title: "Depart Tampa",
    items: [
      { icon: "flight", t: "Morning", n: "TPA departure — connect to the transpacific leg" },
      { icon: "flight", t: "Overnight", n: "Cross the Pacific (date line: you land tomorrow, day after departure)" },
    ],
  });

  route.order.forEach((cid, idx) => {
    const c = CITIES[cid];
    const n = nights[cid] ?? c.nights;
    const pool = [...ATTRACTIONS[cid]];

    for (let night = 0; night < n; night++) {
      const items = [];
      if (night === 0) {
        if (idx === 0) {
          items.push({ icon: "flight", t: "3:40 PM", n: `Land ${route.inGw.gw} (${GATEWAYS[route.inGw.gw].name})` });
          items.push({ icon: "train", t: `+${hm(route.inGw.min)}`, n: `Airport → ${c.name} hotel (door to door)` });
          const a = pool.shift();
          if (a) items.push({ icon: "spot", t: "Evening", n: a.n });
        } else {
          const leg = route.legs[idx - 1];
          items.push({ icon: "train", t: "Morning", n: `${CITIES[leg.from].name} → ${c.name} · ${leg.svc} · ${hm(leg.min)} · ${yen(leg.yen)}` });
          items.push({ icon: "hotel", t: "Midday", n: "Check in, drop bags (add ~25m hotel↔station each side)" });
          let used = 0;
          while (pool.length && used < 4.5) {
            const a = pool.shift();
            items.push({ icon: "spot", t: used < 2.5 ? "Afternoon" : "Evening", n: `${a.n} (${a.h}h)` });
            used += a.h;
          }
        }
      } else {
        let used = 0;
        while (pool.length && used < 7) {
          const a = pool.shift();
          items.push({ icon: "spot", t: used < 3 ? "Morning" : used < 5.5 ? "Afternoon" : "Evening", n: `${a.n} (${a.h}h)` });
          used += a.h;
        }
        if (!items.length) items.push({ icon: "spot", t: "All day", n: `Free day in ${c.name}` });
      }
      days.push({ day: d++, city: cid, title: `${c.name} ${c.jp}`, items });
    }
  });

  const lastCity = CITIES[route.order[route.order.length - 1]];
  days.push({
    day: d++, city: null, title: "Fly home",
    items: [
      { icon: "train", t: "Morning", n: `${lastCity.name} → ${route.outGw.gw} (${GATEWAYS[route.outGw.gw].name}) · ${hm(route.outGw.min)}` },
      { icon: "flight", t: "Afternoon", n: `Depart ${route.outGw.gw} → TPA · land same calendar day (you gain the date line back)` },
    ],
  });

  return days;
}
