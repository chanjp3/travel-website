/**
 * React hooks over the API client. Each returns estimate-friendly nulls
 * when live mode is off or a fetch fails — callers merge with mergeLive*.
 */
import { useEffect, useState } from "react";
import { liveFlights, liveHubPlans, liveHotels, liveAwards, liveMode } from "./client.js";
import { cityById } from "../data/world.js";

/** `ret` (return date) lets the worker fall back to the much richer
 *  round-trip fare cache — pass it only for the outbound leg of a true
 *  round trip (same airports both ways). */
export function useLiveLeg(fromAir, toAir, date, cabin, ret = null, viaHub = null, tick = 0, minLay = null) {
  const [state, set] = useState({ offers: null, loading: false, at: null, hubs: false });
  useEffect(() => {
    if (!liveMode() || !fromAir || !toAir || !date) {
      set({ offers: null, loading: false, hubs: false });
      return;
    }
    let on = true;
    set({ offers: null, loading: true, hubs: false });
    liveFlights(fromAir, toAir, date, cabin, ret, viaHub, { minLay }).then((offers) => {
      if (!on) return;
      // Main results first; the separate-ticket plans (several live
      // searches) follow in a second request and merge in when they land.
      const more = !!offers?.length;
      set({ offers, loading: false, at: Date.now(), hubs: more });
      if (!more) return;
      liveHubPlans(fromAir, toAir, date, cabin, viaHub, { minLay }).then((plans) => {
        if (!on) return;
        set((s) => ({ ...s, hubs: false, offers: Array.isArray(plans) && plans.length ? [...(s.offers ?? []), ...plans] : s.offers }));
      });
    });
    return () => { on = false; };
  }, [fromAir, toAir, date, cabin, ret, viaHub, tick, minLay]);
  return state;
}

/** Seats.aero award space for a leg. `rows: null` = not configured/failed
 *  (keep chart estimates); `rows: []` = searched, nothing bookable.
 *  `cabin` makes the worker escalate when the chosen cabin has no cached
 *  space; bump `tick` to re-fetch (e.g. after a seats.aero live search). */
export function useLiveAwards(fromAir, toAir, date, cabin = null, tick = 0) {
  const [state, set] = useState({ rows: null, loading: false });
  useEffect(() => {
    if (!liveMode() || !fromAir || !toAir || !date) {
      set({ rows: null, loading: false });
      return;
    }
    let on = true;
    set({ rows: null, loading: true });
    liveAwards(fromAir, toAir, date, cabin).then(
      (rows) => on && set({ rows: Array.isArray(rows) ? rows : null, loading: false })
    );
    return () => { on = false; };
  }, [fromAir, toAir, date, cabin, tick]);
  return state;
}

/** Live hotel offers for every stop, keyed by city id. Fetches sequentially
 *  to stay inside Amadeus free-tier rate limits. */
export function useLiveHotelsMap(schedule, tick = 0) {
  const [map, setMap] = useState({});
  const key = schedule ? schedule.cities.map((c) => `${c.cid}:${c.checkIn}`).join("|") : "";
  useEffect(() => {
    if (!liveMode() || !schedule) { setMap({}); return; }
    let on = true;
    setMap({});
    (async () => {
      const out = {};
      for (const { cid, checkIn, checkOut } of schedule.cities) {
        out[cid] = await liveHotels(cityById[cid], checkIn, checkOut);
        if (!on) return;
        setMap({ ...out });
      }
    })();
    return () => { on = false; };
  }, [key, tick]);
  return map;
}
