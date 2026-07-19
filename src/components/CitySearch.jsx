import React, { useState, useMemo, useEffect } from "react";
import { Search } from "lucide-react";
import { T } from "../theme.js";
import { searchCities, registerCity, makeCustomCity } from "../data/world.js";
import { geoSearch } from "../api/client.js";
import { Chip } from "./ui.jsx";

/** Curated-city search with live town geocoding (any place on Earth). */
export function CitySearch({ placeholder, exclude = [], onPick, towns = true, autoFocus = false }) {
  const [q, setQ] = useState("");
  const [townHits, setTownHits] = useState([]);
  const hits = useMemo(() => searchCities(q).filter((c) => !exclude.includes(c.id)), [q, exclude]);

  useEffect(() => {
    if (!towns || q.trim().length < 3) { setTownHits([]); return; }
    let on = true;
    const t = setTimeout(async () => {
      const res = await geoSearch(q.trim());
      if (!on) return;
      const known = new Set(searchCities(q).map((c) => `${c.name}|${c.country}`.toLowerCase()));
      setTownHits(
        res.filter((g) => g.latitude != null && !known.has(`${g.name}|${g.country}`.toLowerCase())).slice(0, 4)
      );
    }, 350);
    return () => { on = false; clearTimeout(t); };
  }, [q, towns]);

  const pick = (c) => { onPick(c); setQ(""); setTownHits([]); };
  const pickTown = (g) => pick(registerCity(makeCustomCity(g)));

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: T.card, border: `1px solid ${T.mist}` }}>
        <Search size={14} style={{ color: T.inkSoft }} />
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-sm outline-none bg-transparent"
        />
      </div>
      {(hits.length > 0 || townHits.length > 0) && (
        <div className="absolute z-10 mt-1 w-full rounded-xl overflow-hidden shadow-lg" style={{ background: T.card, border: `1px solid ${T.mist}` }}>
          {hits.map((c) => (
            <button
              key={c.id}
              onClick={() => pick(c)}
              className="w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:opacity-70"
              style={{ borderBottom: `1px solid ${T.mist}` }}
            >
              <span><b>{c.name}</b> <span style={{ color: T.inkSoft }}>· {c.country}</span></span>
              <span className="text-xs font-bold" style={{ color: T.rail, fontFamily: "'IBM Plex Mono', monospace" }}>{c.air}</span>
            </button>
          ))}
          {townHits.map((g) => (
            <button
              key={`${g.name}-${g.latitude}-${g.longitude}`}
              onClick={() => pickTown(g)}
              className="w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:opacity-70"
              style={{ borderBottom: `1px solid ${T.mist}` }}
            >
              <span>
                <b>{g.name}</b>{" "}
                <span style={{ color: T.inkSoft }}>· {g.admin1 ? `${g.admin1}, ` : ""}{g.country}</span>
              </span>
              <Chip tint={T.pineTint} color={T.pine}>town</Chip>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
