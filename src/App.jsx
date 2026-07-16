import React, { useState, useMemo } from "react";
import {
  Plane, TrainFront, MapPin, Clock, Check, ChevronRight, ChevronLeft,
  Sparkles, Hotel, Wallet, Star, Info, Eye,
} from "lucide-react";

import { T, JPY } from "./theme.js";
import { CITIES } from "./data/cities.js";
import { GATEWAYS } from "./data/rail.js";
import { FLIGHTS_OUT, FLIGHTS_BACK } from "./data/flights.js";
import { HOTELS } from "./data/hotels.js";
import { permutations, scoreRoutes } from "./lib/optimizer.js";
import { hm, usd, yen, cpp, jrPassAnalysis, buildDays } from "./lib/trip.js";
import { Chip, SectionLabel, NightsStepper, StopCard } from "./components/ui.jsx";
import { RouteSpine } from "./components/RouteSpine.jsx";
import { JourneyMap } from "./components/JourneyMap.jsx";

export default function App() {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState({
    tokyo: true, kyoto: true, osaka: true,
    hakone: false, nara: false, hiroshima: false, kanazawa: false,
  });
  const [nights, setNights] = useState(
    Object.fromEntries(Object.keys(CITIES).map((k) => [k, CITIES[k].nights]))
  );
  const [wCost, setWCost] = useState(0.5);
  const [cabinPref, setCabinPref] = useState("Business");
  const [balances, setBalances] = useState({
    "Amex MR": 260000, "Chase UR": 180000, Alaska: 90000,
    Hyatt: 90000, Marriott: 120000, Hilton: 150000,
  });
  const [routeIdx, setRouteIdx] = useState(0);
  const [flightOut, setFlightOut] = useState("o1");
  const [flightBack, setFlightBack] = useState("b1");
  const [hotelPicks, setHotelPicks] = useState({});

  const cityIds = Object.keys(selected).filter((k) => selected[k]);
  const results = useMemo(
    () => (cityIds.length >= 2 ? scoreRoutes(cityIds, wCost) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, wCost]
  );
  const route = results?.top[routeIdx];
  const jr = useMemo(() => jrPassAnalysis(route), [route]);
  const days = useMemo(() => (route ? buildDays(route, nights) : []), [route, nights]);
  const fOut = FLIGHTS_OUT.find((f) => f.id === flightOut);
  const fBack = FLIGHTS_BACK.find((f) => f.id === flightBack);
  const totalNights = cityIds.reduce((s, c) => s + (nights[c] ?? 0), 0);

  const steps = ["Trip brief", "Stops", "Route & flights", "Itinerary"];

  return (
    <div className="min-h-screen" style={{ background: T.paper, color: T.ink, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: T.mist, background: T.card }}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-2">
              <h1 style={{ fontFamily: "'Zen Old Mincho', serif", fontWeight: 900, fontSize: 24, letterSpacing: "-0.01em" }}>
                Trip Architect
              </h1>
              <span style={{ fontFamily: "'Zen Old Mincho', serif", color: T.rail, fontSize: 16 }}>旅程設計</span>
            </div>
            <p className="text-xs" style={{ color: T.inkSoft }}>
              Points-optimized multi-city planner · Japan corridor prototype
            </p>
          </div>
          <Chip tint={T.flightTint} color={T.flight}>SAMPLE AWARD DATA</Chip>
        </div>

        {/* Stepper */}
        <div className="max-w-5xl mx-auto px-4 pb-3 flex gap-1 overflow-x-auto">
          {steps.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(i)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all"
              style={{
                background: i === step ? T.ink : "transparent",
                color: i === step ? "#fff" : i < step ? T.rail : T.inkSoft,
                border: `1px solid ${i === step ? T.ink : T.mist}`,
              }}
            >
              <span
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 16, height: 16, fontSize: 10,
                  background: i < step ? T.rail : i === step ? "#fff" : T.mist,
                  color: i < step ? "#fff" : i === step ? T.ink : T.inkSoft,
                }}
              >
                {i < step ? <Check size={10} /> : i + 1}
              </span>
              {s}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* ── STEP 0 · TRIP BRIEF ── */}
        {step === 0 && (
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <SectionLabel>The brief</SectionLabel>
              <h2 style={{ fontFamily: "'Zen Old Mincho', serif", fontWeight: 700, fontSize: 28, lineHeight: 1.25 }}>
                Tampa → Japan,<br />built around your points.
              </h2>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: T.inkSoft }}>
                Enter your balances and priorities. The optimizer sequences your cities, picks entry and
                exit airports, routes the trains, and prices every leg in points and cash.
              </p>
              <div className="mt-5 rounded-xl p-4" style={{ background: T.card, border: `1px solid ${T.mist}` }}>
                <div className="flex items-center gap-2 mb-3">
                  <Wallet size={15} style={{ color: T.rail }} />
                  <span className="text-sm font-bold">Points balances</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(balances).map(([k, v]) => (
                    <label key={k} className="text-xs">
                      <span className="font-semibold" style={{ color: T.inkSoft }}>{k}</span>
                      <input
                        type="number" value={v} step={5000} min={0}
                        onChange={(e) => setBalances({ ...balances, [k]: +e.target.value })}
                        className="w-full mt-0.5 px-2 py-1.5 rounded-lg text-sm font-semibold"
                        style={{ border: `1px solid ${T.mist}`, background: T.paper, fontFamily: "'IBM Plex Mono', monospace" }}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl p-4" style={{ background: T.card, border: `1px solid ${T.mist}` }}>
                <span className="text-sm font-bold">Cabin preference · transpacific</span>
                <div className="flex gap-2 mt-2">
                  {["Economy", "Business"].map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setCabinPref(c);
                        setFlightOut(c === "Business" ? "o1" : "o5");
                        setFlightBack(c === "Business" ? "b1" : "b5");
                      }}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                      style={{
                        background: cabinPref === c ? T.railTint : T.paper,
                        border: `1.5px solid ${cabinPref === c ? T.rail : T.mist}`,
                        color: cabinPref === c ? T.rail : T.inkSoft,
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl p-4" style={{ background: T.card, border: `1px solid ${T.mist}` }}>
                <div className="flex justify-between text-sm font-bold mb-1">
                  <span style={{ color: wCost > 0.5 ? T.pine : T.inkSoft }}>Cheapest</span>
                  <span className="font-normal text-xs" style={{ color: T.inkSoft }}>optimizer priority</span>
                  <span style={{ color: wCost < 0.5 ? T.rail : T.inkSoft }}>Fastest</span>
                </div>
                <input
                  type="range" min={0} max={1} step={0.05} value={1 - wCost}
                  onChange={(e) => setWCost(1 - +e.target.value)} className="w-full"
                />
                <p className="text-xs mt-1" style={{ color: T.inkSoft }}>
                  Weighting: {Math.round(wCost * 100)}% cost · {Math.round((1 - wCost) * 100)}% time.
                  Re-scores every candidate route live.
                </p>
              </div>

              <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: T.railTint, border: `1px solid ${T.rail}22` }}>
                <Info size={16} style={{ color: T.rail, marginTop: 2, flexShrink: 0 }} />
                <p className="text-xs leading-relaxed" style={{ color: T.ink }}>
                  <b>Prototype scope:</b> rail times and fares reflect published schedules; transpacific
                  award options are realistic <b>sample data</b> pending the live award-availability
                  integration. Everything else — the optimizer, gateway logic, JR Pass math, itinerary
                  assembly — is fully functional.
                </p>
              </div>

              <button
                onClick={() => setStep(1)}
                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white"
                style={{ background: T.ink }}
              >
                Choose stops <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 1 · STOPS ── */}
        {step === 1 && (
          <div>
            <SectionLabel>Your stops</SectionLabel>
            <div className="grid sm:grid-cols-3 gap-3">
              {["tokyo", "kyoto", "osaka"].map((cid) => (
                <StopCard
                  key={cid} cid={cid} on={selected[cid]} nights={nights[cid]}
                  toggle={() => setSelected({ ...selected, [cid]: !selected[cid] })}
                  setN={(n) => setNights({ ...nights, [cid]: n })}
                />
              ))}
            </div>

            <div className="mt-7">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={15} style={{ color: T.gold }} />
                <span className="text-xs font-bold tracking-widest uppercase" style={{ color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                  Suggested additions — with the true incremental cost
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {["hakone", "nara", "kanazawa", "hiroshima"].map((cid) => {
                  const c = CITIES[cid];
                  const on = selected[cid];
                  return (
                    <button
                      key={cid}
                      onClick={() => setSelected({ ...selected, [cid]: !on })}
                      className="text-left rounded-xl p-4 transition-all"
                      style={{ background: on ? T.railTint : T.card, border: `1.5px solid ${on ? T.rail : T.mist}` }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold">{c.name}</span>
                          <span style={{ fontFamily: "'Zen Old Mincho', serif", color: T.inkSoft, fontSize: 13 }}>{c.jp}</span>
                        </div>
                        <div
                          className="flex items-center justify-center rounded-full"
                          style={{ width: 22, height: 22, background: on ? T.rail : T.paper, border: `1.5px solid ${on ? T.rail : T.mist}`, color: "#fff" }}
                        >
                          {on && <Check size={13} />}
                        </div>
                      </div>
                      <p className="text-xs mt-1.5 leading-relaxed" style={{ color: T.inkSoft }}>{c.why}</p>
                      <div className="flex gap-2 mt-2.5">
                        <Chip tint={T.railTint} color={T.rail}><Clock size={11} />{c.addTime}</Chip>
                        <Chip tint={T.pineTint} color={T.pine}>{c.addCost}</Chip>
                      </div>
                      {on && (
                        <div className="flex items-center gap-2 mt-3 text-xs font-semibold" onClick={(e) => e.stopPropagation()}>
                          Nights:
                          <NightsStepper n={nights[cid]} setN={(n) => setNights({ ...nights, [cid]: n })} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between mt-6 gap-3">
              <div className="text-sm" style={{ color: T.inkSoft }}>
                <b style={{ color: T.ink }}>{cityIds.length} stops · {totalNights} nights</b> in Japan
                {cityIds.length >= 2 && <> · {permutations(cityIds).length.toLocaleString()} route orderings will be scored</>}
              </div>
              <button
                onClick={() => { setRouteIdx(0); setStep(2); }}
                disabled={cityIds.length < 2}
                className="py-3 px-5 rounded-xl font-bold text-sm flex items-center gap-2 text-white disabled:opacity-40"
                style={{ background: T.ink }}
              >
                Optimize route <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2 · ROUTE & FLIGHTS ── */}
        {step === 2 && results && route && (
          <div className="space-y-7">
            <div>
              <SectionLabel>
                Optimized routes — top {results.top.length} of {permutations(cityIds).length.toLocaleString()} scored
              </SectionLabel>
              <div className="space-y-3">
                {results.top.map((r, i) => {
                  const savedMin = results.naive.totalMin - r.totalMin;
                  const savedYen = results.naive.totalYen - r.totalYen;
                  return (
                    <button
                      key={i}
                      onClick={() => setRouteIdx(i)}
                      className="w-full text-left rounded-xl p-4 transition-all"
                      style={{ background: routeIdx === i ? T.card : T.paper, border: `2px solid ${routeIdx === i ? T.ink : T.mist}` }}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="flex items-center justify-center rounded-full text-white text-xs font-bold"
                            style={{ width: 22, height: 22, background: i === 0 ? T.rail : T.inkSoft }}
                          >
                            {i + 1}
                          </span>
                          <span className="font-bold text-sm">
                            {i === 0 ? "Recommended" : `Alternative ${i}`} · {r.inGw.gw} in / {r.outGw.gw} out{" "}
                            {r.inGw.gw !== r.outGw.gw && <Chip tint={T.pineTint} color={T.pine}>open jaw</Chip>}
                          </span>
                        </div>
                        <div className="flex gap-2 text-xs font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                          <Chip tint={T.railTint} color={T.rail}><Clock size={11} />{hm(r.totalMin)} ground</Chip>
                          <Chip tint={T.pineTint} color={T.pine}>{yen(r.totalYen)} ≈ {usd(r.totalYen / JPY)}</Chip>
                        </div>
                      </div>
                      <RouteSpine route={r} compact />
                      {i === 0 && savedMin > 15 && (
                        <p className="text-xs mt-2" style={{ color: T.pine }}>
                          <b>Why this wins:</b> vs. a naive Tokyo round trip in your listed order, this saves{" "}
                          {hm(Math.max(savedMin, 0))} of ground travel
                          {savedYen > 500 && <> and {yen(savedYen)} (≈ {usd(savedYen / JPY)})</>} — mostly by
                          not backtracking to the arrival gateway.
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Transpacific */}
            <div className="grid md:grid-cols-2 gap-5">
              {[
                { dir: "Outbound · TPA → " + route.inGw.gw, list: FLIGHTS_OUT.filter((f) => f.gw === route.inGw.gw || route.inGw.gw === "HND"), sel: flightOut, set: setFlightOut },
                { dir: "Return · " + route.outGw.gw + " → TPA", list: FLIGHTS_BACK.filter((f) => f.gw === route.outGw.gw), sel: flightBack, set: setFlightBack },
              ].map(({ dir, list, sel, set }) => (
                <div key={dir}>
                  <SectionLabel>{dir}</SectionLabel>
                  <div className="space-y-2">
                    {list.map((f) => {
                      const chosen = sel === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => set(f.id)}
                          className="w-full text-left rounded-xl p-3 transition-all"
                          style={{ background: chosen ? T.card : T.paper, border: `1.5px solid ${chosen ? T.flight : T.mist}` }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Plane size={14} style={{ color: T.flight }} />
                              <span className="font-bold text-sm">{f.airline} · {f.cabin}</span>
                            </div>
                            <span className="text-xs" style={{ color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                              {f.via} · {f.dur}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-2 flex-wrap gap-1">
                            <div className="text-sm font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                              {(f.points / 1000).toFixed(0)}K{" "}
                              <span className="text-xs font-normal" style={{ color: T.inkSoft }}>
                                {f.program} + {usd(f.fees)}
                              </span>
                            </div>
                            <div className="flex gap-1.5">
                              <Chip tint={T.pineTint} color={T.pine}>{cpp(f)}¢/pt</Chip>
                              <Chip tint={T.mist} color={T.inkSoft}>cash {usd(f.cash)}</Chip>
                            </div>
                          </div>
                          <p className="text-xs mt-1" style={{ color: T.inkSoft }}>Transfer path: {f.xfer}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* JR Pass */}
            {jr && (
              <div
                className="rounded-xl p-4 flex items-start gap-3"
                style={{ background: jr.worthIt ? T.pineTint : T.card, border: `1px solid ${jr.worthIt ? T.pine : T.mist}` }}
              >
                <TrainFront size={17} style={{ color: jr.worthIt ? T.pine : T.inkSoft, marginTop: 2, flexShrink: 0 }} />
                <div className="text-sm">
                  <b>JR Pass check:</b> your itinerary's JR-covered fares total ≈ {yen(jr.jrYen)}. A {jr.pass.name} costs {yen(jr.pass.cost)} —{" "}
                  {jr.worthIt ? (
                    <b style={{ color: T.pine }}>
                      the pass saves you ≈ {yen(jr.jrYen - jr.pass.cost)} ({usd((jr.jrYen - jr.pass.cost) / JPY)}).
                      Buy it (note: Nozomi requires a supplement; times shown assume Hikari where relevant).
                    </b>
                  ) : (
                    <b> point-to-point tickets win by ≈ {yen(jr.pass.cost - jr.jrYen)}. Skip the pass.</b>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="py-3 px-4 rounded-xl font-bold text-sm flex items-center gap-1"
                style={{ border: `1px solid ${T.mist}`, color: T.inkSoft }}
              >
                <ChevronLeft size={16} /> Stops
              </button>
              <button
                onClick={() => setStep(3)}
                className="py-3 px-5 rounded-xl font-bold text-sm flex items-center gap-2 text-white"
                style={{ background: T.ink }}
              >
                Build itinerary <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 · ITINERARY ── */}
        {step === 3 && route && fOut && fBack && (
          <div className="space-y-8">
            {/* Summary band */}
            <div className="rounded-2xl p-5 text-white" style={{ background: T.ink }}>
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <h2 style={{ fontFamily: "'Zen Old Mincho', serif", fontWeight: 700, fontSize: 22 }}>
                  {days.length} days · {route.order.map((c) => CITIES[c].name).join(" → ")}
                </h2>
                <span className="text-xs opacity-70" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                  {route.inGw.gw} IN · {route.outGw.gw} OUT{route.inGw.gw !== route.outGw.gw && " · OPEN JAW"}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {[
                  ["Flights (points)", `${((fOut.points + fBack.points) / 1000).toFixed(0)}K + ${usd(fOut.fees + fBack.fees)}`],
                  ["vs. cash airfare", usd(fOut.cash + fBack.cash)],
                  ["Ground transport", `${usd(route.totalYen / JPY)} · ${hm(route.totalMin)}`],
                  ["Redemption value", `${(((fOut.cash + fBack.cash - fOut.fees - fBack.fees) / (fOut.points + fBack.points)) * 100).toFixed(1)}¢ per point`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="text-xs opacity-60">{k}</div>
                    <div className="font-bold text-sm mt-0.5" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Spine + map */}
            <div>
              <SectionLabel>The journey</SectionLabel>
              <div className="rounded-xl p-4 mb-4" style={{ background: T.card, border: `1px solid ${T.mist}` }}>
                <RouteSpine route={route} />
              </div>
              <JourneyMap route={route} />
            </div>

            {/* Hotels */}
            <div>
              <SectionLabel>Hotels — scored on views &amp; quality</SectionLabel>
              <div className="space-y-4">
                {route.order.map((cid) => (
                  <div key={cid}>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="font-bold text-sm">{CITIES[cid].name}</span>
                      <span className="text-xs" style={{ color: T.inkSoft }}>
                        {nights[cid]} night{nights[cid] !== 1 && "s"}
                      </span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {HOTELS[cid].map((h) => {
                        const chosen = (hotelPicks[cid] ?? HOTELS[cid][0].name) === h.name;
                        return (
                          <button
                            key={h.name}
                            onClick={() => setHotelPicks({ ...hotelPicks, [cid]: h.name })}
                            className="text-left rounded-xl p-3 transition-all"
                            style={{ background: chosen ? T.card : T.paper, border: `1.5px solid ${chosen ? T.gold : T.mist}` }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-sm">{h.name}</span>
                              {chosen && <Check size={14} style={{ color: T.gold }} />}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <Chip tint={T.railTint} color={T.rail}><Eye size={11} /> view {h.view}</Chip>
                              <Chip tint={T.mist} color={T.inkSoft}><Star size={11} /> {h.quality}</Chip>
                              {h.pts ? (
                                <Chip tint={T.pineTint} color={T.pine}>{(h.pts / 1000).toFixed(0)}K {h.program}/nt</Chip>
                              ) : (
                                <Chip tint={T.mist} color={T.inkSoft}>cash only</Chip>
                              )}
                              <span className="text-xs font-semibold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: T.inkSoft }}>
                                {usd(h.cash)}/nt
                              </span>
                            </div>
                            <p className="text-xs mt-1.5" style={{ color: T.inkSoft }}>{h.note}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Day by day */}
            <div>
              <SectionLabel>Day by day</SectionLabel>
              <div className="space-y-3">
                {days.map((d) => (
                  <div key={d.day} className="rounded-xl p-4 flex gap-4" style={{ background: T.card, border: `1px solid ${T.mist}` }}>
                    <div className="flex flex-col items-center" style={{ minWidth: 44 }}>
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                        Day
                      </span>
                      <span style={{ fontFamily: "'Zen Old Mincho', serif", fontWeight: 900, fontSize: 26, lineHeight: 1 }}>{d.day}</span>
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm mb-2" style={{ fontFamily: "'Zen Old Mincho', serif", fontSize: 15 }}>{d.title}</div>
                      <div className="space-y-1.5">
                        {d.items.map((it, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <span
                              style={{
                                color: it.icon === "flight" ? T.flight : it.icon === "train" ? T.rail : it.icon === "hotel" ? T.gold : T.inkSoft,
                                marginTop: 2, flexShrink: 0,
                              }}
                            >
                              {it.icon === "flight" ? <Plane size={13} /> : it.icon === "train" ? <TrainFront size={13} /> : it.icon === "hotel" ? <Hotel size={13} /> : <MapPin size={13} />}
                            </span>
                            <span className="text-xs font-bold whitespace-nowrap" style={{ minWidth: 68, color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                              {it.t}
                            </span>
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
              <button
                onClick={() => setStep(2)}
                className="py-3 px-4 rounded-xl font-bold text-sm flex items-center gap-1"
                style={{ border: `1px solid ${T.mist}`, color: T.inkSoft }}
              >
                <ChevronLeft size={16} /> Route &amp; flights
              </button>
              <p className="text-xs text-right" style={{ color: T.inkSoft }}>
                Next build phase: live award availability,<br />hotel APIs, PDF export, shareable links.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
