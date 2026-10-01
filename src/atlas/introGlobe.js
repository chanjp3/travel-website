/**
 * Intro globe — a slowly turning WebGL globe with gold flight arcs,
 * adapted from "Globe Flights" (cobe) by shuding, via 21st.dev:
 * https://21st.dev/@shuding/components/cobe-globe-flights
 * Vanilla so it can live inside the imperative intake. Drag to spin.
 * Returns a stop() that tears it down; fails soft where WebGL is missing.
 */
import createGlobe from "cobe";

const ARCS = [
  { from: [27.98, -82.53], to: [51.47, -0.46] },   // Tampa → London
  { from: [51.47, -0.46], to: [49.01, 2.55] },     // London → Paris
  { from: [27.98, -82.53], to: [35.55, 139.78] },  // Tampa → Tokyo
  { from: [40.64, -73.78], to: [41.8, 12.25] },    // New York → Rome
  { from: [33.94, -118.41], to: [-33.95, 151.18] },// Los Angeles → Sydney
  { from: [49.01, 2.55], to: [25.25, 55.36] },     // Paris → Dubai
];
const MARKERS = [...new Set(ARCS.flatMap((a) => [a.from.join(), a.to.join()]))]
  .map((k) => ({ location: k.split(",").map(Number), size: 0.035 }));

export function mountIntroGlobe(canvas) {
  if (!canvas) return () => {};
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let globe = null, raf = 0, phi = 4.6, drag = null, dragPhi = 0, stopped = false;
  const onDown = (e) => { drag = e.clientX; canvas.style.cursor = "grabbing"; };
  const onMove = (e) => { if (drag != null) { dragPhi += (e.clientX - drag) / 220; drag = e.clientX; } };
  const onUp = () => { drag = null; canvas.style.cursor = "grab"; };
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  try {
    const w = canvas.offsetWidth || 900;
    globe = createGlobe(canvas, {
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      width: w, height: w, phi, theta: 0.32,
      dark: 0, diffuse: 1.1, mapSamples: 18000, mapBrightness: 5.5,
      baseColor: [0.97, 0.95, 0.91],      // ivory
      markerColor: [0.54, 0.42, 0.18],    // champagne gold
      glowColor: [0.96, 0.93, 0.88],
      markers: MARKERS,
      arcs: ARCS,
      arcColor: [0.62, 0.48, 0.22],
      arcWidth: 0.7, arcHeight: 0.3, opacity: 0.85,
    });
    const tick = () => {
      if (stopped) return;
      if (!reduced && drag == null) phi += 0.0022;
      globe.update({ phi: phi + dragPhi, theta: 0.32 });
      raf = requestAnimationFrame(tick);
    };
    tick();
    requestAnimationFrame(() => { canvas.style.opacity = "1"; });
  } catch {
    canvas.style.display = "none"; // no WebGL — the intro still works without it
  }
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    canvas.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    try { globe?.destroy(); } catch { /* already gone */ }
  };
}
