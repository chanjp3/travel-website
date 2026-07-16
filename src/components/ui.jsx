import React from "react";
import { Check } from "lucide-react";
import { T } from "../theme.js";
import { CITIES } from "../data/cities.js";

export const Chip = ({ children, tint, color }) => (
  <span
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
    style={{ background: tint, color }}
  >
    {children}
  </span>
);

export const SectionLabel = ({ children }) => (
  <div className="flex items-center gap-2 mb-3">
    <div style={{ width: 18, height: 3, background: T.rail }} />
    <span
      className="text-xs font-bold tracking-widest uppercase"
      style={{ color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}
    >
      {children}
    </span>
  </div>
);

export function NightsStepper({ n, setN }) {
  return (
    <span className="inline-flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${T.mist}` }}>
      <button onClick={() => setN(Math.max(1, n - 1))} className="px-2 py-1 font-bold" style={{ background: T.paper }}>−</button>
      <span className="px-2.5 py-1 font-bold" style={{ background: "#fff", fontFamily: "'IBM Plex Mono', monospace" }}>{n}</span>
      <button onClick={() => setN(Math.min(6, n + 1))} className="px-2 py-1 font-bold" style={{ background: T.paper }}>+</button>
    </span>
  );
}

export function StopCard({ cid, on, nights, toggle, setN }) {
  const c = CITIES[cid];
  return (
    <div
      className="rounded-xl p-4 transition-all"
      style={{ background: on ? T.card : T.paper, border: `1.5px solid ${on ? T.ink : T.mist}`, opacity: on ? 1 : 0.6 }}
    >
      <button onClick={toggle} className="w-full text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-bold">{c.name}</span>
            <span style={{ fontFamily: "'Zen Old Mincho', serif", color: T.inkSoft, fontSize: 13 }}>{c.jp}</span>
          </div>
          <div
            className="flex items-center justify-center rounded-full"
            style={{ width: 22, height: 22, background: on ? T.ink : T.paper, border: `1.5px solid ${on ? T.ink : T.mist}`, color: "#fff" }}
          >
            {on && <Check size={13} />}
          </div>
        </div>
        <p className="text-xs mt-1.5 leading-relaxed" style={{ color: T.inkSoft }}>{c.blurb}</p>
      </button>
      {on && (
        <div className="flex items-center gap-2 mt-3 text-xs font-semibold">
          Nights: <NightsStepper n={nights} setN={setN} />
        </div>
      )}
    </div>
  );
}
