import React from "react";
import { Plane, TrainFront } from "lucide-react";
import { T } from "../theme.js";
import { cityById } from "../data/world.js";
import { JP_NAMES, hm } from "../lib/trip.js";

/** Shinkansen in-car stop display — now mode-aware for any trip. */
export function RouteSpine({ route, originId, compact }) {
  const origin = cityById[originId];
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex items-center" style={{ minWidth: "max-content" }}>
        <SpineNode label={origin.air} sub={origin.name} mode="flight" />
        <SpineLink mode="flight" label={`fly · ${route.inGw.gw}`} />
        {route.inGw.gw !== cityById[route.order[0]].air || route.inGw.min > 60 ? (
          <>
            <SpineNode label={route.inGw.gw} mode="flight" />
            <SpineLink mode="train" label={hm(route.inGw.min)} />
          </>
        ) : null}
        {route.order.map((cid, i) => {
          const c = cityById[cid];
          const leg = route.legs[i];
          return (
            <React.Fragment key={cid}>
              <SpineNode label={c.name} sub={JP_NAMES[cid] ?? c.country} main />
              {leg && (
                <SpineLink
                  mode={leg.mode === "rail" ? "train" : "flight"}
                  label={compact ? hm(leg.min) : `${leg.svc.split("(")[0].trim()} · ${hm(leg.min)}`}
                />
              )}
            </React.Fragment>
          );
        })}
        <SpineLink mode="train" label={hm(route.outGw.min)} />
        <SpineNode label={route.outGw.gw} mode="flight" />
        <SpineLink mode="flight" label="fly home" />
        <SpineNode label={origin.air} sub={origin.name} mode="flight" />
      </div>
    </div>
  );
}

const SpineNode = ({ label, sub, main, mode }) => (
  <div className="flex flex-col items-center px-1" style={{ minWidth: 64 }}>
    <div
      className="flex items-center justify-center rounded-full"
      style={{
        width: main ? 40 : 30, height: main ? 40 : 30,
        background: main ? T.ink : mode === "flight" ? T.flightTint : T.railTint,
        border: `2.5px solid ${main ? T.ink : mode === "flight" ? T.flight : T.rail}`,
        color: main ? "#04060B" : mode === "flight" ? T.flight : T.rail,
      }}
    >
      {main ? <TrainFront size={18} /> : <Plane size={14} />}
    </div>
    <div className="text-xs font-bold mt-1" style={{ color: T.ink }}>{label}</div>
    {sub && <div className="text-xs" style={{ color: T.inkSoft, fontFamily: "'Jost', 'Century Gothic', sans-serif" }}>{sub}</div>}
  </div>
);

const SpineLink = ({ mode, label }) => (
  <div className="flex flex-col items-center" style={{ minWidth: 74 }}>
    <div
      style={{
        height: 4, width: "100%", borderRadius: 2,
        background: mode === "flight"
          ? `repeating-linear-gradient(90deg, ${T.flight} 0 8px, transparent 8px 14px)`
          : T.rail,
        marginBottom: 4, marginTop: 13,
      }}
    />
    <div className="text-xs whitespace-nowrap" style={{ color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 }}>{label}</div>
  </div>
);
