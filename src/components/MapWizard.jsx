import React, { useState, useMemo, useRef, useEffect } from "react";
import { ChevronRight, ChevronLeft, Plane, Calendar, X } from "lucide-react";
import { T } from "../theme.js";
import { WORLD, cityById, searchCities, registerCity, makeCustomCity } from "../data/world.js";
import { km } from "../lib/geo.js";
import { reverseGeocode } from "../api/client.js";
import { fmtDay } from "../lib/dates.js";
import { toISO } from "../lib/dates.js";
import { MapStage } from "./MapStage.jsx";
import { CitySearch } from "./CitySearch.jsx";
import { Chip, NightsStepper } from "./ui.jsx";

/**
 * Map-first trip intake. Five phases play out over one continuous map:
 *   start → where do you fly from (+ date), with departure airports
 *   dest  → where do you want to go (primary destination)
 *   stops → build the nights: numbered pins, suggestions on and off the map
 *   end   → where does the trip end (final city → exit airport)
 *   review→ the whole journey drawn on the map
 * Clicking the map drills in: country-level clicks zoom; city-level clicks
 * reverse-geocode and pick the town under the cursor (small towns included).
 */
const PHASES = ["start", "dest", "stops", "end", "review"];

const QUESTION = {
  start: "Where do you want to start?",
  dest: "Where do you want to go?",
  stops: "Build your nights.",
  end: "Where do you want to end?",
  review: "Your journey.",
};

