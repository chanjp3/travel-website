/**
 * Trip calendar — turns a departure date + route + nights into concrete
 * per-city check-in/check-out dates and the return-flight date. All dates
 * are ISO strings (YYYY-MM-DD) handled at UTC noon to dodge TZ edges.
 */
export const toISO = (d) => d.toISOString().slice(0, 10);

export function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

export const fmtShort = (iso) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export const fmtDay = (iso) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** Default departure: two months out — far enough for award space and sane fares. */
export function defaultDepart() {
  const d = new Date();
  d.setDate(d.getDate() + 60);
  return toISO(d);
}

/**
 * Full schedule for a chosen route.
 * `outboundMin` (long-haul block time) decides whether arrival lands next
 * day — >8h eastbound legs essentially always do once TZ/date line hit.
 */
export function buildSchedule(route, nights, departISO, outboundMin) {
  if (!route || !departISO) return null;
  const lag = outboundMin != null && outboundMin > 480 ? 1 : 0;
  let cursor = addDays(departISO, lag);
  const cities = route.order.map((cid) => {
    const n = nights[cid] ?? 2;
    const seg = { cid, checkIn: cursor, checkOut: addDays(cursor, n), nights: n };
    cursor = seg.checkOut;
    return seg;
  });
  return {
    depart: departISO,
    arrive: cities[0].checkIn,
    cities,
    byCity: Object.fromEntries(cities.map((c) => [c.cid, c])),
    returnDate: cursor,
    lag,
  };
}

/** Calendar date for the Nth itinerary day (1-based, matching buildDays). */
export function dateForDay(schedule, dayNum) {
  if (!schedule) return null;
  if (dayNum <= 1) return schedule.depart;
  return addDays(schedule.depart, schedule.lag + dayNum - 2);
}
