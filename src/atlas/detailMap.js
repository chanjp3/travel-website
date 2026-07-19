/**
 * Street-level detail layer for the city-guide tour. The Meridian SVG atlas
 * stays the stage for world/country phases; when the tour zooms into a city
 * this MapLibre map (OpenFreeMap tiles — keyless) cross-fades in on top,
 * sepia-tinted to sit inside the parchment palette.
 *
 * It's a live search surface: panning/zooming reports the visible area
 * (center + radius) via onViewChange so hotels re-query for what's on
 * screen; hotel pins are clickable (prefer/unprefer) and the city's main
 * attractions pin at their real geocoded spots. Fails soft: if tiles can't
 * load, the layer never shows and the atlas covers. Swap STYLE for a
 * Mapbox style URL + accessToken for Mapbox Studio styling — same engine.
 */
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const STYLE = "https://tiles.openfreemap.org/styles/positron";

let map = null, holder = null, markers = [], failed = false;
let onFailCb = null, onViewCb = null, onPinCb = null;
let skipNextMove = false, lastView = null;

function viewArea() {
  const c = map.getCenter();
  const b = map.getBounds();
  const mLat = (b.getNorth() - b.getSouth()) * 111000 / 2;
  const mLon = (b.getEast() - b.getWest()) * 111000 * Math.cos((c.lat * Math.PI) / 180) / 2;
  return { lat: c.lat, lon: c.lng, radius: Math.min(30000, Math.max(1500, Math.round(Math.max(mLat, mLon) * 0.85))) };
}

export function showDetailMap(container, {
  lat, lon, zoom = 12.6, pins = [], attrs = [], nights = 1,
  selected = null, fly = true,
  onFail, onViewChange, onPinClick,
} = {}) {
  onFailCb = onFail ?? onFailCb;
  onViewCb = onViewChange ?? onViewCb;
  onPinCb = onPinClick ?? onPinCb;
  if (failed) return false;

  if (!holder) {
    holder = document.createElement("div");
    holder.className = "detail-map";
    container.appendChild(holder);
    try {
      map = new maplibregl.Map({
        container: holder,
        style: STYLE,
        center: [lon, lat],
        zoom,
        attributionControl: { compact: true },
      });
      map.on("error", () => {
        if (map && !map.isStyleLoaded()) { failed = true; hideDetailMap(); onFailCb?.(); }
      });
      let t = null;
      map.on("moveend", () => {
        if (skipNextMove) { skipNextMove = false; lastView = viewArea(); return; }
        clearTimeout(t);
        t = setTimeout(() => {
          const v = viewArea();
          // only re-search when the view meaningfully changed
          if (lastView) {
            const moved = Math.hypot(v.lat - lastView.lat, (v.lon - lastView.lon) * Math.cos((v.lat * Math.PI) / 180)) * 111000;
            if (moved < lastView.radius * 0.2 && Math.abs(v.radius - lastView.radius) < lastView.radius * 0.25) return;
          }
          lastView = v;
          onViewCb?.(v);
        }, 550);
      });
    } catch {
      failed = true;
      return false;
    }
  }
  holder.classList.add("show");
  map.resize();
  if (fly) {
    skipNextMove = true;
    map.flyTo({ center: [lon, lat], zoom, duration: 1400, essential: true });
  }

  markers.forEach((m) => m.remove());
  markers = [];
  attrs
    .filter((a) => a.lat != null && a.lon != null)
    .forEach((a) => {
      const el = document.createElement("div");
      el.className = "dm-attr";
      el.innerHTML = `<span class="dm-diamond"></span><span class="dm-attr-name">${a.name}</span>`;
      markers.push(new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([a.lon, a.lat]).addTo(map));
    });
  pins
    .filter((p) => p.lat != null && p.lon != null)
    .forEach((p) => {
      const el = document.createElement("div");
      el.className = "dm-pin" + (selected === p.name ? " dm-sel" : "");
      el.innerHTML = `<span class="dm-dot"></span><span class="dm-price">$${Math.round(p.price / Math.max(nights, 1))}</span>`;
      el.addEventListener("click", (e) => { e.stopPropagation(); onPinCb?.(p); });
      markers.push(new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([p.lon, p.lat]).addTo(map));
    });
  return true;
}

export function hideDetailMap() {
  holder?.classList.remove("show");
  lastView = null;
}

export function destroyDetailMap() {
  markers.forEach((m) => m.remove());
  markers = [];
  map?.remove();
  map = null;
  holder?.remove();
  holder = null;
  failed = false;
  onFailCb = onViewCb = onPinCb = null;
  lastView = null;
}
