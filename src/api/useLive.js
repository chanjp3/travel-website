/**
 * React hooks over the API client. Each returns estimate-friendly nulls
 * when live mode is off or a fetch fails — callers merge with mergeLive*.
 */
import { useEffect, useState } from "react";
import { liveFlights, liveHotels, liveAwards, liveMode } from "./client.js";
import { cityById } from "../data/world.js";

export function useLiveLeg(fromAir, toAir, date, cabin) {
  const [state, set] = useState({ offers: null, loading: false });
  useEffect(() => {
    if (!liveMode() || !fromAir || !toAir || !date) {
      set({ offers: null, loading: false });
      return;
    }
    let on = true;
    set({ offers: null, loading: true });
    liveFlights(fromAir, toAir, date, cabin).then(
      (offers) => on && set({ offers, loading: false })
    );
    return () => { on = false; };
  }, [fromAir, toAir, date, cabin]);
  return state;
}

/** Seats.aero award space for a leg. `rows: null` = not configured/failed
 *  (keep chart estimates); `rows: []` = searched, nothing bookable. */
export function useLiveAwards(fromAir, toAir, date) {
  const [state, set] = useState({ rows: null, loading: false });
  useEffect(() => {
    if (!liveMode() || !fromAir || !toAir || !date) {
      set({ rows: null, loading: false });
      return;
    }
    let on = true;
    set({ rows: null, loading: true });
    liveAwards(fromAir, toAir, date).then(
      (rows) => on && set({ rows: Array.isArray(rows) ? rows : null, loading: false })
    );
    return () => { on = false; };
  }, [fromAir, toAir, date]);
  return state;
}

/** Live hotel offers for every stop, keyed by city id. Fetches sequentially
 *  to stay inside Amadeus free-tier rate limits. */
export function useLiveHotelsMap(schedule) {
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
  }, [key]);
  return map;
}
