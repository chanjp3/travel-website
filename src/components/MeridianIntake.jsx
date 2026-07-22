import React, { useEffect, useRef } from "react";
import { mountMeridian } from "../atlas/meridianIntake.js";

/** React shell around the d3-driven Meridian map intake. */
export function MeridianIntake({ initialDate, onComplete, balances, hidden = false }) {
  const holder = useRef(null);
  const cb = useRef(onComplete);
  cb.current = onComplete;
  const bal = useRef(balances);
  bal.current = balances;

  useEffect(() => {
    return mountMeridian(holder.current, {
      initialDate,
      onComplete: (trip) => cb.current?.(trip),
      getBalances: () => bal.current,
    });
  }, []);

  return <div ref={holder} className="meridian" style={{ display: hidden ? "none" : undefined }} />;
}
