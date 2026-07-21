import React, { useState, useMemo } from "react";
import { T } from "../theme.js";
import { X } from "lucide-react";
import { AIRPORTS, airportByIata } from "../lib/airports.js";

/** Airport picker: type an IATA code, airport, or city; pick from matches. */
export function AirportField({ label, value, onPick, allowClear }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const U = s.toUpperCase();
    return AIRPORTS
      .filter((a) => a.iata.startsWith(U) || a.name.toLowerCase().includes(s) || a.city.toLowerCase().includes(s))
      .sort((a, b) => (a.iata === U ? -1 : b.iata === U ? 1 : (b.large ? 1 : 0) - (a.large ? 1 : 0)))
      .slice(0, 6);
  }, [q]);
  const cur = value ? airportByIata.get(value) : null;
  return (
    <div className="relative">
      <label className="text-xs font-bold block mb-1" style={{ color: T.inkSoft }}>{label}</label>
      <div className="flex gap-1 items-center">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={cur ? `${cur.iata} · ${cur.city}` : value ?? "airport or city…"}
          className="w-full px-2.5 py-2 rounded-lg text-sm"
          style={{ border: `1px solid ${T.mist}`, background: T.paper }}
        />
        {allowClear && value && (
          <button
            onClick={() => onPick(null)} aria-label={`clear ${label}`}
            className="px-2 py-2 rounded-lg flex-shrink-0" style={{ border: `1px solid ${T.mist}`, color: T.inkSoft }}
          ><X size={12} /></button>
        )}
      </div>
      {open && matches.length > 0 && (
        <div
          className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden"
          style={{ background: T.card, border: `1px solid ${T.mist}`, zIndex: 30, boxShadow: "0 8px 24px rgba(31,41,51,0.14)" }}
        >
          {matches.map((a) => (
            <button
              key={a.iata}
              onMouseDown={(e) => { e.preventDefault(); onPick(a); setQ(""); setOpen(false); }}
              className="w-full text-left px-2.5 py-1.5 text-xs flex items-center gap-2"
              style={{ borderBottom: `1px solid ${T.mist}` }}
            >
              <b style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{a.iata}</b>
              <span className="truncate">{a.name}</span>
              <span className="flex-shrink-0" style={{ color: T.inkSoft }}>{a.city}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
