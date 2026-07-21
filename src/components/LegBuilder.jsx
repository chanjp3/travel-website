import React, { useState, useMemo, useEffect } from "react";
import { Plane, TrainFront, ChevronLeft, Check, X } from "lucide-react";
import { T } from "../theme.js";
import { usd, cpp } from "../lib/trip.js";
import { km } from "../lib/geo.js";
import { airportByIata } from "../lib/airports.js";
import { SOURCES } from "../data/transferPartners.js";
import { bestPath, describePath } from "../lib/funding.js";
import { useLiveLeg, useLiveAwards } from "../api/useLive.js";
import { mergeLiveLeg, mergeLiveAwards } from "../lib/liveMerge.js";
import { bookLink, cashSearchLink } from "../lib/bookLinks.js";
import { Chip, SectionLabel } from "./ui.jsx";
import { AirportField } from "./AirportField.jsx";
import { defaultDepart, addDays, fmtDay } from "../lib/dates.js";

/**
 * Flight-first, leg-by-leg trip builder. Start with one one-way flight
 * (TPA → HND on a date), see the full flight page for that route, choose
 * the specific flight, add where you're staying and for how long, then
 * decide: return flight home, or another country — by air or, where the
 * distance allows, by train. Every flight decision gets its own page.
 */

const LS_KEY = "meridian.legTrip";
const cityOf = (iata) => airportByIata.get(iata)?.city ?? iata;
const staySum = (stay) => stay.reduce((s, c) => s + (c.nights || 0), 0);

