import React from "react";
import { T } from "../theme.js";
import { cityById } from "../data/world.js";

const GW_COORDS = { HND: { lat: 35.55, lon: 139.78 }, KIX: { lat: 34.43, lon: 135.24 } };

/** Auto-fitting route diagram — works for any set of stops worldwide. */
export function JourneyMap({ route, originId }) {
  const W = 640, H = 380;
  const stops = route.order.map((cid) => cityById[cid]);
  const gwIn = GW_COORDS[route.inGw.gw] ?? stops[0];
  const gwOut = GW_COORDS[route.outGw.gw] ?? stops[stops.length - 1];
  const all = [...stops, gwIn, gwOut];

  let minLat = Math.min(...all.map((p) => p.lat)), maxLat = Math.max(...all.map((p) => p.lat));
  let minLon = Math.min(...all.map((p) => p.lon)), maxLon = Math.max(...all.map((p) => p.lon));
  const padLat = Math.max((maxLat - minLat) * 0.25, 0.8);
  const padLon = Math.max((maxLon - minLon) * 0.18, 0.8);
  minLat -= padLat; maxLat += padLat; minLon -= padLon; maxLon += padLon;

  const px = (lon) => 40 + ((lon - minLon) / (maxLon - minLon)) * (W - 90);
  const py = (lat) => H - 46 - ((lat - minLat) / (maxLat - minLat)) * (H - 100);
  const pts = stops.map((c, i) => ({ cid: route.order[i], x: px(c.lon), y: py(c.lat) }));
  const inP = { x: px(gwIn.lon), y: py(gwIn.lat) };
  const outP = { x: px(gwOut.lon), y: py(gwOut.lat) };
  const origin = cityById[originId];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl" style={{ background: "#070C16", border: `1px solid ${T.mist}` }}>
      {[...Array(9)].map((_, i) => (
        <line key={"v" + i} x1={40 + (i * (W - 90)) / 8} y1={20} x2={40 + (i * (W - 90)) / 8} y2={H - 30} stroke="#15233C" strokeWidth="1" />
      ))}
      {[...Array(6)].map((_, i) => (
        <line key={"h" + i} x1={30} y1={30 + (i * (H - 76)) / 5} x2={W - 40} y2={30 + (i * (H - 76)) / 5} stroke="#15233C" strokeWidth="1" />
      ))}
      <text x={W - 44} y={H - 12} textAnchor="end" fontSize="10" fill={T.inkSoft} fontFamily="'IBM Plex Mono', monospace">
        ROUTE DIAGRAM · {route.inGw.gw} IN / {route.outGw.gw} OUT
      </text>

      {/* long-haul in/out arcs */}
      <path d={`M ${W - 18} ${H - 60} Q ${(inP.x + W) / 2} ${Math.max(inP.y - 90, 15)} ${inP.x} ${inP.y}`} fill="none" stroke={T.flight} strokeWidth="2.5" strokeDasharray="7 5" />
      <text x={W - 22} y={H - 66} textAnchor="end" fontSize="10" fontWeight="700" fill={T.flight} fontFamily="'IBM Plex Mono', monospace">{origin.air} ✈ IN</text>
      <path d={`M ${outP.x} ${outP.y} Q ${outP.x - 60} ${H - 20} ${34} ${H - 34}`} fill="none" stroke={T.flight} strokeWidth="2.5" strokeDasharray="7 5" />
      <text x={30} y={H - 40} fontSize="10" fontWeight="700" fill={T.flight} fontFamily="'IBM Plex Mono', monospace">✈ {origin.air} OUT</text>

      {/* gateway access */}
      <line x1={inP.x} y1={inP.y} x2={pts[0].x} y2={pts[0].y} stroke={T.rail} strokeWidth="2" strokeDasharray="2 4" />
      <line x1={outP.x} y1={outP.y} x2={pts[pts.length - 1].x} y2={pts[pts.length - 1].y} stroke={T.rail} strokeWidth="2" strokeDasharray="2 4" />

      {/* inter-stop legs: rail solid, flight dashed arc */}
      {pts.slice(0, -1).map((p, i) => {
        const q = pts[i + 1];
        const leg = route.legs[i];
        if (leg?.mode === "flight") {
          const mx = (p.x + q.x) / 2, my = Math.min(p.y, q.y) - 40;
          return <path key={i} d={`M ${p.x} ${p.y} Q ${mx} ${my} ${q.x} ${q.y}`} fill="none" stroke={T.flight} strokeWidth="3" strokeDasharray="7 5" />;
        }
        return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={T.rail} strokeWidth="4" strokeLinecap="round" />;
      })}

      {/* gateway badges */}
      {[["in", inP, route.inGw.gw], ["out", outP, route.outGw.gw]].map(([k, p, gw]) => (
        <g key={k}>
          <rect x={p.x - 17} y={p.y - 9} width="34" height="18" rx="4" fill="#0A0F1A" stroke={T.flight} strokeWidth="1.5" />
          <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={T.flight} fontFamily="'IBM Plex Mono', monospace">{gw}</text>
        </g>
      ))}

      {/* stops — silver night badges */}
      {pts.map((p, i) => (
        <g key={p.cid}>
          <circle cx={p.x} cy={p.y} r="11" fill={T.gold} />
          <circle cx={p.x} cy={p.y} r="11" fill="none" stroke="#04060B" strokeWidth="1.5" />
          <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="9" fontWeight="800" fill="#0A0F1A">{i + 1}</text>
          <text x={p.x} y={p.y - 17} textAnchor="middle" fontSize="12" fontWeight="700" fill={T.ink}>{cityById[p.cid].name}</text>
        </g>
      ))}
    </svg>
  );
}
