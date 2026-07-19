import React, { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { T } from "../theme.js";

/**
 * Full-screen MapLibre canvas the trip wizard plays out on.
 * Tiles come from OpenFreeMap (free, keyless). If the style can't load
 * (offline, blocked), we fall back to a plain paper-toned canvas — every
 * marker and route line still works, so the wizard never breaks.
 */
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const FALLBACK_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#E7EAE2" } }],
};

export const MapStage = forwardRef(function MapStage({ markers = [], route = [], onMapClick }, ref) {
  const holder = useRef(null);
  const mapRef = useRef(null);
  const domMarkers = useRef([]);
  const clickCb = useRef(onMapClick);
  clickCb.current = onMapClick;

  useEffect(() => {
    const map = new maplibregl.Map({
      container: holder.current,
      style: STYLE_URL,
      center: [-40, 28],
      zoom: 1.7,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    let fellBack = false;
    map.on("error", () => {
      // style/tile fetch failed → paper fallback, wizard stays functional
      if (!fellBack && !map.isStyleLoaded()) { fellBack = true; map.setStyle(FALLBACK_STYLE); }
    });
    map.on("click", (e) => clickCb.current?.(e.lngLat, map.getZoom()));
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    return () => map.remove();
  }, []);

  // ── markers: plain DOM pins, restyled per kind ──
  useEffect(() => {
    domMarkers.current.forEach((m) => m.remove());
    domMarkers.current = markers.map((mk) => {
      const el = document.createElement("div");
      el.className = `map-pin map-pin-${mk.kind ?? "stop"}`;
      el.innerHTML = mk.html ?? "";
      if (mk.onClick) {
        el.style.cursor = "pointer";
        el.addEventListener("click", (e) => { e.stopPropagation(); mk.onClick(); });
      }
      return new maplibregl.Marker({ element: el, anchor: mk.anchor ?? "center" })
        .setLngLat([mk.lon, mk.lat])
        .addTo(mapRef.current);
    });
  }, [markers]);

  // ── trip route lines: solid ground, dashed flight ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const draw = () => {
      const mk = (mode) => ({
        type: "FeatureCollection",
        features: route
          .filter((l) => l.mode === mode)
          .map((l) => ({ type: "Feature", geometry: { type: "LineString", coordinates: [[l.from[1], l.from[0]], [l.to[1], l.to[0]]] } })),
      });
      for (const [id, mode, paint] of [
        ["trip-ground", "ground", { "line-color": T.rail, "line-width": 3.5 }],
        ["trip-flight", "flight", { "line-color": T.flight, "line-width": 2.5, "line-dasharray": [1.4, 1.6] }],
      ]) {
        const data = mk(mode);
        if (map.getSource(id)) map.getSource(id).setData(data);
        else {
          map.addSource(id, { type: "geojson", data });
          map.addLayer({ id, type: "line", source: id, layout: { "line-cap": "round" }, paint });
        }
      }
    };
    if (map.isStyleLoaded()) draw();
    else map.once("styledata", draw);
  }, [route]);

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lon, zoom) => mapRef.current?.flyTo({ center: [lon, lat], zoom, duration: 1600, essential: true }),
    fitTo: (pts, pad = 90) => {
      if (!pts.length || !mapRef.current) return;
      const b = new maplibregl.LngLatBounds();
      pts.forEach((p) => b.extend([p.lon, p.lat]));
      mapRef.current.fitBounds(b, { padding: pad, duration: 1600, maxZoom: 9 });
    },
  }));

  return <div ref={holder} className="absolute inset-0" />;
});
