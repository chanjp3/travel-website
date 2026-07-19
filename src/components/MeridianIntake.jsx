import React, { useEffect, useRef } from "react";
import { mountMeridian } from "../atlas/meridianIntake.js";

/** React shell around the d3-driven Meridian map intake. */
export function MeridianIntake({ initialDate, onComplete }) {
  const holder = useRef(null);
  const cb = useRef(onComplete);
  cb.current = onComplete;

  useEffect(() => {
    return mountMeridian(holder.current, {
      initialDate,
      onComplete: (trip) => cb.current?.(trip),
    });
  }, []);

  return <div ref={holder} className="meridian" />;
}
