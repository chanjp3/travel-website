import React, { useState, useMemo, useEffect } from "react";
import {
  Plane, TrainFront, MapPin, Clock, Check, ChevronRight, ChevronLeft,
  Sparkles, Hotel, Wallet, Star, Info, Eye, X, Search, Globe, Calendar,
} from "lucide-react";

import { T } from "./theme.js";
import { WORLD, cityById, searchCities, registerCity, makeCustomCity } from "./data/world.js";
import { SOURCES, BALANCE_SOURCES, DEFAULT_BALANCES } from "./data/transferPartners.js";
import { packFor, packById } from "./data/corridors/index.js";
import { scoreRoutes, permutations } from "./lib/optimizer.js";
import { legOptions } from "./lib/flightsEngine.js";
import { hotelsFor } from "./lib/hotelsEngine.js";
import { hm, usd, cpp, jrPassAnalysis, buildDays, JP_NAMES } from "./lib/trip.js";
import { bestPath, fundingPaths, describePath } from "./lib/funding.js";
import { buildLedger } from "./lib/costs.js";
import { liveMode, geoSearch, liveFlights, liveAwards, liveHotels } from "./api/client.js";
import { suggestCities } from "./lib/suggest.js";
import { HOTEL_GROUPS, brandGroupOf } from "./lib/hotelBrands.js";
import { useLiveLeg, useLiveAwards, useLiveHotelsMap } from "./api/useLive.js";
import { mergeLiveLeg, mergeLiveAwards, mergeLiveHotels } from "./lib/liveMerge.js";
import { defaultDepart, buildSchedule, toISO, addDays, fmtDay, fmtShort, dateForDay } from "./lib/dates.js";
import { Chip, SectionLabel, NightsStepper, PayToggle } from "./components/ui.jsx";
import { RouteSpine } from "./components/RouteSpine.jsx";
import { JourneyMap } from "./components/JourneyMap.jsx";
import { MeridianIntake } from "./components/MeridianIntake.jsx";

const Mark = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="12" fill={T.ink} />
    <path transform="translate(4.8,4.8) scale(0.6)" fill={T.paper}
      d="M21.5 15.5l-8-4.7V4.2c0-.9-.7-1.7-1.5-1.7s-1.5.8-1.5 1.7v6.6l-8 4.7v2l8-2.5v5.4l-2 1.6v1.5l3.5-1 3.5 1V22l-2-1.6V15l8 2.5v-2z" />
  </svg>
);

const SUGGEST_META = {
  hakone: { why: "On the Tokaido corridor between Tokyo and Kyoto — an onsen night costs almost no detour.", add: "+1h 10m · ≈$46 rail" },
  nara: { why: "45 min from Kyoto or Osaka — Todai-ji and the bowing deer.", add: "+1h 35m · ≈$10 rail" },
  kanazawa: { why: "The quieter Hokuriku arc: Kenroku-en garden, geisha district.", add: "+2h 20m · ≈$95 rail" },
  hiroshima: { why: "Peace Memorial + Miyajima, 1h 25m past Osaka.", add: "+2h 50m · ≈$142 rail" },
};

