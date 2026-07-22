/**
 * Flight-path graphic — the routing drawn as an airline-style timeline:
 *
 *   08:00          AS37             SEA          AS108          15:30 +1
 *   TPA    ━━━━━━━━✈━━━━━━━━ 5h45m  ●  2h45m ━━━━✈━━━━━━━━━━   NRT
 *
 * Rendered from a row's segs[]: endpoint times/codes, one glowing line
 * per segment (length proportional to duration when computable), and a
 * silver connection node with the layover between segments. Returns an
 * HTML string so the React desk and the vanilla intake share one look.
 */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));
const timeOf = (ts) => (ts ? String(ts).slice(11, 16) : null);
const dayOf = (ts) => (ts ? String(ts).slice(0, 10) : null);
const hasOffset = (ts) => /(?:[+-]\d{2}:?\d{2}|Z)$/.test(String(ts ?? ""));
const hm = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`);

/** Absolute minutes between two stamps — only when both carry offsets
 *  (wall-clock math across timezones lies). */
const absMin = (a, b) => {
  if (!a || !b || !hasOffset(a) || !hasOffset(b)) return null;
  const d = Date.parse(b) - Date.parse(a);
  return Number.isFinite(d) && d > 0 && d < 48 * 3600000 ? Math.round(d / 60000) : null;
};

export function flightPathHTML(f) {
  const segs = f?.segs;
  if (!segs?.length || !segs[0].dep) return null;
  const parts = [];
  const depDay = dayOf(segs[0].dep);
  const lastArr = segs[segs.length - 1].arr;
  const plusDays = depDay && dayOf(lastArr) && dayOf(lastArr) > depDay ? "+1" : "";

  parts.push(`<div class="fp-end">
    <div class="fp-time">${esc(timeOf(segs[0].dep) ?? "—")}</div>
    <div class="fp-code">${esc(segs[0].from)}</div>
  </div>`);

  segs.forEach((s, i) => {
    if (i > 0) {
      const lay = absMin(segs[i - 1].arr, s.dep);
      parts.push(`<div class="fp-stop">
        <div class="fp-dot"></div>
        <div class="fp-code">${esc(s.from)}</div>
        ${lay != null ? `<div class="fp-lay">${hm(lay)}</div>` : ""}
      </div>`);
    }
    const dur = absMin(s.dep, s.arr);
    parts.push(`<div class="fp-seg" style="flex-grow:${dur ?? 100}">
      <div class="fp-no">${esc(`${s.carrier ?? ""}${s.num ?? ""}`)}</div>
      <div class="fp-line"><span class="fp-plane">✈</span></div>
      ${dur != null ? `<div class="fp-dur">${hm(dur)}</div>` : ""}
    </div>`);
  });

  parts.push(`<div class="fp-end">
    <div class="fp-time">${esc(timeOf(lastArr) ?? "—")}${plusDays ? `<span class="fp-plus">${plusDays}</span>` : ""}</div>
    <div class="fp-code">${esc(segs[segs.length - 1].to)}</div>
  </div>`);

  return `<div class="fp">${parts.join("")}</div>`;
}
