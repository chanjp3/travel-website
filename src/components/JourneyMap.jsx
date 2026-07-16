import React from "react";
import { T } from "../theme.js";
import { CITIES } from "../data/cities.js";

/**
 * Projected route diagram over Honshu — lon/lat mapped linearly into the
 * viewBox. Deliberately a rail-signage diagram rather than a geographic
 * basemap; swap for MapLibre/Mapbox in the next build phase.
 */
export function JourneyMap({ route }) {
  const W = 640, H = 380;
  const px = (lon) => 40 + ((lon - 131.8) / (140.6 - 131.8)) * (W - 90);
  const py = (lat) => H - 46 - ((lat - 33.9) / (37.1 - 33.9)) * (H - 100);

  const pts = route.order.map((cid) => ({ cid, x: px(CITIES[cid].lon), y: py(CITIES[cid].lat) }));
  const gwPos = {
    HND: { x: px(139.78), y: py(35.55) },
    KIX: { x: px(135.24), y: py(34.43) },
  };
  const inP = gwPos[route.inGw.gw];
  const outP = gwPos[route.outGw.gw];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl" style={{ background: "#F2F3EE", border: `1px solid ${T.mist}` }}>
      {/* graticule */}
      {[...Array(9)].map((_, i) => (
        <line key={"v" + i} x1={40 + (i * (W - 90)) / 8} y1={20} x2={40 + (i * (W - 90)) / 8} y2={H - 30} stroke="#E0E1DA" strokeWidth="1" />
      ))}
      {[...Array(6)].map((_, i) => (
        <line key={"h" + i} x1={30} y1={30 + (i * (H - 76)) / 5} x2={W - 40} y2={30 + (i * (H - 76)) / 5} stroke="#E0E1DA" strokeWidth="1" />
      ))}
      <text x={W - 44} y={H - 12} textAnchor="end" fontSize="10" fill={T.inkSoft} fontFamily="'IBM Plex Mono', monospace">
        HONSHU ROUTE DIAGRAM · 本州
      </text>

      {/* inbound flight arc */}
      <path
        d={`M ${W - 18} ${H - 60} Q ${(inP.x + W) / 2} ${inP.y - 90} ${inP.x} ${inP.y}`}
        fill="none" stroke={T.flight} strokeWidth="2.5" strokeDasharray="7 5"
      />
      <text x={W - 22} y={H - 66} textAnchor="end" fontSize="10" fontWeight="700" fill={T.flight} fontFamily="'IBM Plex Mono', monospace">
        TPA ✈ IN
      </text>

      {/* outbound flight arc */}
      <path
        d={`M ${outP.x} ${outP.y} Q ${outP.x - 60} ${H - 20} ${34} ${H - 34}`}
        fill="none" stroke={T.flight} strokeWidth="2.5" strokeDasharray="7 5"
      />
      <text x={30} y={H - 40} fontSize="10" fontWeight="700" fill={T.flight} fontFamily="'IBM Plex Mono', monospace">
        ✈ TPA OUT
      </text>

      {/* airport access */}
      <line x1={inP.x} y1={inP.y} x2={pts[0].x} y2={pts[0].y} stroke={T.rail} strokeWidth="2" strokeDasharray="2 4" />
      <line x1={outP.x} y1={outP.y} x2={pts[pts.length - 1].x} y2={pts[pts.length - 1].y} stroke={T.rail} strokeWidth="2" strokeDasharray="2 4" />

      {/* rail legs */}
      {pts.slice(0, -1).map((p, i) => (
        <line key={i} x1={p.x} y1={p.y} x2={pts[i + 1].x} y2={pts[i + 1].y} stroke={T.rail} strokeWidth="4" strokeLinecap="round" />
      ))}

      {/* gateways */}
      {[["in", inP, route.inGw.gw], ["out", outP, route.outGw.gw]].map(([k, p, gw]) => (
        <g key={k}>
          <rect x={p.x - 17} y={p.y - 9} width="34" height="18" rx="4" fill="#fff" stroke={T.flight} strokeWidth="1.5" />
          <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={T.flight} fontFamily="'IBM Plex Mono', monospace">{gw}</text>
        </g>
      ))}

      {/* city nodes */}
      {pts.map((p, i) => (
        <g key={p.cid}>
          <circle cx={p.x} cy={p.y} r="11" fill={T.ink} />
          <circle cx={p.x} cy={p.y} r="11" fill="none" stroke="#fff" strokeWidth="2.5" />
          <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff">{i + 1}</text>
          <text x={p.x} y={p.y - 17} textAnchor="middle" fontSize="12" fontWeight="700" fill={T.ink}>{CITIES[p.cid].name}</text>
        </g>
      ))}
    </svg>
  );
}
