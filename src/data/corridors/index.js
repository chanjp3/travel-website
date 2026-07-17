/**
 * Corridor packs: deep ground-transport + hotel + attraction data for
 * regions we've encoded. The optimizer asks packs for rail edges first
 * and falls back to flight estimates everywhere else.
 */
import { japan } from "./japan.js";
import { europe } from "./europe.js";

const PACKS = { japan, europe };

export function railEdge(aId, bId) {
  for (const p of Object.values(PACKS)) {
    const e = p.edge(aId, bId);
    if (e) return { ...e, mode: "rail", pack: p.id };
  }
  return null;
}
export const packFor = (cityId) =>
  Object.values(PACKS).find((p) => p.cities.includes(cityId)) ?? null;
export const packById = (id) => PACKS[id] ?? null;
