import React, { useEffect, useState } from "react";
import { Check, ExternalLink, AlertTriangle, Plane, Hotel, TrainFront } from "lucide-react";
import { T } from "../theme.js";
import { Chip, SectionLabel } from "./ui.jsx";
import { fmtShort } from "../lib/dates.js";

/**
 * "How to book" — the playbook as a working checklist. Each booking shows
 * the price Meridian saw, pre-filled links and the exact steps; ticks and
 * confirmation codes are kept in this browser for this trip.
 */
const STORE = "meridian.booked.v1";
const readAll = () => { try { return JSON.parse(localStorage.getItem(STORE) ?? "{}"); } catch { return {}; } };
const writeAll = (v) => { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { /* private mode: ticks just don't persist */ } };
const ICON = { flight: Plane, hotel: Hotel, ground: TrainFront };
const PAY = {
  points: [T.pineTint, T.pine, "points"],
  cash: [T.mist, T.inkSoft, "cash"],
  pass: [T.railTint, T.rail, "rail pass"],
};

export function BookingPlaybook({ playbook, storeKey }) {
  const [marks, setMarks] = useState(() => readAll()[storeKey] ?? {});
  useEffect(() => setMarks(readAll()[storeKey] ?? {}), [storeKey]);
  const save = (id, patch) => setMarks((m) => {
    const next = { ...m, [id]: { ...m[id], ...patch } };
    writeAll({ ...readAll(), [storeKey]: next });
    return next;
  });

  const { steps, tips } = playbook;
  const done = steps.filter((s) => marks[s.id]?.done).length;

  return (
    <div id="playbook">
      <SectionLabel>How to book it</SectionLabel>
      <div className="rounded-xl px-4 py-3 mb-3" style={{ background: T.card, border: `1px solid ${T.mist}` }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm font-semibold">{done} of {steps.length} booked</span>
          <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: T.mist, minWidth: 120, maxWidth: 320 }}>
            <div style={{ width: `${(done / Math.max(steps.length, 1)) * 100}%`, height: "100%", background: T.pine, transition: "width .4s ease" }} />
          </div>
        </div>
        <ul className="mt-2 space-y-1">
          {tips.map((t) => <li key={t} className="text-xs" style={{ color: T.inkSoft }}>· {t}</li>)}
        </ul>
      </div>

      <ol className="space-y-2.5">
        {steps.map((s, i) => {
          const m = marks[s.id] ?? {};
          const Icon = ICON[s.kind] ?? TrainFront;
          const [tint, color, payLabel] = PAY[s.pay] ?? PAY.cash;
          return (
            <li
              key={s.id} className="rounded-xl p-4 rise"
              style={{ background: m.done ? T.pineTint : T.card, border: `1px solid ${m.done ? `${T.pine}55` : T.mist}`, animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => save(s.id, { done: !m.done })}
                  aria-label={m.done ? `Mark step ${s.n} not booked` : `Mark step ${s.n} booked`}
                  className="shrink-0 rounded-full flex items-center justify-center"
                  style={{ width: 26, height: 26, marginTop: 1, background: m.done ? T.pine : T.paper, border: `1.5px solid ${m.done ? T.pine : T.gold}`, color: m.done ? T.paper : T.gold, fontFamily: "'Jost', sans-serif", fontSize: 12, fontWeight: 700 }}
                >{m.done ? <Check size={14} /> : s.n}</button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Icon size={13} style={{ color: T.gold }} />
                        <span className="font-bold text-sm" style={{ textDecoration: m.done ? "line-through" : "none" }}>{s.title}</span>
                        <Chip tint={tint} color={color}>{payLabel}</Chip>
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: T.inkSoft }}>
                        {[s.date && fmtShort(s.date), s.sub].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold whitespace-nowrap" style={{ fontFamily: "'Jost', sans-serif" }}>{s.price}</div>
                      {s.priceSub && <div className="text-xs" style={{ color: T.inkSoft }}>{s.priceSub}</div>}
                    </div>
                  </div>

                  {!m.done && (
                    <>
                      <ol className="mt-2.5 space-y-1">
                        {s.how.map((h, k) => (
                          <li key={k} className="text-xs flex gap-2" style={{ color: T.ink }}>
                            <span style={{ color: T.gold, fontFamily: "'Jost', sans-serif", fontWeight: 700, minWidth: 12 }}>{k + 1}</span>
                            <span>{h}</span>
                          </li>
                        ))}
                      </ol>
                      {s.warn.map((w) => (
                        <div key={w} className="text-xs mt-1.5 flex gap-1.5 items-start" style={{ color: "#7A2331" }}>
                          <AlertTriangle size={12} style={{ marginTop: 1, flexShrink: 0 }} /><span>{w}</span>
                        </div>
                      ))}
                    </>
                  )}

                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    {!m.done && s.links.map((l) => (
                      <a
                        key={l.url} href={l.url} target="_blank" rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold"
                        style={{ background: T.ink, color: T.paper }}
                      >{l.label} <ExternalLink size={11} /></a>
                    ))}
                    <input
                      value={m.conf ?? ""} placeholder="Confirmation code"
                      onChange={(e) => save(s.id, { conf: e.target.value.slice(0, 40) })}
                      className="px-2.5 py-1.5 rounded-lg text-xs"
                      style={{ width: 150, background: T.paper, border: `1px solid ${T.mist}`, fontFamily: "'Jost', sans-serif" }}
                    />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