/* ── one full-page list of flights for a route+date ── */
function FlightPicker({ from, to, date, cabin, balances, onPick, onSkip, onBack, title }) {
  const live = useLiveLeg(from, to, date, cabin);
  const awards = useLiveAwards(from, to, date);
  const leg = useMemo(() => {
    const base = { options: [], routing: { stops: 0 } };
    return mergeLiveAwards(mergeLiveLeg(base, live.offers, cabin), awards.rows, date);
  }, [live.offers, awards.rows, cabin, date]);
  const loading = live.loading || awards.loading;
  const awardRows = leg.options.filter((f) => f.points);
  const cashRows = leg.options.filter((f) => !f.points);
  const gf = cashSearchLink(from, to, date, cabin);

  const Row = ({ f }) => {
    const path = f.points ? bestPath(f.programId, f.points, balances) : null;
    return (
      <button
        onClick={() => onPick(f)}
        className="w-full text-left rounded-xl p-3"
        style={{ background: T.paper, border: `1.5px solid ${T.mist}` }}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Plane size={14} style={{ color: T.flight }} />
            <span className="font-bold text-sm">{f.airline} · {f.cabin}</span>
            {f.awardLive ? (
              <>
                <Chip tint={T.pineTint} color={T.pine}>LIVE AWARD</Chip>
                {f.seats != null && f.seats > 0 && <Chip tint={T.goldTint ?? T.mist} color={T.gold}>{f.seats} seat{f.seats !== 1 && "s"}</Chip>}
                {f.cash != null && +cpp(f) >= 1.7 && <Chip tint={T.goldTint ?? T.mist} color={T.gold}>🔥 GREAT DEAL</Chip>}
              </>
            ) : f.testData ? (
              <Chip tint={T.flightTint} color={T.flight}>TEST DATA</Chip>
            ) : f.live ? (
              <Chip tint={T.pineTint} color={T.pine}>{f.bookable ? "BOOKABLE" : "LIVE"}</Chip>
            ) : null}
          </div>
          <span className="text-xs" style={{ color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
            {f.dep ? `${f.dep}${f.arr ? `–${f.arr}` : ""} · ` : ""}{f.via}{f.dur ? ` · ${f.dur}` : ""}
          </span>
        </div>
        {f.flightNos && <p className="text-xs mt-1" style={{ color: T.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{f.flightNos}</p>}
        {f.selfTransfer && (
          <p className="text-xs mt-1" style={{ color: T.flight }}>
            <b>Built connection:</b> two separate tickets — {f.layover} in {f.hub} to change planes. Recollect bags.
          </p>
        )}
        <div className="flex items-center justify-between mt-2 flex-wrap gap-1">
          {f.points ? (
            <div className="text-sm font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              {(f.points / 1000).toFixed(0)}K <span className="text-xs font-normal" style={{ color: T.inkSoft }}>{SOURCES[f.programId]?.short} + {usd(f.fees)}</span>
            </div>
          ) : (
            <div className="text-sm font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{usd(f.cash)}</div>
          )}
          {f.points && f.cash != null && <Chip tint={T.pineTint} color={T.pine}>{cpp(f)}¢/pt</Chip>}
        </div>
        {f.points && <p className="text-xs mt-1" style={{ color: path ? T.inkSoft : T.flight }}>{describePath(path, f.programId)}</p>}
        {f.awardLive && !f.twoBookings && bookLink(f.programId, from, to, date, f.cabin) && (
          <a
            href={bookLink(f.programId, from, to, date, f.cabin)} target="_blank" rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-bold inline-block mt-1.5" style={{ color: T.flight, textDecoration: "underline" }}
          >Verify & book on {SOURCES[f.programId]?.short} ↗</a>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <SectionLabel>{title} · {from} → {to} · {fmtDay(date)}</SectionLabel>
        {gf && (
          <a href={gf} target="_blank" rel="noreferrer" className="text-xs font-bold mb-1" style={{ color: T.flight, textDecoration: "underline" }}>
            Compare live on Google Flights ↗
          </a>
        )}
      </div>
      {loading && (
        <div className="space-y-2">
          <p className="text-xs pulse-dot" style={{ color: T.flight }}>Searching live fares & award space…</p>
          {[0, 1, 2].map((i) => <div key={i} className="rounded-xl skel" style={{ height: 74 }} />)}
        </div>
      )}
      {!loading && awardRows.length > 0 && (
        <>
          <p className="text-xs font-bold" style={{ color: T.pine }}>Book with points</p>
          <div className="space-y-2">{awardRows.map((f) => <Row key={f.id} f={f} />)}</div>
        </>
      )}
      {!loading && cashRows.length > 0 && (
        <>
          <p className="text-xs font-bold" style={{ color: T.inkSoft }}>Cash fares</p>
          <div className="space-y-2">{cashRows.map((f) => <Row key={f.id} f={f} />)}</div>
        </>
      )}
      {leg.nearbyAwards?.length > 0 && (
        <p className="text-xs rounded-xl p-3" style={{ background: T.card, border: `1px dashed ${T.pine}` }}>
          <b style={{ color: T.pine }}>Award space on nearby dates:</b>{" "}
          {leg.nearbyAwards.map((n, i) => `${i ? " · " : ""}${n.date} ${(n.miles / 1000).toFixed(0)}K ${SOURCES[n.programId]?.short ?? ""} ${n.cabin}`).join("")}
        </p>
      )}
      {!loading && awardRows.length === 0 && cashRows.length === 0 && (
        <div className="rounded-xl p-5 text-center" style={{ background: T.card, border: `1px dashed ${T.mist}` }}>
          <p className="text-sm font-bold">No live results for this route & date yet</p>
          <p className="text-xs mt-1" style={{ color: T.inkSoft }}>
            Try another date, or check the live market directly{gf && <> on <a href={gf} target="_blank" rel="noreferrer" style={{ color: T.flight, textDecoration: "underline" }}>Google Flights ↗</a></>}.
          </p>
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        <button onClick={onBack} className="py-2.5 px-4 rounded-xl font-bold text-xs flex items-center gap-1" style={{ border: `1px solid ${T.mist}`, color: T.inkSoft }}>
          <ChevronLeft size={14} /> Back
        </button>
        <button onClick={onSkip} className="py-2.5 px-4 rounded-xl font-bold text-xs" style={{ border: `1.5px dashed ${T.mist}`, color: T.inkSoft }}>
          Decide this flight later →
        </button>
      </div>
    </div>
  );
}

/* ── the wizard ── */
export function LegBuilder({ cabinPref, balances, onExit }) {
  const [legs, setLegs] = useState([]);       // {kind:'air'|'rail', from, to, date, pick|est}
  const [staysByLeg, setStaysByLeg] = useState({}); // legIndex → [{name, nights}]
  const [phase, setPhase] = useState("route");
  const [draft, setDraft] = useState({ from: "TPA", to: null, date: defaultDepart(), isReturn: false, mode: "air" });
  const [resume, setResume] = useState(null);

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(LS_KEY)); if (s?.legs?.length) setResume(s); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (!legs.length) return;
    try { localStorage.setItem(LS_KEY, JSON.stringify({ legs, staysByLeg, phase, draft })); } catch { /* ignore */ }
  }, [legs, staysByLeg, phase, draft]);

  const lastLeg = legs[legs.length - 1];
  const homeAir = legs[0]?.from ?? draft.from;
  const currentAir = lastLeg?.to;
  const nextDate = lastLeg ? addDays(lastLeg.date, Math.max(staySum(staysByLeg[legs.length - 1] ?? []), 1)) : draft.date;

  const finishFlight = (pick) => {
    const leg = { kind: "air", from: draft.from, to: draft.to, date: draft.date, pick };
    const next = [...legs, leg];
    setLegs(next);
    if (draft.isReturn) { setPhase("summary"); return; }
    setStaysByLeg({ ...staysByLeg, [next.length - 1]: [{ name: cityOf(draft.to), nights: 3 }] });
    setPhase("stay");
  };
  const addRail = () => {
    const a = airportByIata.get(draft.from), b = airportByIata.get(draft.to);
    const dist = a && b ? km(a, b) : 9999;
    const leg = {
      kind: "rail", from: draft.from, to: draft.to, date: draft.date,
      estMin: Math.round((dist / 110) * 60 + 30), estUsd: Math.round(40 + dist * 0.12), km: Math.round(dist),
    };
    const next = [...legs, leg];
    setLegs(next);
    setStaysByLeg({ ...staysByLeg, [next.length - 1]: [{ name: cityOf(draft.to), nights: 3 }] });
    setPhase("stay");
  };
  const railPossible = draft.to && airportByIata.get(draft.from) && airportByIata.get(draft.to)
    && km(airportByIata.get(draft.from), airportByIata.get(draft.to)) < 800;

  const stay = staysByLeg[legs.length - 1] ?? [];
  const setStay = (s) => setStaysByLeg({ ...staysByLeg, [legs.length - 1]: s });

  const totals = useMemo(() => {
    let cash = 0;
    const ptsLines = [];
    for (const l of legs) {
      if (l.kind === "rail") { cash += l.estUsd; continue; }
      const f = l.pick;
      if (!f) continue;
      if (f.points) {
        cash += f.fees ?? 0;
        const path = bestPath(f.programId, f.points, balances);
        ptsLines.push(`${(f.points / 1000).toFixed(0)}K ${SOURCES[f.programId]?.short ?? ""}${path ? ` — ${describePath(path, f.programId)}` : " — no card transfer path"}`);
      } else cash += f.cash ?? 0;
    }
    return { cash: Math.round(cash), ptsLines };
  }, [legs, balances]);

  const inner = (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h2 style={{ fontFamily: "'Jost', 'Century Gothic', sans-serif", fontWeight: 700, fontSize: 20, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Flight-first builder
        </h2>
        <button onClick={onExit} className="py-2 px-3 rounded-xl text-xs font-bold flex items-center gap-1" style={{ border: `1px solid ${T.mist}`, color: T.inkSoft }}>
          <X size={13} /> Back to the map
        </button>
      </div>

      {/* trip so far */}
      {legs.length > 0 && (
        <div className="rounded-xl p-3 text-xs space-y-1" style={{ background: T.card, border: `1px solid ${T.mist}` }}>
          {legs.map((l, i) => (
            <div key={i}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                {l.kind === "rail" ? "🚄" : "✈"} {l.from} → {l.to} · {fmtDay(l.date)}
              </span>{" "}
              {l.kind === "rail"
                ? <span style={{ color: T.inkSoft }}>train ≈ {Math.floor(l.estMin / 60)}h {l.estMin % 60}m · {usd(l.estUsd)}</span>
                : l.pick
                ? <span style={{ color: T.pine }}>{l.pick.airline} · {l.pick.points ? `${(l.pick.points / 1000).toFixed(0)}K ${SOURCES[l.pick.programId]?.short ?? ""}` : usd(l.pick.cash)}</span>
                : <span style={{ color: T.flight }}>flight not chosen yet</span>}
              {staysByLeg[i]?.length > 0 && !((i === legs.length - 1) && phase === "stay") && (
                <span style={{ color: T.inkSoft }}> → {staysByLeg[i].map((c) => `${c.name} ${c.nights}nt`).join(", ")}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {phase === "route" && (
        <div className="space-y-3">
          {resume && legs.length === 0 && (
            <button
              onClick={() => { setLegs(resume.legs); setStaysByLeg(resume.staysByLeg ?? {}); setDraft(resume.draft); setPhase(resume.phase === "flights" ? "route" : resume.phase); setResume(null); }}
              className="w-full text-left rounded-xl p-3 text-xs font-bold" style={{ background: T.pineTint, border: `1.5px dashed ${T.pine}`, color: T.pine }}
            >Continue your flight-by-flight trip ({resume.legs.length} leg{resume.legs.length !== 1 ? "s" : ""} so far) →</button>
          )}
          <SectionLabel>Your first flight</SectionLabel>
          <div className="grid sm:grid-cols-3 gap-3">
            <AirportField label="From" value={draft.from} onPick={(a) => a && setDraft({ ...draft, from: a.iata })} />
            <AirportField label="To" value={draft.to} onPick={(a) => a && setDraft({ ...draft, to: a.iata })} />
            <div>
              <label className="text-xs font-bold block mb-1" style={{ color: T.inkSoft }}>Date</label>
              <input
                type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                className="w-full px-2.5 py-2 rounded-lg text-sm" style={{ border: `1px solid ${T.mist}`, background: T.paper }}
              />
            </div>
          </div>
          <button
            disabled={!draft.from || !draft.to || !draft.date}
            onClick={() => setPhase("flights")}
            className="py-3 px-5 rounded-xl font-bold text-sm text-white disabled:opacity-40" style={{ background: T.flight }}
          >See flights for this route →</button>
        </div>
      )}

      {phase === "flights" && (
        <FlightPicker
          from={draft.from} to={draft.to} date={draft.date} cabin={cabinPref} balances={balances}
          title={draft.isReturn ? "Return flight" : `Flight ${legs.length + 1}`}
          onPick={finishFlight}
          onSkip={() => finishFlight(null)}
          onBack={() => setPhase(legs.length ? "decide" : "route")}
        />
      )}

      {phase === "stay" && (
        <div className="space-y-3">
          <SectionLabel>Staying in {cityOf(currentAir)} — where & how long?</SectionLabel>
          {stay.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={c.name}
                onChange={(e) => setStay(stay.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                className="flex-1 px-2.5 py-2 rounded-lg text-sm" style={{ border: `1px solid ${T.mist}`, background: T.paper }}
              />
              <button onClick={() => setStay(stay.map((x, j) => (j === i ? { ...x, nights: Math.max(1, x.nights - 1) } : x)))} className="px-3 py-2 rounded-lg font-bold" style={{ border: `1px solid ${T.mist}` }}>−</button>
              <span className="text-sm font-bold w-12 text-center" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{c.nights} nt</span>
              <button onClick={() => setStay(stay.map((x, j) => (j === i ? { ...x, nights: x.nights + 1 } : x)))} className="px-3 py-2 rounded-lg font-bold" style={{ border: `1px solid ${T.mist}` }}>+</button>
              {stay.length > 1 && <button onClick={() => setStay(stay.filter((_, j) => j !== i))} className="px-2 py-2 rounded-lg" style={{ color: T.flight }}><X size={13} /></button>}
            </div>
          ))}
          <button onClick={() => setStay([...stay, { name: "", nights: 2 }])} className="py-2 px-3 rounded-xl text-xs font-bold" style={{ border: `1.5px dashed ${T.mist}`, color: T.inkSoft }}>
            + Add another city here
          </button>
          <div>
            <button
              onClick={() => { setDraft({ from: currentAir, to: null, date: nextDate, isReturn: false, mode: "air" }); setPhase("decide"); }}
              className="py-3 px-5 rounded-xl font-bold text-sm text-white" style={{ background: T.ink }}
            >Continue →</button>
          </div>
        </div>
      )}

      {phase === "decide" && (
        <div className="space-y-3">
          <SectionLabel>After {cityOf(currentAir)} · departing {fmtDay(nextDate)}</SectionLabel>
          <div className="grid sm:grid-cols-3 gap-3">
            <AirportField label="Depart from" value={draft.from} onPick={(a) => a && setDraft({ ...draft, from: a.iata })} />
            <AirportField label="Next stop (for another country)" value={draft.to} onPick={(a) => a && setDraft({ ...draft, to: a.iata })} allowClear />
            <div>
              <label className="text-xs font-bold block mb-1" style={{ color: T.inkSoft }}>Date</label>
              <input
                type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                className="w-full px-2.5 py-2 rounded-lg text-sm" style={{ border: `1px solid ${T.mist}`, background: T.paper }}
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setDraft({ ...draft, to: homeAir, isReturn: true }); setPhase("flights"); }}
              className="py-3 px-5 rounded-xl font-bold text-sm text-white" style={{ background: T.flight }}
            >Return flight home ({draft.from} → {homeAir}) →</button>
            <button
              disabled={!draft.to}
              onClick={() => setPhase("flights")}
              className="py-3 px-5 rounded-xl font-bold text-sm disabled:opacity-40" style={{ border: `1.5px solid ${T.ink}` }}
            ><Plane size={14} className="inline mr-1" />Fly to {draft.to ?? "…"} →</button>
            {railPossible && (
              <button
                onClick={addRail}
                className="py-3 px-5 rounded-xl font-bold text-sm" style={{ border: `1.5px solid ${T.rail ?? T.pine}`, color: T.rail ?? T.pine }}
              ><TrainFront size={14} className="inline mr-1" />Train to {draft.to} (≈{Math.round(km(airportByIata.get(draft.from), airportByIata.get(draft.to)) / 110)}h) →</button>
            )}
          </div>
          {draft.to && !railPossible && (
            <p className="text-xs" style={{ color: T.inkSoft }}>Train isn't practical for {draft.from} → {draft.to} (too far) — flying it is.</p>
          )}
        </div>
      )}

      {phase === "summary" && (
        <div className="space-y-3">
          <SectionLabel>Your trip, flight by flight</SectionLabel>
          {legs.map((l, i) => (
            <div key={i} className="rounded-xl p-3" style={{ background: T.paper, border: `1.5px solid ${T.mist}` }}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold text-sm">
                  {l.kind === "rail" ? <TrainFront size={14} className="inline mr-1" /> : <Plane size={14} className="inline mr-1" />}
                  {l.from} → {l.to} · {fmtDay(l.date)}
                </span>
                {l.kind === "rail" ? (
                  <span className="text-xs" style={{ color: T.inkSoft }}>≈ {Math.floor(l.estMin / 60)}h {l.estMin % 60}m · {usd(l.estUsd)} (est. — check local rail)</span>
                ) : l.pick ? (
                  <span className="text-xs font-bold" style={{ color: T.pine }}>
                    {l.pick.airline} {l.pick.flightNos ? `· ${l.pick.flightNos}` : ""} · {l.pick.points ? `${(l.pick.points / 1000).toFixed(0)}K + ${usd(l.pick.fees)}` : usd(l.pick.cash)}
                  </span>
                ) : (
                  <a href={cashSearchLink(l.from, l.to, l.date, cabinPref)} target="_blank" rel="noreferrer" className="text-xs font-bold" style={{ color: T.flight, textDecoration: "underline" }}>
                    not chosen — compare on Google Flights ↗
                  </a>
                )}
              </div>
              {staysByLeg[i]?.length > 0 && (
                <p className="text-xs mt-1" style={{ color: T.inkSoft }}>
                  then {staysByLeg[i].map((c) => `${c.name || "?"} · ${c.nights} night${c.nights !== 1 ? "s" : ""}`).join(" → ")}
                </p>
              )}
            </div>
          ))}
          <div className="rounded-xl p-4 text-white space-y-1" style={{ background: T.ink }}>
            <p className="text-sm font-bold">Cash out of pocket: {usd(totals.cash)}</p>
            {totals.ptsLines.map((p, i) => <p key={i} className="text-xs opacity-90">{p}</p>)}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setLegs([]); setStaysByLeg({}); setDraft({ from: homeAir, to: null, date: defaultDepart(), isReturn: false, mode: "air" }); setPhase("route"); try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ } }}
              className="py-2.5 px-4 rounded-xl font-bold text-xs" style={{ border: `1px solid ${T.mist}`, color: T.inkSoft }}
            >Start over</button>
            <button onClick={onExit} className="py-2.5 px-4 rounded-xl font-bold text-xs text-white" style={{ background: T.ink }}>
              <Check size={13} className="inline mr-1" />Done — back to the map
            </button>
          </div>
          <p className="text-xs" style={{ color: T.inkSoft }}>
            Want hotels and attractions for these stays? Plot the same trip on the map planner — the city tour finds live rates around each stop.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ background: T.paper, zIndex: 60 }}>
      {inner}
    </div>
  );
}
