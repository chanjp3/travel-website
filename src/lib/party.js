/**
 * Who is travelling, and what that does to prices. Live searches are run
 * for one adult (cache- and quota-friendly, and unambiguous), then scaled
 * here: every paying seat pays the fare, lap infants ~10% of it on
 * international tickets, hotels need a room per two adults, and award
 * seats are per person.
 */
export const DEFAULT_PAX = { adults: 1, children: 0, infants: 0 };

export const seatsOf = (p) => (p?.adults ?? 1) + (p?.children ?? 0);
export const peopleOf = (p) => seatsOf(p) + (p?.infants ?? 0);
export const roomsOf = (p) => Math.max(1, Math.ceil((p?.adults ?? 1) / 2));

/** Whole-party cash fare from a one-adult fare. */
export const partyFare = (fare, p, { domestic = false } = {}) =>
  fare == null ? null : Math.round(fare * seatsOf(p) + (domestic ? 0 : fare * 0.1 * (p?.infants ?? 0)));

export function paxText(p) {
  const parts = [];
  const a = p?.adults ?? 1, c = p?.children ?? 0, i = p?.infants ?? 0;
  parts.push(`${a} adult${a !== 1 ? "s" : ""}`);
  if (c) parts.push(`${c} child${c !== 1 ? "ren" : ""}`);
  if (i) parts.push(`${i} infant${i !== 1 ? "s" : ""}`);
  return parts.join(", ");
}
