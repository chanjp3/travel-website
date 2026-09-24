/**
 * Read-only shared itinerary. Renders a v1 snapshot from the worker —
 * no map, no React, no live lookups. Every value from the snapshot goes
 * through esc() (or the escaping flight-path renderer); nothing stored
 * is ever inserted as markup. ?print=1 opens the print dialog once the
 * page is laid out, for "Save as PDF".
 */
import "../index.css";
import "./share.css";
import { loadShare } from "../api/client.js";
import { flightPathHTML, chainPathHTML } from "../lib/flightPath.js";
import { fmtDay } from "../lib/dates.js";

const root = document.getElementById("share");
const params = new URLSearchParams(location.search);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const usd = (n) => `$${Math.round(n ?? 0).toLocaleString("en-US")}`;
const kpts = (p) => `${+(p / 1000).toFixed(1)}K`;
const day = (iso) => (iso ? fmtDay(iso) : "");

function payText(p) {
  if (!p) return "";
  if (p.kind === "included") return "Included in the round-trip fare";
  if (p.kind === "points") return `${kpts(p.points)} ${p.source ?? "points"}${p.transfer && p.program ? ` → ${p.program}` : ""} + ${usd(p.fees)} taxes`;
  if (p.kind === "miles") return `${kpts(p.points)} ${p.program ?? ""} miles + ${usd(p.fees)} taxes`;
  if (p.nightly != null) return `${usd(p.nightly)}/night · ${usd(p.total)} total`;
  return `${usd(p.cash)}${p.roundTrip && p.rtTotal ? ` · half of the ${usd(p.rtTotal)} round-trip fare` : ""}`;
}

function flightCard(f) {
  const graphic = flightPathHTML(f) ?? (f.chain ? chainPathHTML(f.chain, "2 bookings") : null);
  const meta = [f.dep && f.arr ? `${f.dep}–${f.arr}` : f.dep, f.dur, !graphic ? f.via : null, !graphic ? f.flightNos : null].filter(Boolean).join(" · ");
  const notes = [
    f.flags?.selfTransfer ? `Two separate tickets — collect bags and re-check${f.flags.layover ? ` (${f.flags.layover} connection)` : ""}.` : null,
    f.flags?.twoBookings ? "Booked as two separate award tickets." : null,
    f.flags?.est ? "Estimated price — confirm before booking." : null,
  ].filter(Boolean);
  return `<section class="sh-card sh-flight">
    <div class="sh-row">
      <div>
        <div class="sh-eyebrow">${esc(f.dir)}${f.date ? ` · ${esc(day(f.date))}` : ""}</div>
        <div class="sh-route">${esc(f.from)} → ${esc(f.to)}</div>
        <div class="sh-sub">${esc([f.airline, f.cabin].filter(Boolean).join(" · "))}</div>
      </div>
      <div class="sh-price">${esc(payText(f.pay))}</div>
    </div>
    ${graphic ?? ""}
    ${meta ? `<div class="sh-meta">${esc(meta)}</div>` : ""}
    ${notes.map((n) => `<div class="sh-note">${esc(n)}</div>`).join("")}
  </section>`;
}

function hotelCard(h) {
  const stars = h.stars > 0 ? "★".repeat(Math.min(h.stars, 5)) : "";
  return `<section class="sh-card">
    <div class="sh-row">
      <div>
        <div class="sh-eyebrow">${esc(h.city)} · ${esc(h.nights)} night${h.nights === 1 ? "" : "s"}${h.checkIn ? ` · ${esc(day(h.checkIn))} → ${esc(day(h.checkOut))}` : ""}</div>
        <div class="sh-route sh-hotel">${esc(h.name)}</div>
        <div class="sh-sub">${stars ? `<span class="sh-stars">${stars}</span>` : ""}${h.rating != null ? ` ${esc(h.rating)}/10 guest rating` : ""}</div>
      </div>
      <div class="sh-price">${esc(payText(h.pay))}</div>
    </div>
    ${h.flags?.testRate ? `<div class="sh-note">Test rate — not a real price.</div>` : ""}
  </section>`;
}

const ICON = { flight: "Flight", train: "Rail", hotel: "Stay" };
function dayBlock(d) {
  return `<div class="sh-day">
    <div class="sh-daynum"><span>Day</span><b>${esc(d.day)}</b>${d.date ? `<i>${esc(day(d.date))}</i>` : ""}</div>
    <div class="sh-daybody">
      <div class="sh-daytitle">${esc(d.title)}</div>
      ${(d.items ?? []).map((it) => `<div class="sh-item"><span class="sh-tag sh-tag-${esc(it.icon)}">${esc(ICON[it.icon] ?? "See")}</span><span class="sh-t">${esc(it.t)}</span><span>${esc(it.n)}</span></div>`).join("")}
    </div>
  </div>`;
}