export function MapWizard({
  originId, setOriginId, departDate, setDepartDate,
  destIds, setDestIds, nights, setN,
  endAt, setEndAt, suggestions, route, schedule, onDone,
}) {
  const [phase, setPhase] = useState(destIds.length ? "review" : "start");
  const mapRef = useRef(null);
  const origin = cityById[originId];
  const primary = destIds[0] ? cityById[destIds[0]] : null;

  // Departure airports: distinct IATA codes within reach of the origin.
  const originAirports = useMemo(() => {
    if (!origin) return [];
    const seen = new Set();
    return WORLD
      .filter((c) => c.air && !c.custom && km(origin, c) < 420)
      .sort((a, b) => km(origin, a) - km(origin, b))
      .filter((c) => (seen.has(c.air) ? false : seen.add(c.air)))
      .slice(0, 5);
  }, [originId]);

  // Night numbering in selection order: Tokyo N1–3, Kyoto N4–6 …
  const stops = useMemo(() => {
    let n = 1;
    return destIds.map((cid) => {
      const c = cityById[cid];
      const count = nights[cid] ?? 2;
      const first = n; n += count;
      return { c, cid, count, label: count === 1 ? `N${first}` : `N${first}–${n - 1}` };
    });
  }, [destIds, nights]);
  const totalNights = stops.reduce((s, x) => s + x.count, 0);

  /* ── phase-driven camera ─────────────────────────────────────────── */
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (phase === "start") origin ? m.flyTo(origin.lat, origin.lon, 6) : m.flyTo(28, -40, 1.7);
    if (phase === "dest") primary ? m.flyTo(primary.lat, primary.lon, 4.6) : m.flyTo(25, 10, 1.6);
    if (phase === "stops" && primary) {
      const pts = [primary, ...stops.map((s) => s.c), ...suggestions.map((s) => s.city)];
      m.fitTo(pts);
    }
    if (phase === "end" && stops.length) m.fitTo(stops.map((s) => s.c));
    if (phase === "review") m.fitTo([origin, ...stops.map((s) => s.c)].filter(Boolean), 110);
  }, [phase, originId, destIds.join(), suggestions.length]);

  /* ── click-to-pick: drill in, then resolve the place under the cursor ── */
  const pickCity = (city) => {
    if (phase === "start") setOriginId(city.id);
    else if (phase === "dest") { setDestIds([city.id, ...destIds.slice(1)]); if (!nights[city.id]) setN(city.id, 3); }
    else if (phase === "stops" && !destIds.includes(city.id)) { setDestIds([...destIds, city.id]); if (!nights[city.id]) setN(city.id, city.custom ? 1 : 2); }
  };
  const handleMapClick = async (lngLat, zoom) => {
    if (phase === "review") return;
    if (phase === "end") {
      const near = stops.map((s) => s.c).sort((a, b) => km({ lat: lngLat.lat, lon: lngLat.lng }, a) - km({ lat: lngLat.lat, lon: lngLat.lng }, b))[0];
      if (near && km({ lat: lngLat.lat, lon: lngLat.lng }, near) < 150) setEndAt(near.id);
      return;
    }
    if (zoom < 4.8) { mapRef.current?.flyTo(lngLat.lat, lngLat.lng, zoom + 2.6); return; }
    const place = await reverseGeocode(lngLat.lat, lngLat.lng, zoom >= 6);
    if (!place?.name) return;
    const curated = searchCities(place.name).find((c) => c.country === place.country) ?? searchCities(place.name)[0];
    const city = curated ?? registerCity(makeCustomCity({ name: place.name, country: place.country, latitude: lngLat.lat, longitude: lngLat.lng }));
    pickCity(city);
  };

  /* ── markers per phase ───────────────────────────────────────────── */
  const pin = (c, kind, html, onClick) => ({ id: `${kind}-${c.id}`, lat: c.lat, lon: c.lon, kind, html, onClick });
  const markers = useMemo(() => {
    const out = [];
    if (origin) out.push(pin(origin, "origin", `<div class="pin-dot"></div><div class="pin-name">${origin.name}</div>`));
    if (phase === "start") {
      originAirports.forEach((c) => out.push(pin(c, "airport", `<div class="pin-air">${c.air}</div>`, () => setOriginId(c.id))));
    }
    if (phase !== "start") {
      stops.forEach((s, i) => out.push(pin(s.c, endAt === s.cid && phase !== "dest" ? "end" : "stop",
        `<div class="pin-num">${i + 1}</div><div class="pin-name">${s.c.name}<em>${s.label}</em></div>`,
        phase === "end" ? () => setEndAt(s.cid) : undefined)));
    }
    if (phase === "stops") {
      suggestions.forEach((s) => out.push(pin(s.city, "suggest", `<div class="pin-sug">＋</div><div class="pin-name">${s.city.name}</div>`, () => pickCity(s.city))));
    }
    if (phase === "review" && route) {
      out.push(pin({ ...origin, id: origin.id + "-gw" }, "airport", `<div class="pin-air">${origin.air}</div>`));
    }
    return out;
  }, [phase, originId, stops, suggestions, endAt, originAirports, route]);

  /* ── route lines for review ──────────────────────────────────────── */
  const lines = useMemo(() => {
    if (phase !== "review" || !route || !origin) return [];
    const seq = route.order.map((cid) => cityById[cid]);
    const l = [];
    l.push({ mode: "flight", from: [origin.lat, origin.lon], to: [seq[0].lat, seq[0].lon] });
    route.legs.forEach((leg) => {
      const a = cityById[leg.from], b = cityById[leg.to];
      l.push({ mode: leg.mode === "rail" ? "ground" : "flight", from: [a.lat, a.lon], to: [b.lat, b.lon] });
    });
    l.push({ mode: "flight", from: [seq[seq.length - 1].lat, seq[seq.length - 1].lon], to: [origin.lat, origin.lon] });
    return l;
  }, [phase, route, originId]);

  const idx = PHASES.indexOf(phase);
  const canNext =
    phase === "start" ? !!origin && !!departDate :
    phase === "dest" ? !!primary :
    phase === "stops" ? destIds.length >= 1 :
    phase === "end" ? true : true;

  return (
    <div className="relative" style={{ height: "calc(100vh - 118px)", minHeight: 480 }}>
      <MapStage ref={mapRef} markers={markers} route={lines} onMapClick={handleMapClick} />

      {/* prompt card */}
      <div className="absolute top-4 left-4 z-10 w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl p-5 wizard-card">
        <div className="flex items-center gap-1.5 mb-3">
          {PHASES.map((p, i) => (
            <button key={p} onClick={() => i < idx && setPhase(p)}
              className="rounded-full"
              style={{ width: i === idx ? 22 : 7, height: 7, background: i <= idx ? T.flight : T.mist, transition: "all .3s" }} />
          ))}
        </div>
        <h2 style={{ fontFamily: "'Zen Old Mincho', serif", fontWeight: 900, fontSize: 26, lineHeight: 1.2 }}>
          {QUESTION[phase]}
        </h2>

        {phase === "start" && (
          <div className="mt-3 space-y-3">
            <CitySearch placeholder="Type a city or town — or click the map…" exclude={[]} onPick={(c) => setOriginId(c.id)} autoFocus />
            {origin && (
              <div className="flex items-center gap-2 flex-wrap">
                <Chip tint={T.railTint} color={T.rail}>{origin.name} · {origin.air}</Chip>
                <span className="text-xs" style={{ color: T.inkSoft }}>fly from a pinned airport or keep {origin.air}</span>
              </div>
            )}
            <label className="block">
              <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: T.inkSoft }}><Calendar size={13} /> Departure date</span>
              <input type="date" value={departDate} min={toISO(new Date())}
                onChange={(e) => e.target.value && setDepartDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-xl text-sm font-semibold"
                style={{ border: `1px solid ${T.mist}`, background: T.card, fontFamily: "'IBM Plex Mono', monospace" }} />
            </label>
          </div>
        )}

        {phase === "dest" && (
          <div className="mt-3 space-y-3">
            <CitySearch placeholder="Country, city, or small town — or click the map…" exclude={[originId]} onPick={(c) => pickCity(c)} autoFocus />
            {primary && <Chip tint={T.pineTint} color={T.pine}>{primary.name}, {primary.country}</Chip>}
            <p className="text-xs" style={{ color: T.inkSoft }}>
              Click a country to zoom in, then click the city — or type it. Smaller towns work too.
            </p>
          </div>
        )}

        {phase === "stops" && (
          <div className="mt-3 space-y-3">
            <CitySearch placeholder="Add a stop — any city or town…" exclude={[originId, ...destIds]} onPick={(c) => pickCity(c)} />
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {stops.map((s, i) => (
                <div key={s.cid} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: T.paper, border: `1px solid ${T.mist}` }}>
                  <span className="text-sm font-bold flex items-center gap-2">
                    <span className="pin-num" style={{ position: "static" }}>{i + 1}</span>
                    {s.c.name}
                    <span className="text-xs font-semibold" style={{ color: T.rail, fontFamily: "'IBM Plex Mono', monospace" }}>{s.label}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <NightsStepper n={s.count} setN={(n) => setN(s.cid, n)} />
                    <button onClick={() => { setDestIds(destIds.filter((d) => d !== s.cid)); if (endAt === s.cid) setEndAt(null); }} style={{ color: T.inkSoft }}><X size={14} /></button>
                  </span>
                </div>
              ))}
            </div>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.slice(0, 5).map((s) => (
                  <button key={s.city.id} onClick={() => pickCity(s.city)} className="rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{ background: T.card, border: `1px solid ${T.mist}`, color: T.ink }}>
                    ＋ {s.city.name}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs" style={{ color: T.inkSoft }}>{totalNights} nights · numbers on the map match your nights</p>
          </div>
        )}

        {phase === "end" && (
          <div className="mt-3 space-y-3">
            <p className="text-xs" style={{ color: T.inkSoft }}>
              Pick the city your trip ends in — you'll fly home to {origin?.name} ({origin?.air}) from its gateway.
            </p>
            <div className="space-y-1.5">
              <button onClick={() => setEndAt(null)} className="w-full text-left rounded-xl px-3 py-2 text-sm font-semibold"
                style={{ background: !endAt ? T.pineTint : T.paper, border: `1.5px solid ${!endAt ? T.pine : T.mist}`, color: !endAt ? T.pine : T.ink }}>
                Let the optimizer choose (best open-jaw)
              </button>
              {stops.map((s) => (
                <button key={s.cid} onClick={() => setEndAt(s.cid)} className="w-full text-left rounded-xl px-3 py-2 text-sm font-semibold flex items-center justify-between"
                  style={{ background: endAt === s.cid ? T.railTint : T.paper, border: `1.5px solid ${endAt === s.cid ? T.rail : T.mist}` }}>
                  {s.c.name}
                  <span className="text-xs" style={{ color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{s.c.air}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === "review" && route && (
          <div className="mt-3 space-y-2">
            <p className="text-sm leading-relaxed">
              <b>{origin.name} → {route.order.map((c) => cityById[c].name).join(" → ")} → home</b>
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Chip tint={T.railTint} color={T.rail}>{fmtDay(departDate)}{schedule ? ` – ${fmtDay(schedule.returnDate)}` : ""}</Chip>
              <Chip tint={T.flightTint} color={T.flight}>{route.inGw.gw} in · {route.outGw.gw} out</Chip>
              <Chip tint={T.pineTint} color={T.pine}>{totalNights} nights</Chip>
            </div>
            <p className="text-xs" style={{ color: T.inkSoft }}>
              Solid lines ride the ground, dashed lines fly. Next: pick transport, flights, and how your points pay for it.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mt-4">
          <button onClick={() => idx > 0 && setPhase(PHASES[idx - 1])} disabled={idx === 0}
            className="py-2.5 px-3.5 rounded-xl font-bold text-sm flex items-center gap-1 disabled:opacity-30"
            style={{ border: `1px solid ${T.mist}`, color: T.inkSoft, background: T.card }}>
            <ChevronLeft size={15} /> Back
          </button>
          {phase !== "review" ? (
            <button onClick={() => canNext && setPhase(PHASES[idx + 1])} disabled={!canNext}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 text-white disabled:opacity-40"
              style={{ background: T.ink }}>
              Continue <ChevronRight size={15} />
            </button>
          ) : (
            <button onClick={onDone}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 text-white"
              style={{ background: T.flight }}>
              <Plane size={15} /> Transport, flights & points
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
