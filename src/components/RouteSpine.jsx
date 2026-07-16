import React from "react";
import { Plane, TrainFront } from "lucide-react";
import { T } from "../theme.js";
import { CITIES } from "../data/cities.js";
import { GATEWAYS } from "../data/rail.js";
import { hm } from "../lib/trip.js";

/**
 * The signature element: the itinerary rendered like a Shinkansen
 * in-car stop display — solid Tokaido-blue links for rail, dashed
 * vermillion for flight segments.
 */
export function RouteSpine({ route, compact }) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex items-center" style={{ minWidth: "max-content" }}>
        <SpineNode label="TPA" sub="Tampa" mode="flight" />
        <SpineLink mode="flight" label={`fly · ${route.inGw.gw}`} />
        <SpineNode label={route.inGw.gw} sub={GATEWAYS[route.inGw.gw].city} mode="flight" />
        <SpineLink mode="train" label={hm(route.inGw.min)} />
        {route.order.map((cid, i) => (
          <React.Fragment key={cid}>
            <SpineNode label={CITIES[cid].name} sub={CITIES[cid].jp} main />
            {i < route.order.length - 1 && (
              <SpineLink
                mode="train"
                label={compact ? hm(route.legs[i].min) : `${route.legs[i].svc.split("(")[0].trim()} · ${hm(route.legs[i].min)}`}
              />
            )}
          </React.Fragment>
        ))}
        <SpineLink mode="train" label={hm(route.outGw.min)} />
        <SpineNode label={route.outGw.gw} sub={GATEWAYS[route.outGw.gw].city} mode="flight" />
        <SpineLink mode="flight" label="fly home" />
        <SpineNode label="TPA" sub="Tampa" mode="flight" />
      </div>
    </div>
  );
}

const SpineNode = ({ label, sub, main, mode }) => (
  <div className="flex flex-col items-center px-1" style={{ minWidth: 64 }}>
    <div
      className="flex items-center justify-center rounded-full"
      style={{
        width: main ? 40 : 30,
        height: main ? 40 : 30,
        background: main ? T.ink : mode === "flight" ? T.flightTint : T.railTint,
        border: `2.5px solid ${main ? T.ink : mode === "flight" ? T.flight : T.rail}`,
        color: main ? "#fff" : mode === "flight" ? T.flight : T.rail,
      }}
    >
      {main ? <TrainFront size={18} /> : <Plane size={14} />}
    </div>
    <div className="text-xs font-bold mt-1" style={{ color: T.ink }}>{label}</div>
    {sub && <div className="text-xs" style={{ color: T.inkSoft, fontFamily: "'Zen Old Mincho', serif" }}>{sub}</div>}
  </div>
);

const SpineLink = ({ mode, label }) => (
  <div className="flex flex-col items-center" style={{ minWidth: 74 }}>
    <div
      style={{
        height: 4,
        width: "100%",
        borderRadius: 2,
        background:
          mode === "flight"
            ? `repeating-linear-gradient(90deg, ${T.flight} 0 8px, transparent 8px 14px)`
            : T.rail,
        marginBottom: 4,
        marginTop: 13,
      }}
    />
    <div
      className="text-xs whitespace-nowrap"
      style={{ color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 }}
    >
      {label}
    </div>
  </div>
);
