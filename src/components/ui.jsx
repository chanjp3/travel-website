import React from "react";
import { T } from "../theme.js";

export const Chip = ({ children, tint, color }) => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: tint, color }}>
    {children}
  </span>
);

export const SectionLabel = ({ children }) => (
  <div className="flex items-center gap-2 mb-3">
    <div style={{ width: 18, height: 3, background: T.rail }} />
    <span className="text-xs font-bold tracking-widest uppercase" style={{ color: T.inkSoft, fontFamily: "'Jost', sans-serif" }}>
      {children}
    </span>
  </div>
);

export function NightsStepper({ n, setN, min = 1, max = 7, label = "" }) {
  return (
    <span className="inline-flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${T.mist}` }}>
      <button onClick={() => setN(Math.max(min, n - 1))} aria-label={`Fewer ${label}`.trim()} className="px-2 py-1 font-bold" style={{ background: T.paper }}>−</button>
      <span className="px-2.5 py-1 font-bold" style={{ background: T.card, fontFamily: "'Jost', sans-serif" }}>{n}</span>
      <button onClick={() => setN(Math.min(max, n + 1))} aria-label={`More ${label}`.trim()} className="px-2 py-1 font-bold" style={{ background: T.paper }}>+</button>
    </span>
  );
}

export function PayToggle({ mode, setMode, disabled }) {
  return (
    <span className="inline-flex rounded-lg overflow-hidden text-xs font-bold" style={{ border: `1px solid ${T.mist}` }}>
      {["points", "cash"].map((m) => (
        <button
          key={m}
          disabled={disabled && m === "points"}
          onClick={(e) => { e.stopPropagation(); setMode(m); }}
          className="px-2 py-1 disabled:opacity-40"
          style={{
            background: mode === m ? (m === "points" ? T.pine : T.ink) : T.paper,
            color: mode === m ? T.paper : T.inkSoft,
          }}
        >
          {m}
        </button>
      ))}
    </span>
  );
}