export default function App() {
  const [step, setStep] = useState(0);
  const [originId, setOriginId] = useState("tampa");
  const [departDate, setDepartDate] = useState(defaultDepart());
  const [destIds, setDestIds] = useState([]);
  const [nights, setNights] = useState({});
  const [wCost, setWCost] = useState(0.5);
  const [cabinPref, setCabinPref] = useState("Business");
  const [pointsOnly, setPointsOnly] = useState(true);
  const [balances, setBalances] = useState({ ...DEFAULT_BALANCES });
  const [routeIdx, setRouteIdx] = useState(0);
  const [flightSel, setFlightSel] = useState({});   // { out: optId, back: optId }
  const [flightPay, setFlightPay] = useState({ out: "points", back: "points" });
  const [hotelPicks, setHotelPicks] = useState({});
  const [hotelPay, setHotelPay] = useState({});
  const [endAt, setEndAt] = useState(null);       // "where do you want to end?" pin
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [originAir, setOriginAir] = useState(null);  // departure airport from the intake
  const [homeAir, setHomeAir] = useState(null);      // fly-home airport from the intake
  const [startAt, setStartAt] = useState(null);      // landing city — the trip starts here
  const [inGw, setInGw] = useState(null);   // chosen arrival airport {iata, lat, lon}
  const [outGw, setOutGw] = useState(null);  // chosen return-departure airport

  const origin = cityById[originId];
  const depAir = originAir ?? origin.air;
  const retAir = homeAir ?? origin.air;
  const results = useMemo(
    () => (destIds.length >= 1 ? scoreRoutes(destIds, wCost, originId, { endAt, startAt, inGw, outGw }) : null),
    [destIds, wCost, originId, endAt, startAt, inGw, outGw]
  );
  const route = results?.top[Math.min(routeIdx, (results?.top.length ?? 1) - 1)];

  // Long-haul options for the chosen route: estimate set first, live merge on top
  const outLegEst = useMemo(() => (route ? legOptions(originId, route.order[0]) : null), [route, originId]);
  const backLegEst = useMemo(
    () => (route ? legOptions(route.order[route.order.length - 1], originId) : null),
    [route, originId]
  );

  const schedule = useMemo(
    () => buildSchedule(route, nights, departDate, outLegEst?.routing.min),
    [route, nights, departDate, outLegEst]
  );

  const liveOut = useLiveLeg(depAir, route?.inGw.gw, departDate, cabinPref);
  const liveBack = useLiveLeg(route?.outGw.gw, retAir, schedule?.returnDate, cabinPref);
  const awardsOut = useLiveAwards(depAir, route?.inGw.gw, departDate);
  const awardsBack = useLiveAwards(route?.outGw.gw, retAir, schedule?.returnDate);
  const outLeg = useMemo(
    () => mergeLiveAwards(mergeLiveLeg(outLegEst, liveOut.offers, cabinPref), awardsOut.rows),
    [outLegEst, liveOut.offers, cabinPref, awardsOut.rows]
  );
  const backLeg = useMemo(
    () => mergeLiveAwards(mergeLiveLeg(backLegEst, liveBack.offers, cabinPref), awardsBack.rows),
    [backLegEst, liveBack.offers, cabinPref, awardsBack.rows]
  );
  const liveHotelsMap = useLiveHotelsMap(schedule);

  const pickDefault = (leg) => {
    if (!leg) return null;
    const pool = leg.options.filter((f) => f.cabin === cabinPref);
    if (pointsOnly) {
      // Prefer awards with confirmed (or unchecked) space over known-empty dates.
      const fundable =
        pool.find((f) => f.points && !f.noSpace && bestPath(f.programId, f.points, balances)) ??
        pool.find((f) => f.points && bestPath(f.programId, f.points, balances));
      if (fundable) return fundable.id;
      const anyAward = pool.find((f) => f.points);
      if (anyAward) return anyAward.id;
    }
    return pool[0]?.id ?? leg.options[0]?.id ?? null;
  };
  // Hotel preferences: minimum stars, minimum quality rating, nightly budget.
  const [hotelPrefs, setHotelPrefs] = useState({ stars: 0, rating: 0, budget: 0, group: "" });
  const starsOf = (h) => h.stars ?? (h.quality >= 9 ? 5 : h.quality >= 8.3 ? 4 : h.quality != null ? 3 : null);
  const hotelPasses = (h) => {
    if (hotelPrefs.stars && (starsOf(h) ?? 0) < hotelPrefs.stars) return false;
    if (hotelPrefs.rating && h.quality != null && h.quality < hotelPrefs.rating) return false;
    if (hotelPrefs.budget && h.cash > hotelPrefs.budget) return false;
    if (hotelPrefs.group && (brandGroupOf(h.name) ?? "other") !== hotelPrefs.group) return false;
    return true;
  };

  // Live mode shows ACTUALS ONLY: live-priced itineraries and verified award
  // space. Estimate rows stay hidden unless explicitly requested per leg.
  const [showEst, setShowEst] = useState({});
  const displayLeg = (leg, key) => {
    if (!leg || !liveMode() || showEst[key]) return leg;
    return { ...leg, options: leg.options.filter((f) => f.live || f.awardLive) };
  };
  const outLegD = displayLeg(outLeg, "out");
  const backLegD = displayLeg(backLeg, "back");

  const outId = flightSel.out ?? pickDefault(outLegD);
  const backId = flightSel.back ?? pickDefault(backLegD);
  const fOut = outLegD?.options.find((f) => f.id === outId);
  const fBack = backLegD?.options.find((f) => f.id === backId);
  const pathOut = fOut?.points ? bestPath(fOut.programId, fOut.points, balances) : null;
  const pathBack = fBack?.points ? bestPath(fBack.programId, fBack.points, balances) : null;

  const jr = useMemo(() => jrPassAnalysis(route), [route]);
  const days = useMemo(() => (route ? buildDays(route, nights, originId) : []), [route, nights, originId]);

  const hotelChoices = useMemo(() => {
    if (!route) return [];
    return route.order.map((cid) => {
      const { hotels, sample } = mergeLiveHotels(hotelsFor(cid), liveHotelsMap[cid], nights[cid] ?? 2);
      const pool = hotels.filter(hotelPasses);
      const list = pool.length ? pool : hotels;
      const hotel = hotels.find((h) => h.name === hotelPicks[cid]) ?? list[0];
      const n = nights[cid] ?? 2;
      const path = hotel.pts ? bestPath(hotel.pid, hotel.pts * n, balances) : null;
      const requested = hotelPay[cid] ?? (pointsOnly && path ? "points" : path ? "points" : "cash");
      return { city: cid, hotel, nights: n, sample, path, mode: requested === "points" && path ? "points" : "cash" };
    });
  }, [route, hotelPicks, hotelPay, nights, balances, pointsOnly, liveHotelsMap, hotelPrefs]);

  const ledger = useMemo(() => {
    if (!route || !fOut || !fBack) return null;
    return buildLedger({
      flights: [
        { label: `${depAir} → ${route.inGw.gw}`, f: fOut, mode: pointsOnly || flightPay.out === "points" ? "points" : "cash", path: pathOut },
        { label: `${route.outGw.gw} → ${retAir}`, f: fBack, mode: pointsOnly || flightPay.back === "points" ? "points" : "cash", path: pathBack },
      ],
      hotels: hotelChoices, route, jr,
    });
  }, [route, fOut, fBack, flightPay, pathOut, pathBack, hotelChoices, jr, pointsOnly, origin]);

  const totalNights = destIds.reduce((s, c) => s + (nights[c] ?? 2), 0);
  const japanSuggestions = useMemo(() => {
    const jp = packById("japan");
    if (!destIds.some((d) => cityById[d].pack === "japan")) return [];
    return jp.suggestions.filter((s) => !destIds.includes(s));
  }, [destIds]);

  // Builder suggestions: curated pack picks first (Japan rail arc), then
  // major cities in / around the primary destination's country.
  const suggestions = useMemo(() => {
    if (!destIds.length) return [];
    const jp = japanSuggestions.map((cid) => ({
      city: cityById[cid],
      why: SUGGEST_META[cid]?.why,
      add: SUGGEST_META[cid]?.add,
    }));
    const seen = new Set(jp.map((s) => s.city.id));
    const geo = suggestCities(destIds, originId, 6).filter((s) => !seen.has(s.city.id));
    return [...jp, ...geo].slice(0, 6);
  }, [destIds, originId, japanSuggestions]);

  const steps = ["The map", "Route & flights", "Itinerary & cost"];
  const setN = (cid, n) => setNights({ ...nights, [cid]: n });

  // One-tap proof that the live APIs answer, run from the user's browser
  // against the configured worker (TPA→LHR, ~1 month out).
  const [diag, setDiag] = useState(null);
  const runDiag = async () => {
    setDiag({ running: true });
    const date = addDays(toISO(new Date()), 30);
    const [fl, aw, ho] = await Promise.all([
      liveFlights("TPA", "LHR", date, "Economy"),
      liveAwards("TPA", "LHR", date),
      liveHotels({ name: "London", cc: "LON", air: "LHR", lat: 51.5, lon: -0.12 }, date, addDays(date, 2)),
    ]);
    const verdict = (r) =>
      r == null ? { ok: false, note: "no response (worker unreachable or key rejected)" }
      : Array.isArray(r) && r.length === 0 ? { ok: true, note: "reachable — empty result for the test route" }
      : Array.isArray(r) ? { ok: true, note: `OK — ${r.length} result${r.length !== 1 ? "s" : ""}` }
      : { ok: false, note: "unexpected response" };
    setDiag({ flights: verdict(fl), awards: verdict(aw), hotels: verdict(ho), date });
  };

  // The Meridian intake hands us a plotted trip; register its places (any
  // town on Earth) and let the engines take over.
  const cityFromPlace = (rawName, countryName, lat, lon, iata) => {
    const name = rawName.replace(/\s*\(.+\)$/, ""); // "Tokyo (13)" → "Tokyo" (atlas region suffix)
    const cur = searchCities(name).find((c) => Math.abs(c.lat - lat) < 1.4 && Math.abs(c.lon - lon) < 1.4);
    const city = cur ?? registerCity(makeCustomCity({ name, country: countryName, latitude: lat, longitude: lon }));
    if (iata && city.custom) city.air = iata; // real airport beats nearest-curated guess
    return city;
  };
  const handlePlottedTrip = (t) => {
    const o = cityFromPlace(t.originCity.name, t.originCountry, t.originCity.lat, t.originCity.lon, t.originAirport.iata);
    setOriginId(o.id);
    setOriginAir(t.originAirport.iata);
    setHomeAir(t.homeAirport.iata);
    if (t.date) setDepartDate(t.date);
    const ids = [];
    const nn = {};
    t.stops.forEach((st) => {
      const c = cityFromPlace(st.name, t.destCountry, st.lat, st.lon, st.iata);
      ids.push(c.id);
      nn[c.id] = st.nights;
    });
    setDestIds(ids);
    setNights((old) => ({ ...old, ...nn }));
    const endIdx = t.stops.findIndex((st) => st.name === t.endCity);
    setEndAt(ids[endIdx >= 0 ? endIdx : ids.length - 1] ?? null);
    // Pin the two long-haul flights exactly as chosen on the map:
    // land at the arrival airport (trip starts in that city), depart home
    // from the end city's chosen airport.
    const startIdx = t.stops.findIndex((st) => st.name === t.arrivalCity?.name);
    setStartAt(startIdx >= 0 ? ids[startIdx] : null);
    setInGw(t.arrivalAirport ? { iata: t.arrivalAirport.iata, lat: t.arrivalAirport.lat, lon: t.arrivalAirport.lon } : null);
    setOutGw(t.endAirport ? { iata: t.endAirport.iata, lat: t.endAirport.lat, lon: t.endAirport.lon } : null);
    if (t.hotelPrefs) setHotelPrefs((p) => ({ ...p, ...t.hotelPrefs }));
    const hp = {};
    Object.entries(t.hotelPicks ?? {}).forEach(([cityName, hotelName]) => {
      const idx = t.stops.findIndex((st) => st.name === cityName);
      if (idx >= 0 && ids[idx]) hp[ids[idx]] = hotelName;
    });
    setRouteIdx(0); setFlightSel({}); setHotelPicks(hp); setHotelPay({});
    setStep(1);
  };

  return (
    <div className="min-h-screen" style={{ background: T.paper, color: T.ink, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <header
        className="border-b sticky top-0 z-40"
        style={{ borderColor: T.mist, background: "rgba(253,251,245,0.88)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Mark />
            <div>
              <h1 style={{ fontFamily: "'Jost', 'Century Gothic', sans-serif", fontWeight: 700, fontSize: 19, letterSpacing: "0.28em", textTransform: "uppercase" }}>Meridian</h1>
              <p className="text-xs" style={{ color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>Points-first route planning</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPrefsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ border: `1px solid ${T.mist}`, color: T.ink, background: T.card }}
            >
              <Wallet size={13} style={{ color: T.rail }} /> Points & preferences
            </button>
            <Chip tint={liveMode() ? T.pineTint : T.flightTint} color={liveMode() ? T.pine : T.flight}>
              {liveMode() ? "LIVE FARES CONNECTED" : "ESTIMATE MODE"}
            </Chip>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-3 flex gap-1 overflow-x-auto">
          {steps.map((s, i) => (
            <button
              key={s} onClick={() => setStep(i)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
              style={{
                background: i === step ? T.ink : "transparent",
                color: i === step ? "#fff" : i < step ? T.rail : T.inkSoft,
                border: `1px solid ${i === step ? T.ink : T.mist}`,
              }}
            >
              <span className="flex items-center justify-center rounded-full" style={{
                width: 16, height: 16, fontSize: 10,
                background: i < step ? T.rail : i === step ? "#fff" : T.mist,
                color: i < step ? "#fff" : i === step ? T.ink : T.inkSoft,
              }}>{i < step ? <Check size={10} /> : i + 1}</span>
              {s}
            </button>
          ))}
        </div>
      </header>

      <MeridianIntake hidden={step !== 0} initialDate={departDate} onComplete={handlePlottedTrip} />
      {step > 0 && (
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div key={step} className="step-in">
        {/* ── steps 2/3 need a destination ── */}
        {(step === 1 || step === 2) && !route && (
          <div className="rounded-xl p-8 text-center" style={{ background: T.card, border: `1px solid ${T.mist}` }}>
            <p className="text-sm font-bold">No destinations yet</p>
            <p className="text-xs mt-1" style={{ color: T.inkSoft }}>Pick a primary destination on the brief step and the builder takes it from there.</p>
            <button onClick={() => setStep(0)} className="mt-4 py-2.5 px-5 rounded-xl font-bold text-sm text-white" style={{ background: T.ink }}>
              Back to the brief
            </button>
          </div>
        )}

        {/* ── STEP 2 · ROUTE & FLIGHTS ── */}
        {step === 1 && results && route && (
          <div className="space-y-7">
            <div>
              <SectionLabel>
                Optimized routes — top {results.top.length} of {permutations(destIds).length.toLocaleString()} scored
              </SectionLabel>
              <div className="space-y-3">
                {results.top.map((r, i) => {
                  const savedMin = results.naive.totalMin - r.totalMin;
                  return (
                    <button
                      key={i} onClick={() => { setRouteIdx(i); setFlightSel({}); }}
                      className="w-full text-left rounded-xl p-4"
                      style={{ background: routeIdx === i ? T.card : T.paper, border: `2px solid ${routeIdx === i ? T.ink : T.mist}` }}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center rounded-full text-white text-xs font-bold" style={{ width: 22, height: 22, background: i === 0 ? T.rail : T.inkSoft }}>{i + 1}</span>
                          <span className="font-bold text-sm">
                            {i === 0 ? "Recommended" : `Alternative ${i}`} · {r.inGw.gw} in / {r.outGw.gw} out{" "}
                            {r.inGw.gw !== r.outGw.gw && <Chip tint={T.pineTint} color={T.pine}>open jaw</Chip>}
                          </span>
                        </div>
                        <div className="flex gap-2 text-xs font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                          <Chip tint={T.railTint} color={T.rail}><Clock size={11} />{hm(r.totalMin)} ground</Chip>
                          <Chip tint={T.pineTint} color={T.pine}>{usd(r.totalUsd)} ground</Chip>
                        </div>
                      </div>
                      <RouteSpine route={r} originId={originId} compact />
                      {i === 0 && savedMin > 20 && (
                        <p className="text-xs mt-2" style={{ color: T.pine }}>
                          <b>Why this wins:</b> vs. your listed order as a round trip, this saves {hm(Math.max(savedMin, 0))} of
                          ground travel{results.naive.totalUsd - r.totalUsd > 25 && <> and {usd(results.naive.totalUsd - r.totalUsd)}</>} —
                          sequencing and gateway choice, not luck.
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Long-haul flights with funding paths */}
            <div className="grid md:grid-cols-2 gap-5">
              {[
                { key: "out", dir: `Outbound · ${depAir} → ${route.inGw.gw} · ${fmtDay(departDate)}`, leg: outLegD, sel: outId, loading: liveOut.loading || awardsOut.loading },
                { key: "back", dir: `Return · ${route.outGw.gw} → ${retAir}${schedule ? ` · ${fmtDay(schedule.returnDate)}` : ""}`, leg: backLegD, sel: backId, loading: liveBack.loading || awardsBack.loading },
              ].map(({ key, dir, leg, sel, loading }) => {
                const visible = leg.options.filter((f) => {
                  if (f.cabin !== cabinPref && !f.cashOnly) return false;
                  if (pointsOnly) return f.points && bestPath(f.programId, f.points, balances);
                  return true;
                });
                const shown = visible.length ? visible : leg.options.filter((f) => f.cabin === cabinPref);
                const actualsOnly = liveMode() && !showEst[key];
                return (
                  <div key={key}>
                    <SectionLabel>{dir}</SectionLabel>
                    {loading && actualsOnly && shown.length === 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs mb-1 pulse-dot" style={{ color: T.flight }}>Searching live fares & award space for this date…</p>
                        {[0, 1, 2].map((i) => <div key={i} className="rounded-xl skel" style={{ height: 74 }} />)}
                      </div>
                    ) : actualsOnly && shown.length === 0 ? (
                      <div className="rounded-xl p-5 text-center" style={{ background: T.card, border: `1px dashed ${T.mist}` }}>
                        <p className="text-sm font-bold">No live results for this route & date yet</p>
                        <p className="text-xs mt-1" style={{ color: T.inkSoft }}>
                          Nothing came back from the fare cache or award search. Try another date — or view the published-chart estimates.
                        </p>
                        <button
                          onClick={() => setShowEst({ ...showEst, [key]: true })}
                          className="mt-3 py-2 px-4 rounded-xl font-bold text-xs"
                          style={{ border: `1.5px solid ${T.mist}`, color: T.inkSoft, background: T.paper }}
                        >
                          Show estimates instead
                        </button>
                      </div>
                    ) : null}
                    {loading && shown.length > 0 && (
                      <p className="text-xs mb-2 pulse-dot" style={{ color: T.flight }}>Still searching — more live results may land…</p>
                    )}
                    {leg.live && (
                      <p className="text-xs mb-2" style={{ color: T.pine }}>
                        <b>Live fares loaded</b> — real itineraries and prices for this date; ¢/pt values use them.
                        {leg.awardsLive && <> <b>Award space verified via Seats.aero</b> — LIVE AWARD rows are bookable today.</>}
                      </p>
                    )}
                    {leg.routing.stops > 0 && !leg.live && (
                      <p className="text-xs mb-2" style={{ color: T.inkSoft }}>
                        No practical nonstop — routing connects <b>via {leg.routing.via.air} ({leg.routing.via.name})</b>.
                      </p>
                    )}
                    <div className="space-y-2">
                      {shown.map((f) => {
                        const chosen = sel === f.id;
                        const path = f.points ? bestPath(f.programId, f.points, balances) : null;
                        return (
                          <button
                            key={f.id}
                            onClick={() => setFlightSel({ ...flightSel, [key]: f.id })}
                            className="w-full text-left rounded-xl p-3"
                            style={{ background: chosen ? T.card : T.paper, border: `1.5px solid ${chosen ? T.flight : T.mist}` }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Plane size={14} style={{ color: T.flight }} />
                                <span className="font-bold text-sm">{f.airline} · {f.cabin}</span>
                                {f.awardLive ? (
                                  <>
                                    <Chip tint={T.pineTint} color={T.pine}>LIVE AWARD</Chip>
                                    {f.seats != null && f.seats > 0 && (
                                      <Chip tint={T.goldTint ?? T.mist} color={T.gold}>{f.seats} seat{f.seats !== 1 && "s"}</Chip>
                                    )}
                                  </>
                                ) : f.live ? (
                                  <Chip tint={T.pineTint} color={T.pine}>LIVE</Chip>
                                ) : f.noSpace ? (
                                  <Chip tint={T.flightTint} color={T.flight}>no space this date</Chip>
                                ) : (
                                  f.est && <Chip tint={T.flightTint} color={T.flight}>est.</Chip>
                                )}
                              </div>
                              <span className="text-xs" style={{ color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                                {f.dep ? `${f.dep}${f.arr ? `–${f.arr}` : ""} · ` : ""}{f.via}{f.dur ? ` · ${f.dur}` : ""}
                              </span>
                            </div>
                            {f.flightNos && (
                              <p className="text-xs mt-1" style={{ color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{f.flightNos}</p>
                            )}
                            <div className="flex items-center justify-between mt-2 flex-wrap gap-1">
                              {f.points ? (
                                <div className="text-sm font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                                  {(f.points / 1000).toFixed(0)}K{" "}
                                  <span className="text-xs font-normal" style={{ color: T.inkSoft }}>{SOURCES[f.programId].short} + {usd(f.fees)}</span>
                                </div>
                              ) : (
                                <div className="text-sm font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{usd(f.cash)}</div>
                              )}
                              <div className="flex gap-1.5">
                                {f.points && <Chip tint={T.pineTint} color={T.pine}>{cpp(f)}¢/pt{f.liveCash ? " · live" : ""}</Chip>}
                                {f.points && <Chip tint={T.mist} color={T.inkSoft}>cash {usd(f.cash)}{f.liveCash ? " live" : ""}</Chip>}
                              </div>
                            </div>
                            {f.points && (
                              <p className="text-xs mt-1" style={{ color: path ? T.inkSoft : T.flight }}>
                                {describePath(path, f.programId)}
                              </p>
                            )}
                            {!pointsOnly && chosen && f.points && (
                              <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                <PayToggle mode={flightPay[key]} setMode={(m) => setFlightPay({ ...flightPay, [key]: m })} disabled={!path} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {jr && (
              <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: jr.worthIt ? T.pineTint : T.card, border: `1px solid ${jr.worthIt ? T.pine : T.mist}` }}>
                <TrainFront size={17} style={{ color: jr.worthIt ? T.pine : T.inkSoft, marginTop: 2, flexShrink: 0 }} />
                <div className="text-sm">
                  <b>JR Pass check:</b> JR-covered fares ≈ ¥{jr.jrYen.toLocaleString()} vs. {jr.pass.name} at ¥{jr.pass.cost.toLocaleString()} —{" "}
                  {jr.worthIt
                    ? <b style={{ color: T.pine }}>buy the pass (saves ≈ ¥{(jr.jrYen - jr.pass.cost).toLocaleString()}; Nozomi needs a supplement).</b>
                    : <b>point-to-point tickets win by ≈ ¥{(jr.pass.cost - jr.jrYen).toLocaleString()}. Skip it.</b>}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(0)} className="py-3 px-4 rounded-xl font-bold text-sm flex items-center gap-1" style={{ border: `1px solid ${T.mist}`, color: T.inkSoft }}>
                <ChevronLeft size={16} /> Back to the map
              </button>
              <button onClick={() => setStep(2)} className="py-3 px-5 rounded-xl font-bold text-sm flex items-center gap-2 text-white" style={{ background: T.ink }}>
                Itinerary & cost <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 · ITINERARY & COST ── */}
        {step === 2 && route && fOut && fBack && ledger && (
          <div className="space-y-8">
            <div className="rounded-2xl p-5 text-white" style={{ background: T.ink }}>
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <h2 style={{ fontFamily: "'Jost', 'Century Gothic', sans-serif", fontWeight: 700, fontSize: 22 }}>
                  {days.length} days · {origin.name} → {route.order.map((c) => cityById[c].name).join(" → ")}
                </h2>
                <span className="text-xs opacity-70" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                  {fmtShort(departDate)} – {schedule ? fmtShort(schedule.returnDate) : ""} · {route.inGw.gw} IN · {route.outGw.gw} OUT{route.inGw.gw !== route.outGw.gw && " · OPEN JAW"}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {[
                  ["Cash out of pocket", usd(ledger.cash)],
                  ["Full retail value", usd(ledger.retail)],
                  ["You save", usd(Math.max(0, ledger.retail - ledger.cash))],
                  ["Points deployed", `${(Object.values(ledger.usage).reduce((a, b) => a + b, 0) / 1000).toFixed(0)}K total`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="text-xs opacity-60">{k}</div>
                    <div className="font-bold text-sm mt-0.5" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>The journey</SectionLabel>
              <div className="rounded-xl p-4 mb-4" style={{ background: T.card, border: `1px solid ${T.mist}` }}>
                <RouteSpine route={route} originId={originId} />
              </div>
              <JourneyMap route={route} originId={originId} />
            </div>

            {/* Hotels */}
            <div>
              <SectionLabel>Hotels — points program or cash</SectionLabel>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3 rounded-xl px-4 py-3" style={{ background: T.card, border: `1px solid ${T.mist}` }}>
                {[
                  ["stars", "Stars", [[0, "Any"], [3, "3★+"], [4, "4★+"], [5, "5★"]]],
                  ["rating", "Rating", [[0, "Any"], [8, "8+"], [9, "9+"]]],
                  ["budget", "Nightly budget", [[0, "Any"], [150, "≤$150"], [250, "≤$250"], [400, "≤$400"]]],
                  ["group", "Group", [["", "Any"], ...HOTEL_GROUPS.map((g) => [g.id, g.label]), ["other", "Indep."]]],
                ].map(([k, label, opts]) => (
                  <div key={k} className="flex items-center gap-1.5">
                    <span className="text-xs font-bold" style={{ color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
                    {opts.map(([v, l]) => (
                      <button
                        key={l}
                        onClick={() => setHotelPrefs({ ...hotelPrefs, [k]: v })}
                        className="px-2 py-1 rounded-full text-xs font-semibold"
                        style={{
                          background: hotelPrefs[k] === v ? T.ink : T.paper,
                          color: hotelPrefs[k] === v ? "#fff" : T.inkSoft,
                          border: `1px solid ${hotelPrefs[k] === v ? T.ink : T.mist}`,
                        }}
                      >{l}</button>
                    ))}
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                {route.order.map((cid) => {
                  const merged = mergeLiveHotels(hotelsFor(cid), liveHotelsMap[cid], nights[cid] ?? 2);
                  const { sample, live } = merged;
                  const pool = merged.hotels.filter(hotelPasses);
                  const filteredOut = merged.hotels.length - pool.length;
                  const hotels = pool.length ? pool : merged.hotels;
                  const chosenName = hotelPicks[cid] ?? hotels[0].name;
                  const stay = schedule?.byCity[cid];
                  return (
                    <div key={cid}>
                      <div className="flex items-baseline gap-2 mb-2 flex-wrap">
                        <span className="font-bold text-sm">{cityById[cid].name}</span>
                        <span className="text-xs" style={{ color: T.inkSoft }}>{nights[cid] ?? 2} night{(nights[cid] ?? 2) !== 1 && "s"}</span>
                        {stay && (
                          <span className="text-xs" style={{ color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                            {fmtShort(stay.checkIn)} → {fmtShort(stay.checkOut)}
                          </span>
                        )}
                        {live
                          ? <Chip tint={T.pineTint} color={T.pine}>live rates</Chip>
                          : sample && <Chip tint={T.flightTint} color={T.flight}>sample listings</Chip>}
                        {pool.length > 0 && filteredOut > 0 && (
                          <Chip tint={T.mist} color={T.inkSoft}>{filteredOut} hidden by filters</Chip>
                        )}
                        {pool.length === 0 && (
                          <Chip tint={T.flightTint} color={T.flight}>no matches — showing all</Chip>
                        )}
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {hotels.map((h) => {
                          const chosen = chosenName === h.name;
                          const n = nights[cid] ?? 2;
                          const path = h.pts ? bestPath(h.pid, h.pts * n, balances) : null;
                          return (
                            <button
                              key={h.name}
                              onClick={() => setHotelPicks({ ...hotelPicks, [cid]: h.name })}
                              className="text-left rounded-xl p-3"
                              style={{ background: chosen ? T.card : T.paper, border: `1.5px solid ${chosen ? T.gold : T.mist}` }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-sm">{h.name}</span>
                                {chosen && <Check size={14} style={{ color: T.gold }} />}
                              </div>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                {starsOf(h) != null && <Chip tint={T.mist} color={T.gold}>{"★".repeat(starsOf(h))}</Chip>}
                                {h.view != null && <Chip tint={T.railTint} color={T.rail}><Eye size={11} /> view {h.view}</Chip>}
                                {h.quality != null && <Chip tint={T.mist} color={T.inkSoft}><Star size={11} /> {h.quality}</Chip>}
                                {(h.live || h.liveCash) && <Chip tint={T.pineTint} color={T.pine}>LIVE</Chip>}
                                {h.pts
                                  ? <Chip tint={T.pineTint} color={T.pine}>{(h.pts / 1000).toFixed(0)}K {h.program}/nt</Chip>
                                  : <Chip tint={T.mist} color={T.inkSoft}>cash only</Chip>}
                                <span className="text-xs font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.inkSoft }}>{usd(h.cash)}/nt</span>
                              </div>
                              {h.pts && chosen && (
                                <p className="text-xs mt-1.5" style={{ color: path ? T.inkSoft : T.flight }}>
                                  {describePath(path, h.pid)}
                                </p>
                              )}
                              {chosen && (
                                <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                  <PayToggle
                                    mode={hotelChoices.find((x) => x.city === cid)?.mode}
                                    setMode={(m) => setHotelPay({ ...hotelPay, [cid]: m })}
                                    disabled={!path}
                                  />
                                </div>
                              )}
                              <p className="text-xs mt-1.5" style={{ color: T.inkSoft }}>{h.note}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cost rundown */}
            <div>
              <SectionLabel>Cost rundown</SectionLabel>
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.mist}` }}>
                {["Flights", "Hotels", "Ground"].map((g) => (
                  <React.Fragment key={g}>
                    {ledger.lines.filter((l) => l.group === g).map((l, i) => (
                      <div key={g + i} className="flex items-start justify-between gap-3 px-4 py-2.5" style={{ background: T.card, borderBottom: `1px solid ${T.mist}` }}>
                        <div>
                          <div className="text-sm font-semibold">{l.label} {l.est && <span className="text-xs font-normal" style={{ color: T.flight }}>est.</span>}</div>
                          {l.sub && <div className="text-xs" style={{ color: T.inkSoft }}>{l.sub}</div>}
                        </div>
                        <div className="text-sm font-bold whitespace-nowrap" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{l.value}</div>
                      </div>
                    ))}
                  </React.Fragment>
                ))}
                <div className="px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 items-center" style={{ background: T.paper }}>
                  <span className="text-sm font-bold">Cash total: <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{usd(ledger.cash)}</span></span>
                  <span className="text-sm" style={{ color: T.inkSoft }}>Retail value: {usd(ledger.retail)}</span>
                  <span className="text-sm font-bold" style={{ color: T.pine }}>Points save you {usd(Math.max(0, ledger.retail - ledger.cash))}</span>
                </div>
              </div>

              {/* Points usage vs balances */}
              <div className="grid sm:grid-cols-2 gap-2 mt-3">
                {Object.entries(ledger.usage).map(([src, pts]) => {
                  const bal = balances[src] ?? 0;
                  const over = pts > bal;
                  return (
                    <div key={src} className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: over ? T.flightTint : T.pineTint, border: `1px solid ${over ? T.flight : T.pine}33` }}>
                      <span className="text-sm font-bold">{SOURCES[src].short}</span>
                      <span className="text-sm font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: over ? T.flight : T.pine }}>
                        {(pts / 1000).toFixed(0)}K / {(bal / 1000).toFixed(0)}K {over && "· over budget"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Day by day */}
            <div>
              <SectionLabel>Day by day</SectionLabel>
              <div className="space-y-3">
                {days.map((d) => (
                  <div key={d.day} className="rounded-xl p-4 flex gap-4" style={{ background: T.card, border: `1px solid ${T.mist}` }}>
                    <div className="flex flex-col items-center" style={{ minWidth: 52 }}>
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>Day</span>
                      <span style={{ fontFamily: "'Jost', 'Century Gothic', sans-serif", fontWeight: 900, fontSize: 26, lineHeight: 1 }}>{d.day}</span>
                      {schedule && (
                        <span className="text-xs mt-1 whitespace-nowrap" style={{ color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                          {fmtShort(dateForDay(schedule, d.day))}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm mb-2" style={{ fontFamily: "'Jost', 'Century Gothic', sans-serif", fontSize: 15 }}>{d.title}</div>
                      <div className="space-y-1.5">
                        {d.items.map((it, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <span style={{ color: it.icon === "flight" ? T.flight : it.icon === "train" ? T.rail : it.icon === "hotel" ? T.gold : T.inkSoft, marginTop: 2, flexShrink: 0 }}>
                              {it.icon === "flight" ? <Plane size={13} /> : it.icon === "train" ? <TrainFront size={13} /> : it.icon === "hotel" ? <Hotel size={13} /> : <MapPin size={13} />}
                            </span>
                            <span className="text-xs font-bold whitespace-nowrap" style={{ minWidth: 68, color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{it.t}</span>
                            <span className="text-sm">{it.n}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pb-8">
              <button onClick={() => setStep(1)} className="py-3 px-4 rounded-xl font-bold text-sm flex items-center gap-1" style={{ border: `1px solid ${T.mist}`, color: T.inkSoft }}>
                <ChevronLeft size={16} /> Route & flights
              </button>
              <p className="text-xs text-right" style={{ color: T.inkSoft }}>
                {liveMode()
                  ? <>Cash fares & hotels: live market data · award space: Seats.aero.<br />Rows marked est. still use published-chart estimates.</>
                  : <>Estimates → live: deploy worker/ with your API keys.<br />See README · “Going live”.</>}
              </p>
            </div>
          </div>
        )}
        </div>
      </main>
      )}

      {step > 0 && (
      <footer className="border-t mt-8" style={{ borderColor: T.mist, background: T.card }}>
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex items-center gap-2.5">
            <Mark size={24} />
            <span style={{ fontFamily: "'Jost', 'Century Gothic', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: "0.24em", textTransform: "uppercase" }}>Meridian</span>
          </div>
          <p className="text-xs" style={{ color: T.inkSoft, maxWidth: "58ch" }}>
            Fares and hotel rates refresh live for your dates; award space is verified where marked.
            Always confirm availability before transferring points — transfers are one-way.
          </p>
        </div>
      </footer>
      )}

      {prefsOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setPrefsOpen(false)}>
          <div className="absolute inset-0" style={{ background: "rgba(22,24,29,0.35)" }} />
          <aside
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-[400px] max-w-[92vw] overflow-y-auto p-5 space-y-4 step-in"
            style={{ background: T.paper, boxShadow: "-16px 0 48px rgba(22,24,29,.25)" }}
          >
            <div className="flex items-center justify-between">
              <h2 style={{ fontFamily: "'Jost', 'Century Gothic', sans-serif", fontWeight: 900, fontSize: 20 }}>Points & preferences</h2>
              <button onClick={() => setPrefsOpen(false)} style={{ color: T.inkSoft }}><X size={18} /></button>
            </div>

            <button
              onClick={() => setPointsOnly(!pointsOnly)}
              className="w-full rounded-xl p-4 flex items-center justify-between text-left"
              style={{ background: pointsOnly ? T.pineTint : T.card, border: `1.5px solid ${pointsOnly ? T.pine : T.mist}` }}
            >
              <div>
                <div className="text-sm font-bold" style={{ color: pointsOnly ? T.pine : T.ink }}>
                  Points-only mode {pointsOnly ? "· ON" : "· OFF"}
                </div>
                <div className="text-xs mt-0.5" style={{ color: T.inkSoft }}>
                  Only show awards your balances can fund via card transfer partners
                </div>
              </div>
              <div className="rounded-full relative flex-shrink-0" style={{ width: 40, height: 22, background: pointsOnly ? T.pine : T.mist }}>
                <div className="rounded-full bg-white absolute transition-all" style={{ width: 18, height: 18, top: 2, left: pointsOnly ? 20 : 2 }} />
              </div>
            </button>

            <div className="rounded-xl p-4" style={{ background: T.card, border: `1px solid ${T.mist}` }}>
              <span className="text-sm font-bold">Cabin preference · long-haul</span>
              <div className="flex gap-2 mt-2">
                {["Economy", "Business"].map((c) => (
                  <button
                    key={c} onClick={() => { setCabinPref(c); setFlightSel({}); }}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold"
                    style={{
                      background: cabinPref === c ? T.railTint : T.paper,
                      border: `1.5px solid ${cabinPref === c ? T.rail : T.mist}`,
                      color: cabinPref === c ? T.rail : T.inkSoft,
                    }}
                  >{c}</button>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: T.card, border: `1px solid ${T.mist}` }}>
              <div className="flex justify-between text-sm font-bold mb-1">
                <span style={{ color: wCost > 0.5 ? T.pine : T.inkSoft }}>Cheapest</span>
                <span className="font-normal text-xs" style={{ color: T.inkSoft }}>optimizer priority</span>
                <span style={{ color: wCost < 0.5 ? T.rail : T.inkSoft }}>Fastest</span>
              </div>
              <input type="range" min={0} max={1} step={0.05} value={1 - wCost} onChange={(e) => setWCost(1 - +e.target.value)} className="w-full" />
            </div>

            <div className="rounded-xl p-4" style={{ background: T.card, border: `1px solid ${T.mist}` }}>
              <div className="flex items-center gap-2 mb-3">
                <Wallet size={15} style={{ color: T.rail }} />
                <span className="text-sm font-bold">Points balances</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {BALANCE_SOURCES.map((k) => (
                  <label key={k} className="text-xs">
                    <span className="font-semibold" style={{ color: T.inkSoft }}>{SOURCES[k].short}</span>
                    <input
                      type="number" value={balances[k] ?? 0} step={5000} min={0}
                      onChange={(e) => setBalances({ ...balances, [k]: +e.target.value })}
                      className="w-full mt-0.5 px-2 py-1.5 rounded-lg text-sm font-semibold"
                      style={{ border: `1px solid ${T.mist}`, background: T.paper, fontFamily: "'IBM Plex Mono', monospace" }}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: T.card, border: `1px solid ${T.mist}` }}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-bold">Live-data connection check</span>
                <button
                  onClick={runDiag}
                  disabled={!liveMode() || diag?.running}
                  className="py-1.5 px-3 rounded-lg text-xs font-bold text-white disabled:opacity-40"
                  style={{ background: T.ink }}
                >
                  {diag?.running ? "Checking…" : "Run check"}
                </button>
              </div>
              <p className="text-xs" style={{ color: T.inkSoft }}>
                {liveMode()
                  ? "Calls your worker for a test route (TPA → LHR, ~1 month out) and reports each API."
                  : "Unavailable in estimate mode — set VITE_API_BASE to your worker first."}
              </p>
              {diag && !diag.running && (
                <div className="mt-2 space-y-1">
                  {[["Cash fares (Travelpayouts)", diag.flights], ["Award space (Seats.aero)", diag.awards], ["Hotel rates (LiteAPI)", diag.hotels]].map(([label, v]) => (
                    <div key={label} className="flex items-start justify-between gap-2 text-xs">
                      <span style={{ color: T.inkSoft }}>{label}</span>
                      <span className="font-bold text-right" style={{ color: v.ok ? T.pine : T.flight, fontFamily: "'IBM Plex Mono', monospace" }}>{v.note}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: T.railTint, border: `1px solid ${T.rail}22` }}>
              <Info size={16} style={{ color: T.rail, marginTop: 2, flexShrink: 0 }} />
              <p className="text-xs leading-relaxed">
                <b>{liveMode() ? "Live mode" : "Estimate mode"}:</b>{" "}
                {liveMode()
                  ? "cash fares and hotel rates come from live market data for your dates, and award rows marked LIVE AWARD are verified bookable space via Seats.aero (chart estimates fill any gaps)."
                  : "award prices come from published-chart estimates and cash fares from a distance model. Deploy the included Worker with your API keys for live prices and verified award space."}
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
