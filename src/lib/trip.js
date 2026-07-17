import { cityById } from "../data/world.js";
import { packFor, packById } from "../data/corridors/index.js";

/* ── formatting ────────────────────────────────────────────── */
export const hm = (min) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
export const usd = (n) => `$${Math.round(n).toLocaleString()}`;
export const yen = (n) => `¥${Math.round(n).toLocaleString()}`;
export const cpp = (f) => (((f.cash - f.fees) / f.points) * 100).toFixed(1);

/* ── JR Pass break-even (only when the route rides Japan rail) ─ */
export function jrPassAnalysis(route) {
  if (!route?.hasJapanRail) return null;
  let jrYen = 0;
  route.legs.forEach((l) => {
    if (l.mode !== "rail" || l.yen === undefined) return;
    if (l.jr) jrYen += l.jr === "hikari" ? l.yen - 320 : l.jr === "part" ? l.yen * 0.7 : l.yen;
  });
  jrYen += (route.totalYen - route.legs.reduce((s, l) => s + (l.yen ?? 0), 0)) * 0.6; // airport access share
  const railDays = 1 + route.legs.filter((l) => l.mode === "rail").length;
  const pass = railDays <= 7 ? { name: "7-day JR Pass", cost: 50000 } : { name: "14-day JR Pass", cost: 80000 };
  return { jrYen: Math.round(jrYen), pass, worthIt: jrYen > pass.cost };
}

/* ── generic attraction fallback for cities without a pack ───── */
const genericPool = (name) => [
  { n: `${name} old town & landmarks walk`, h: 3 },
  { n: `${name} top museum or gallery`, h: 2 },
  { n: `Local market & food crawl`, h: 2 },
  { n: `${name} viewpoint at sunset`, h: 1.5 },
  { n: `Neighborhood dinner, local pick`, h: 2 },
  { n: `Day trip or free morning`, h: 3 },
];

export function attractionsFor(cityId) {
  const pack = packFor(cityId);
  const c = cityById[cityId];
  return pack?.attractions?.[cityId]?.length
    ? [...pack.attractions[cityId]]
    : genericPool(c.name);
}

/* ── day-by-day itinerary assembly ─────────────────────────── */
export function buildDays(route, nights, originId) {
  const origin = cityById[originId];
  const days = [];
  let d = 1;
  const firstCity = cityById[route.order[0]];
  const longHaul = true; // positioning legs handled by flight engine

  days.push({
    day: d++, city: null, title: `Depart ${origin.name}`,
    items: [
      { icon: "flight", t: "Departure", n: `${origin.air} → ${route.inGw.gw} (${firstCity.name})` },
      { icon: "flight", t: "En route", n: "Long-haul leg — connections per your selected flight" },
    ],
  });

  route.order.forEach((cid, idx) => {
    const c = cityById[cid];
    const n = nights[cid] ?? 2;
    const pool = attractionsFor(cid);
    for (let night = 0; night < n; night++) {
      const items = [];
      if (night === 0) {
        if (idx === 0) {
          items.push({ icon: "flight", t: "Arrival", n: `Land ${route.inGw.gw}` });
          items.push({ icon: "train", t: `+${hm(route.inGw.min)}`, n: `Airport → ${c.name} hotel (door to door)` });
          const a = pool.shift();
          if (a) items.push({ icon: "spot", t: "Evening", n: a.n });
        } else {
          const leg = route.legs[idx - 1];
          const legIcon = leg.mode === "rail" ? "train" : "flight";
          const legCost = leg.yen ? `¥${leg.yen.toLocaleString()}` : `$${Math.round(leg.usd)}`;
          items.push({ icon: legIcon, t: "Morning", n: `${cityById[leg.from].name} → ${c.name} · ${leg.svc} · ${hm(leg.min)} · ${legCost}` });
          items.push({ icon: "hotel", t: "Midday", n: "Check in, drop bags" });
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
      const pk = packFor(cid);
      days.push({ day: d++, city: cid, title: pk?.id === "japan" ? `${c.name} ${jpName(cid)}` : `${c.name}, ${c.country}`, items });
    }
  });

  const lastCity = cityById[route.order[route.order.length - 1]];
  days.push({
    day: d++, city: null, title: `Fly home to ${origin.name}`,
    items: [
      { icon: "train", t: "Morning", n: `${lastCity.name} → ${route.outGw.gw} · ${hm(route.outGw.min)}` },
      { icon: "flight", t: "Departure", n: `${route.outGw.gw} → ${origin.air}` },
    ],
  });
  return days;
}

const JP_NAMES = { tokyo: "東京", kyoto: "京都", osaka: "大阪", hakone: "箱根", nara: "奈良", hiroshima: "広島", kanazawa: "金沢" };
const jpName = (id) => JP_NAMES[id] ?? "";
export { JP_NAMES };
