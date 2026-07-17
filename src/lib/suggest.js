/**
 * Destination suggestions for the builder. Given the primary destination,
 * surface major cities (tier 1/2) in the same country first, then nearby
 * countries — each with the ground time/cost of adding it to the route.
 * Smaller towns aren't suggested (the search box geocodes those on demand).
 */
import { WORLD, cityById } from "../data/world.js";
import { km } from "./geo.js";
import { edgeFor } from "./optimizer.js";
import { hm, usd } from "./trip.js";

const NEARBY_KM = 900;

export function suggestCities(destIds, originId, max = 6) {
  if (!destIds.length) return [];
  const primary = cityById[destIds[0]];
  const skip = new Set([...destIds, originId]);

  return WORLD
    .filter((c) => !skip.has(c.id) && !c.custom)
    .map((c) => ({ c, d: km(primary, c), same: c.country === primary.country }))
    .filter((x) => x.same || x.d < NEARBY_KM)
    .sort((a, b) => (a.same === b.same ? a.d - b.d : a.same ? -1 : 1))
    .slice(0, max)
    .map(({ c, d, same }) => {
      const e = edgeFor(primary.id, c.id);
      return {
        city: c,
        distKm: Math.round(d),
        why: same
          ? `${Math.round(d)} km from ${primary.name} — a natural ${c.country} pairing.`
          : `${Math.round(d)} km away in ${c.country} — an easy add to the arc.`,
        add: `+${hm(e.min)} · ≈${usd(e.usd)} ${e.mode === "rail" ? "ground" : "flight"}`,
      };
    });
}