function costs(c) {
  const groups = ["Flights", "Hotels", "Ground"];
  const lines = groups.flatMap((g) => c.lines.filter((l) => l.group === g)).map((l) => `
    <div class="sh-line">
      <div><div>${esc(l.label)}${l.est ? ' <em>est.</em>' : ""}${l.test ? " <em>test rate</em>" : ""}</div>${l.sub ? `<div class="sh-sub">${esc(l.sub)}</div>` : ""}</div>
      <div class="sh-val">${esc(l.value)}</div>
    </div>`).join("");
  const pts = (c.pointsUsed ?? []).map((p) => `${esc(kpts(p.points))} ${esc(p.source)}`).join(" · ");
  return `<section class="sh-card sh-costs">${lines}
    <div class="sh-total"><span>Cash out of pocket</span><b>${esc(usd(c.cash))}</b></div>
    ${pts ? `<div class="sh-total"><span>Points used</span><b>${pts}</b></div>` : ""}
    ${c.retail > c.cash ? `<div class="sh-total sh-save"><span>Points save</span><b>${esc(usd(c.retail - c.cash))}</b></div>` : ""}
  </section>`;
}

function render(s) {
  const nights = (s.stops ?? []).reduce((a, x) => a + (x.nights ?? 0), 0);
  const ptsTotal = (s.costs?.pointsUsed ?? []).reduce((a, p) => a + p.points, 0);
  document.title = `${s.title} · Meridian`;
  root.innerHTML = `
    <header class="sh-head">
      <div class="sh-kick">Meridian · Itinerary</div>
      <h1>${esc(s.title)}</h1>
      <div class="sh-dates">${esc(day(s.departDate))}${s.returnDate ? ` – ${esc(day(s.returnDate))}` : ""} · ${esc(nights)} nights${s.cabin ? ` · ${esc(s.cabin)}` : ""}${s.openJaw ? " · open jaw" : ""}</div>
      <div class="sh-actions">
        <button id="shPrint" type="button">Print / save PDF</button>
        <a href="/">Plan your own on Meridian ↗</a>
      </div>
      <div class="sh-tiles">
        <div><span>Cash out of pocket</span><b>${esc(usd(s.costs?.cash))}</b></div>
        <div><span>Points used</span><b>${ptsTotal ? esc(kpts(ptsTotal)) : "—"}</b></div>
        <div><span>Stops</span><b>${esc((s.stops ?? []).length)}</b></div>
        <div><span>Nights</span><b>${esc(nights)}</b></div>
      </div>
    </header>
    <h2>Flights</h2>
    ${(s.flights ?? []).map(flightCard).join("")}
    <h2>Stays</h2>
    ${(s.hotels ?? []).map(hotelCard).join("")}
    <h2>Day by day</h2>
    <section class="sh-days">${(s.days ?? []).map(dayBlock).join("")}</section>
    <h2>Costs</h2>
    ${s.costs ? costs(s.costs) : ""}
    <footer class="sh-foot">
      Priced ${s.sharedAt ? esc(day(s.sharedAt.slice(0, 10))) : ""} — fares, hotel rates and award space change constantly.
      Confirm prices and availability before booking or transferring points; transfers are one-way.
      <br />Planned with <a href="/">Meridian</a>.
    </footer>`;
  document.getElementById("shPrint").onclick = () => window.print();
  if (params.get("print") === "1") {
    (document.fonts?.ready ?? Promise.resolve()).then(() => setTimeout(() => window.print(), 300));
  }
}

function fail(msg) {
  root.innerHTML = `<header class="sh-head"><div class="sh-kick">Meridian</div><h1>Itinerary not found</h1>
    <p class="sh-dates">${esc(msg)}</p><div class="sh-actions"><a href="/">Plan a trip on Meridian ↗</a></div></header>`;
}

const id = params.get("id");
if (!id) fail("This link is missing its itinerary id.");
else loadShare(id).then(({ data, error }) => {
  if (error || !data || data.v !== 1) fail(error?.includes("404") ? "This shared itinerary doesn't exist or has expired." : `Couldn't load it right now (${error ?? "unknown format"}).`);
  else render(data);
});
