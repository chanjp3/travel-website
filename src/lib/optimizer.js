import { edge, ACCESS } from "../data/rail.js";

/**
 * Route optimizer — brute-force permutation scoring.
 *
 * With ≤8 stops the full permutation space is tiny (8! = 40,320), so we
 * enumerate every ordering, choose the best entry/exit gateway per ordering,
 * and score on a weighted blend of total ground cost and total ground time.
 * The transpacific legs are approximately constant across orderings, so
 * they don't need to participate in the ranking — gateway *access* does,
 * and that's what makes open-jaw routings win.
 */
export function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  arr.forEach((x, i) => {
    permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).forEach((p) =>
      out.push([x, ...p])
    );
  });
  return out;
}

/**
 * @param {string[]} cityIds selected city ids
 * @param {number} wCost 0..1 — weight on cost (1-wCost goes to time)
 * @returns {{ top: Route[], naive: {totalMin:number,totalYen:number} }}
 */
export function scoreRoutes(cityIds, wCost) {
  const wTime = 1 - wCost;
  const perms = permutations(cityIds);

  const scored = perms.map((order) => {
    const first = order[0];
    const last = order[order.length - 1];

    // Pick the gateway minimizing a time-weighted access score for each end.
    const pick = (cid) => {
      const h = ACCESS[cid].HND;
      const k = ACCESS[cid].KIX;
      const hS = h.min + h.yen / 300;
      const kS = k.min + k.yen / 300;
      return hS <= kS ? { gw: "HND", ...h } : { gw: "KIX", ...k };
    };
    const inGw = pick(first);
    const outGw = pick(last);

    let railMin = 0;
    let railYen = 0;
    const legs = [];
    for (let i = 0; i < order.length - 1; i++) {
      const e = edge(order[i], order[i + 1]);
      railMin += e.min;
      railYen += e.yen;
      legs.push({ from: order[i], to: order[i + 1], ...e });
    }

    const accessMin = inGw.min + outGw.min;
    const accessYen = inGw.yen + outGw.yen;
    return {
      order, inGw, outGw, legs,
      railMin, railYen, accessMin, accessYen,
      totalMin: railMin + accessMin,
      totalYen: railYen + accessYen,
    };
  });

  const maxMin = Math.max(...scored.map((s) => s.totalMin));
  const maxYen = Math.max(...scored.map((s) => s.totalYen));
  scored.forEach((s) => {
    s.score = wCost * (s.totalYen / maxYen) + wTime * (s.totalMin / maxMin);
  });
  scored.sort((a, b) => a.score - b.score);

  // De-duplicate exact mirror routes (reversed order with mirrored gateways
  // is the same trip run backwards).
  const seen = new Set();
  const top = [];
  for (const s of scored) {
    const key = [...s.order].join(">") + s.inGw.gw + s.outGw.gw;
    const mirror = [...s.order].reverse().join(">") + s.outGw.gw + s.inGw.gw;
    if (seen.has(mirror)) continue;
    seen.add(key);
    top.push(s);
    if (top.length === 3) break;
  }

  // Baseline for the "why this wins" explanation: the user's listed order
  // as a naive Tokyo round trip.
  const naive = (() => {
    let m = 0, y = 0;
    for (let i = 0; i < cityIds.length - 1; i++) {
      const e = edge(cityIds[i], cityIds[i + 1]);
      m += e.min; y += e.yen;
    }
    const lastCity = cityIds[cityIds.length - 1];
    if (lastCity !== "tokyo") {
      const back = edge(lastCity, "tokyo");
      if (back) { m += back.min; y += back.yen; }
    }
    m += ACCESS[cityIds[0]].HND.min + ACCESS.tokyo.HND.min;
    y += ACCESS[cityIds[0]].HND.yen + ACCESS.tokyo.HND.yen;
    return { totalMin: m, totalYen: y };
  })();

  return { top, naive };
}
