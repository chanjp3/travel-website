/**
 * Trip persistence. Local: autosave + named saves in localStorage (resume on
 * this device). Cloud: the worker stores a snapshot in KV under a short sync
 * code — write it down, load anywhere. Full account login (Google OAuth) is
 * a planned upgrade; sync codes need no credentials.
 */
import { cityById, registerCity } from "../data/world.js";

const LS_AUTO = "meridian.autosave";
const LS_SAVES = "meridian.saves";

export function serializeTrip(s) {
  return {
    v: 1,
    savedAt: new Date().toISOString(),
    label: `${cityById[s.originId]?.name ?? "?"} → ${s.destIds.map((d) => cityById[d]?.name).filter(Boolean).join(" → ")}`,
    originId: s.originId,
    cities: [s.originId, ...s.destIds].map((id) => cityById[id]).filter(Boolean),
    departDate: s.departDate,
    destIds: s.destIds,
    nights: s.nights,
    startAt: s.startAt, endAt: s.endAt,
    originAir: s.originAir, homeAir: s.homeAir,
    inGw: s.inGw, outGw: s.outGw,
    hotelPicks: s.hotelPicks, hotelPrefs: s.hotelPrefs,
    cabinPref: s.cabinPref, pointsOnly: s.pointsOnly, wCost: s.wCost,
    balances: s.balances,
  };
}

/** Re-register any custom towns so cityById lookups work, then return data. */
export function hydrateTrip(data) {
  if (!data || data.v !== 1) return null;
  (data.cities ?? []).forEach((c) => { if (c?.custom) registerCity(c); });
  if ((data.cities ?? []).some((c) => c && !cityById[c.id])) (data.cities ?? []).forEach((c) => c && registerCity(c));
  return data;
}

export const tripLocal = {
  autosave(data) { try { localStorage.setItem(LS_AUTO, JSON.stringify(data)); } catch { /* full/blocked */ } },
  loadAuto() { try { return hydrateTrip(JSON.parse(localStorage.getItem(LS_AUTO))); } catch { return null; } },
  list() { try { return JSON.parse(localStorage.getItem(LS_SAVES)) ?? []; } catch { return []; } },
  save(name, data) {
    const all = tripLocal.list().filter((t) => t.name !== name);
    all.unshift({ name, data });
    try { localStorage.setItem(LS_SAVES, JSON.stringify(all.slice(0, 20))); } catch { /* ignore */ }
  },
  load(name) { return hydrateTrip(tripLocal.list().find((t) => t.name === name)?.data ?? null); },
  remove(name) {
    try { localStorage.setItem(LS_SAVES, JSON.stringify(tripLocal.list().filter((t) => t.name !== name))); } catch { /* ignore */ }
  },
};
