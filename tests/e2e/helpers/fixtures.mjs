/**
 * Canned answers for the mocked worker and the browser-side lookups.
 * Shapes follow worker/index.js (what the real API returns) so the app's
 * merge layer (src/lib/liveMerge.js) treats them exactly like live data.
 * Every name, price and link here is invented.
 */
export const API = "http://localhost:8788";

const addDays = (iso, n) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** GET /api/flights — two Google-Flights-style offers: a one-stop and a nonstop. */
export function flightOffers({ from, to, date, cabin = "BUSINESS" }) {
  if (!from || !to || !date) return [];
  const tokyo = [from, to].some((x) => x === "HND" || x === "NRT");
  const hub = from === "TPA" || to === "TPA" ? "ATL" : "LHR";
  const nonstop = tokyo ? "NH" : "DL";
  const next = addDays(date, tokyo ? 1 : 0);
  return [
    {
      price: 2890, carrier: "DL", cabin, gfLive: true,
      itineraries: [{
        duration: tokyo ? "PT17H10M" : "PT11H25M",
        segments: [
          { from, to: hub, dep: `${date}T07:45:00`, arr: `${date}T09:30:00`, carrier: "DL", num: "1204" },
          { from: hub, to, dep: `${date}T11:20:00`, arr: `${next}T${tokyo ? "15:55" : "19:10"}:00`, carrier: "DL", num: tokyo ? "295" : "64" },
        ],
      }],
    },
    {
      price: 3480, carrier: nonstop, cabin, gfLive: true,
      itineraries: [{
        duration: tokyo ? "PT14H05M" : "PT9H40M",
        segments: [{ from, to, dep: `${date}T10:30:00`, arr: `${next}T${tokyo ? "13:35" : "20:10"}:00`, carrier: nonstop, num: tokyo ? "7" : "1540" }],
      }],
    },
  ];
}

/** GET /api/awards — one Seats.aero-style row with Business and Economy space. */
export function awardRows({ from, to, date }) {
  if (!from || !to || !date) return [];
  const airlines = [from, to].some((x) => x === "HND" || x === "NRT") ? "ANA" : "United";
  return [{
    source: "united", date,
    business: { miles: 88000, taxes: 45, seats: 2, direct: true, airlines },
    economy: { miles: 40000, taxes: 45, seats: 4, direct: true, airlines },
  }];
}

/** GET /api/hotels — four priced properties around the searched point (price = stay total). */
export function hotelsFor({ name, lat, lon }) {
  const city = String(name ?? "City").replace(/\s*\(.+\)$/, "");
  const la = +lat || 0, lo = +lon || 0;
  const row = (n, i, price, stars, rating, reviews, dLat, dLon, refundable, room) => ({
    name: n, id: `test-${i}-${city.toLowerCase()}`, price, stars, rating, reviews,
    lat: la + dLat, lon: lo + dLon, photo: null, room, refundable, dueAtHotel: null,
  });
  return [
    row(`Park Hyatt ${city}`, 1, 1240, 5, 9.2, 2210, 0.006, -0.004, true, "Park Suite"),
    row(`${city} Grand Palace Hotel`, 2, 640, 4, 8.6, 1480, -0.005, 0.007, true, "Deluxe King"),
    row(`Riverside Boutique ${city}`, 3, 520, 4, 8.9, 630, 0.003, 0.009, false, "Studio"),
    row(`Meridian Test Inn ${city}`, 4, 410, 3, 7.8, 320, -0.008, -0.006, null, "Standard Twin"),
  ].sort((a, b) => a.price - b.price);
}

/** GET /api/places — three named places per layer kind near the point. */
const PLACES = {
  sights: [["Imperial Gardens", "park", 3], ["Old Town Museum", "museum", 3], ["Grand Cathedral", "place of worship", 2]],
  food: [["Noodle House Test", "ramen", 3], ["Trattoria Mock", "italian", 2], ["Market Hall Bistro", "bistro", 1]],
  shop: [["Design Market", "department store", 3], ["Vintage Row", "clothes", 2], ["Arcade Test Mall", "mall", 1]],
};
export function placesFor({ kind, lat, lon }) {
  return (PLACES[kind] ?? []).map(([name, sub, rank], i) => ({
    name, lat: +lat + 0.004 * (i - 1), lon: +lon + 0.005 * (i - 1), kind, sub, rank,
  }));
}

/** Open-Meteo geocoder stand-in: exact city names only, downtown coordinates. */
const TOWNS = {
  tokyo: ["Tokyo", 35.6762, 139.6503, "Japan", "JP", "Tokyo"],
  osaka: ["Osaka", 34.6937, 135.5023, "Japan", "JP", "Osaka"],
  kyoto: ["Kyoto", 35.0116, 135.7681, "Japan", "JP", "Kyoto"],
  rome: ["Rome", 41.9028, 12.4964, "Italy", "IT", "Lazio"],
  florence: ["Florence", 43.7696, 11.2558, "Italy", "IT", "Tuscany"],
  firenze: ["Florence", 43.7696, 11.2558, "Italy", "IT", "Tuscany"],
  tampa: ["Tampa", 27.9506, -82.4572, "United States", "US", "Florida"],
};
export function geocode(q) {
  const key = String(q ?? "").trim().toLowerCase();
  const hit = TOWNS[key];
  return {
    results: hit ? [{ id: key, name: hit[0], latitude: hit[1], longitude: hit[2], country: hit[3], country_code: hit[4], admin1: hit[5] }] : [],
  };
}

/**
 * Nominatim search stand-in for the attraction pins: "<attraction>, <city>"
 * resolves to a spot a few hundred metres from the known city centre, so
 * every attraction of a known city pins; anything else finds nothing.
 */
export function poiSearch(q) {
  const parts = String(q ?? "").split(",").map((s) => s.trim());
  const city = TOWNS[(parts[parts.length - 1] ?? "").toLowerCase()];
  if (parts.length < 2 || !city) return [];
  const label = parts[0];
  const seed = [...label].reduce((s, c) => s + c.charCodeAt(0), 0);
  return [{
    lat: String(city[1] + ((seed % 7) - 3) * 0.003),
    lon: String(city[2] + ((seed % 5) - 2) * 0.004),
    display_name: `${label}, ${city[0]}, ${city[3]}`,
  }];
}

/** A blank MapLibre style: the street map loads without fetching a single tile. */
export const MAP_STYLE = {
  version: 8, name: "meridian-test-blank", sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#efe9df" } }],
};
