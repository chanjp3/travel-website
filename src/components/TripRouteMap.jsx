import { Component, useMemo } from "react";
import * as topojson from "topojson-client";
import { WORLD } from "../data/atlas/worldTopo.js";
import { Map, FlightMultiRoute, getAirportInfo } from "./ui/flightcn.tsx";
import { T } from "../theme.js";

/**
 * Animated great-circle map of the trip's long-haul legs (flightcn).
 * Uses a self-contained ivory style built from the bundled country
 * outlines — no third-party tiles, so it matches the palette and still
 * renders where tile hosts are blocked. Legs whose airports flightcn
 * doesn't know are simply left off.
 */
let ivory;
function ivoryStyle() {
  if (ivory) return ivory;
  const all = topojson.feature(WORLD, WORLD.objects.countries);
  // Rings that jump straight from +180° to −180° (Russia's far east, Fiji…)
  // get drawn the long way round and flood the sea with land colour.
  // Unwrap them so longitudes run continuously across the date line.
  const unwrap = (ring) => {
    let shift = 0;
    return ring.map(([lon, lat], i) => {
      if (i) {
        const prev = ring[i - 1][0];
        if (lon - prev > 180) shift -= 360;
        else if (lon - prev < -180) shift += 360;
      }
      return [lon + shift, lat];
    });
  };
  const fix = (g) =>
    g.type === "Polygon" ? { ...g, coordinates: g.coordinates.map(unwrap) }
    : g.type === "MultiPolygon" ? { ...g, coordinates: g.coordinates.map((p) => p.map(unwrap)) }
    : g;
  const land = {
    ...all,
    // Antarctica wraps the pole itself; a trip map never needs it.
    features: all.features.filter((f) => f.properties?.name !== "Antarctica").map((f) => ({ ...f, geometry: fix(f.geometry) })),
  };
  ivory = {
    version: 8,
    sources: { land: { type: "geojson", data: land } },
    layers: [
      { id: "sea", type: "background", paint: { "background-color": T.paper } },
      { id: "land", type: "fill", source: "land", paint: { "fill-color": "#E6DDCE" } },
      { id: "borders", type: "line", source: "land", paint: { "line-color": "#C9BDAA", "line-width": 0.6 } },
    ],
  };
  return ivory;
}

const hasWebGL = (() => {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
})();

/** The map is a garnish — if it fails, the page must not. */
class Quiet extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function TripRouteMap(props) {
  if (!hasWebGL) return null;
  return <Quiet><RouteMap {...props} /></Quiet>;
}

function RouteMap({ legs, height = 340 }) {
  const known = (legs ?? []).filter((l) => l.from && l.to && getAirportInfo(l.from) && getAirportInfo(l.to));
  // A mirror round trip (A→B, B→A) is one route flown both ways.
  const mirror = known.length === 2 && known[0].from === known[1].to && known[0].to === known[1].from;
  const routes = mirror ? [[known[0].from, known[0].to, known[0].from]] : known.map((l) => [l.from, l.to]);

  const view = useMemo(() => {
    const pts = known.flatMap((l) => [getAirportInfo(l.from), getAirportInfo(l.to)]);
    if (!pts.length) return null;
    const lats = pts.map((p) => p.latitude), lngs = pts.map((p) => p.longitude);
    const span = Math.max(Math.max(...lngs) - Math.min(...lngs), (Math.max(...lats) - Math.min(...lats)) * 1.6);
    return {
      center: [(Math.max(...lngs) + Math.min(...lngs)) / 2, (Math.max(...lats) + Math.min(...lats)) / 2 + span * 0.08],
      zoom: Math.max(0.6, Math.min(5, Math.log2(360 / Math.max(span, 1)) - 0.6)),
    };
  }, [known.map((l) => l.from + l.to).join("|")]);

  if (!view) return null;
  const style = ivoryStyle();
  return (
    <div className="rounded-xl overflow-hidden" style={{ height, border: `1px solid ${T.mist}`, background: T.paper }}>
      <Map theme="light" styles={{ light: style, dark: style }} center={view.center} zoom={view.zoom} attributionControl={false}>
        {routes.map((wps, i) => (
          <FlightMultiRoute
            key={wps.join("-") + i}
            waypoints={wps}
            color={i === 0 ? T.flight : T.pine}
            width={2}
            opacity={0.9}
            showAirports
            showLabel
            hoverEffect
            tripType={mirror ? "round-trip" : "one-way"}
            animate={{ duration: 7000 + i * 1500, loop: true }}
          />
        ))}
      </Map>
    </div>
  );
}
