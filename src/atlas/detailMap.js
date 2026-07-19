/**
 * Street-level detail layer for the city-guide tour. The Meridian SVG atlas
 * stays the stage for world/country phases; when the tour zooms into a city
 * this MapLibre map (OpenFreeMap tiles — keyless) cross-fades in on top,
 * sepia-tinted to sit inside the parchment palette, with hotel price pins
 * on their real streets. Fails soft: if tiles can't load, the atlas simply
 * stays visible. Swap STYLE for a Mapbox style URL + accessToken if you
 * ever want Mapbox Studio styling — same engine.
 */
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const STYLE = "https://tiles.openfreemap.org/styles/positron";

let map = null, holder = null, markers = [], failed = false, onFailCb = null;

export function showDetailMap(container, { lat, lon, zoom = 12.6, pins = [], nights = 1, onFail } = {}) {
  onFailCb = onFail ?? onFailCb;
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
    } catch {
      failed = true;
      return false;
    }
  }
  holder.classList.add("show");
  map.resize();
  map.flyTo({ center: [lon, lat], zoom, duration: 1400, essential: true });
  markers.forEach((m) => m.remove());
  markers = pins
    .filter((p) => p.lat != null && p.lon != null)
    .map((p) => {
      const el = document.createElement("div");
      el.className = "dm-pin";
      el.innerHTML = `<span class="dm-dot"></span><span class="dm-price">$${Math.round(p.price / Math.max(nights, 1))}</span>`;
      return new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([p.lon, p.lat]).addTo(map);
    });
  return true;
}

export function hideDetailMap() {
  holder?.classList.remove("show");
}

export function destroyDetailMap() {
  markers.forEach((m) => m.remove());
  markers = [];
  map?.remove();
  map = null;
  holder?.remove();
  holder = null;
  failed = false;
}
