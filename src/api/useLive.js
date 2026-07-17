/**
 * React hooks over the API client. Each returns estimate-friendly nulls
 * when live mode is off or a fetch fails — callers merge with mergeLive*.
 */
import { useEffect, useState } from "react";
import { liveFlights, liveHotels, liveMode } from "./client.js";
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
        const c = cityById[cid];
        out[cid] = await liveHotels(c.cc ?? c.air, checkIn, checkOut);
        if (!on) return;
        setMap({ ...out });
      }
    })();
    return () => { on = false; };
  }, [key]);
  return map;
}
