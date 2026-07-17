/**
 * Global city dataset for the destination picker (demo mode).
 * Live mode replaces search with the Amadeus locations API; this list keeps
 * the app fully functional offline. region drives award-chart lookups.
 * hub: true = plausible connecting point for itineraries from its region.
 */
export const REGIONS = {
  NA: "North America", SA: "South America", EU: "Europe", NEASIA: "NE Asia",
  SEASIA: "SE Asia", SASIA: "South Asia", ME: "Middle East", OCE: "Oceania", AF: "Africa",
};

export const WORLD = [
  // ── North America ──
  { id: "tampa",    name: "Tampa",        country: "USA", region: "NA", lat: 27.98,  lon: -82.53,  air: "TPA" },
  { id: "miami",    name: "Miami",        country: "USA", region: "NA", lat: 25.79,  lon: -80.29,  air: "MIA", hub: true },
  { id: "atlanta",  name: "Atlanta",      country: "USA", region: "NA", lat: 33.64,  lon: -84.43,  air: "ATL", hub: true },
  { id: "nyc",      name: "New York",     country: "USA", region: "NA", lat: 40.64,  lon: -73.78,  air: "JFK", hub: true },
  { id: "chicago",  name: "Chicago",      country: "USA", region: "NA", lat: 41.98,  lon: -87.90,  air: "ORD", hub: true },
  { id: "dallas",   name: "Dallas",       country: "USA", region: "NA", lat: 32.90,  lon: -97.04,  air: "DFW", hub: true },
  { id: "denver",   name: "Denver",       country: "USA", region: "NA", lat: 39.86,  lon: -104.67, air: "DEN", hub: true },
  { id: "la",       name: "Los Angeles",  country: "USA", region: "NA", lat: 33.94,  lon: -118.41, air: "LAX", hub: true },
  { id: "sf",       name: "San Francisco",country: "USA", region: "NA", lat: 37.62,  lon: -122.38, air: "SFO", hub: true },
  { id: "seattle",  name: "Seattle",      country: "USA", region: "NA", lat: 47.45,  lon: -122.31, air: "SEA", hub: true },
  { id: "vegas",    name: "Las Vegas",    country: "USA", region: "NA", lat: 36.08,  lon: -115.15, air: "LAS" },
  { id: "honolulu", name: "Honolulu",     country: "USA", region: "NA", lat: 21.32,  lon: -157.92, air: "HNL", hub: true },
  { id: "toronto",  name: "Toronto",      country: "Canada", region: "NA", lat: 43.68, lon: -79.63, air: "YYZ", hub: true },
  { id: "vancouver",name: "Vancouver",    country: "Canada", region: "NA", lat: 49.19, lon: -123.18,air: "YVR", hub: true },
  { id: "mexico",   name: "Mexico City",  country: "Mexico", region: "NA", lat: 19.44, lon: -99.07, air: "MEX", hub: true },
  { id: "cancun",   name: "Cancún",       country: "Mexico", region: "NA", lat: 21.04, lon: -86.87, air: "CUN" },
  // ── South America ──
  { id: "lima",     name: "Lima",         country: "Peru", region: "SA", lat: -12.02, lon: -77.11, air: "LIM", hub: true },
  { id: "cusco",    name: "Cusco",        country: "Peru", region: "SA", lat: -13.54, lon: -71.94, air: "CUZ" },
  { id: "bogota",   name: "Bogotá",       country: "Colombia", region: "SA", lat: 4.70, lon: -74.15, air: "BOG", hub: true },
  { id: "rio",      name: "Rio de Janeiro", country: "Brazil", region: "SA", lat: -22.81, lon: -43.25, air: "GIG" },
  { id: "saopaulo", name: "São Paulo",    country: "Brazil", region: "SA", lat: -23.43, lon: -46.47, air: "GRU", hub: true },
  { id: "buenosaires", name: "Buenos Aires", country: "Argentina", region: "SA", lat: -34.82, lon: -58.54, air: "EZE" },
  { id: "santiago", name: "Santiago",     country: "Chile", region: "SA", lat: -33.39, lon: -70.79, air: "SCL", hub: true },
  // ── Europe ──
  { id: "london",   name: "London",       country: "UK", region: "EU", lat: 51.47, lon: -0.45,  air: "LHR", hub: true },
  { id: "edinburgh",name: "Edinburgh",    country: "UK", region: "EU", lat: 55.95, lon: -3.37,  air: "EDI" },
  { id: "paris",    name: "Paris",        country: "France", region: "EU", lat: 49.01, lon: 2.55, air: "CDG", hub: true },
  { id: "amsterdam",name: "Amsterdam",    country: "Netherlands", region: "EU", lat: 52.31, lon: 4.76, air: "AMS", hub: true },
  { id: "brussels", name: "Brussels",     country: "Belgium", region: "EU", lat: 50.90, lon: 4.48, air: "BRU" },
  { id: "zurich",   name: "Zurich",       country: "Switzerland", region: "EU", lat: 47.46, lon: 8.55, air: "ZRH", hub: true },
  { id: "geneva",   name: "Geneva",       country: "Switzerland", region: "EU", lat: 46.24, lon: 6.11, air: "GVA" },
  { id: "munich",   name: "Munich",       country: "Germany", region: "EU", lat: 48.35, lon: 11.79, air: "MUC", hub: true },
  { id: "berlin",   name: "Berlin",       country: "Germany", region: "EU", lat: 52.37, lon: 13.50, air: "BER" },
  { id: "frankfurt",name: "Frankfurt",    country: "Germany", region: "EU", lat: 50.03, lon: 8.56, air: "FRA", hub: true },
  { id: "vienna",   name: "Vienna",       country: "Austria", region: "EU", lat: 48.11, lon: 16.57, air: "VIE" },
  { id: "prague",   name: "Prague",       country: "Czechia", region: "EU", lat: 50.10, lon: 14.26, air: "PRG" },
  { id: "rome",     name: "Rome",         country: "Italy", region: "EU", lat: 41.80, lon: 12.25, air: "FCO", hub: true },
  { id: "florence", name: "Florence",     country: "Italy", region: "EU", lat: 43.81, lon: 11.20, air: "FLR" },
  { id: "venice",   name: "Venice",       country: "Italy", region: "EU", lat: 45.50, lon: 12.35, air: "VCE" },
  { id: "milan",    name: "Milan",        country: "Italy", region: "EU", lat: 45.63, lon: 8.72,  air: "MXP" },
  { id: "madrid",   name: "Madrid",       country: "Spain", region: "EU", lat: 40.47, lon: -3.56, air: "MAD", hub: true },
  { id: "barcelona",name: "Barcelona",    country: "Spain", region: "EU", lat: 41.30, lon: 2.08,  air: "BCN" },
  { id: "lisbon",   name: "Lisbon",       country: "Portugal", region: "EU", lat: 38.77, lon: -9.13, air: "LIS", hub: true },
  { id: "athens",   name: "Athens",       country: "Greece", region: "EU", lat: 37.94, lon: 23.94, air: "ATH" },
  { id: "istanbul", name: "Istanbul",     country: "Türkiye", region: "EU", lat: 41.26, lon: 28.74, air: "IST", hub: true },
  { id: "reykjavik",name: "Reykjavík",    country: "Iceland", region: "EU", lat: 63.98, lon: -22.62, air: "KEF" },
  // ── NE Asia (Japan pack cities carry pack: "japan") ──
  { id: "tokyo",    name: "Tokyo",        country: "Japan", region: "NEASIA", lat: 35.68, lon: 139.69, air: "HND", hub: true, pack: "japan" },
  { id: "kyoto",    name: "Kyoto",        country: "Japan", region: "NEASIA", lat: 35.01, lon: 135.77, air: "KIX", pack: "japan" },
  { id: "osaka",    name: "Osaka",        country: "Japan", region: "NEASIA", lat: 34.69, lon: 135.50, air: "KIX", hub: true, pack: "japan" },
  { id: "hakone",   name: "Hakone",       country: "Japan", region: "NEASIA", lat: 35.23, lon: 139.03, air: "HND", pack: "japan" },
  { id: "nara",     name: "Nara",         country: "Japan", region: "NEASIA", lat: 34.69, lon: 135.83, air: "KIX", pack: "japan" },
  { id: "hiroshima",name: "Hiroshima",    country: "Japan", region: "NEASIA", lat: 34.39, lon: 132.46, air: "HIJ", pack: "japan" },
  { id: "kanazawa", name: "Kanazawa",     country: "Japan", region: "NEASIA", lat: 36.56, lon: 136.66, air: "KMQ", pack: "japan" },
  { id: "seoul",    name: "Seoul",        country: "South Korea", region: "NEASIA", lat: 37.46, lon: 126.44, air: "ICN", hub: true },
  { id: "taipei",   name: "Taipei",       country: "Taiwan", region: "NEASIA", lat: 25.08, lon: 121.23, air: "TPE", hub: true },
  { id: "hongkong", name: "Hong Kong",    country: "Hong Kong", region: "NEASIA", lat: 22.31, lon: 113.91, air: "HKG", hub: true },
  { id: "shanghai", name: "Shanghai",     country: "China", region: "NEASIA", lat: 31.14, lon: 121.81, air: "PVG", hub: true },
  // ── SE / South Asia, ME, Oceania, Africa ──
  { id: "bangkok",  name: "Bangkok",      country: "Thailand", region: "SEASIA", lat: 13.69, lon: 100.75, air: "BKK", hub: true },
  { id: "singapore",name: "Singapore",    country: "Singapore", region: "SEASIA", lat: 1.36, lon: 103.99, air: "SIN", hub: true },
  { id: "bali",     name: "Bali",         country: "Indonesia", region: "SEASIA", lat: -8.75, lon: 115.17, air: "DPS" },
  { id: "hanoi",    name: "Hanoi",        country: "Vietnam", region: "SEASIA", lat: 21.22, lon: 105.81, air: "HAN" },
  { id: "delhi",    name: "Delhi",        country: "India", region: "SASIA", lat: 28.56, lon: 77.10, air: "DEL", hub: true },
  { id: "mumbai",   name: "Mumbai",       country: "India", region: "SASIA", lat: 19.09, lon: 72.87, air: "BOM" },
  { id: "dubai",    name: "Dubai",        country: "UAE", region: "ME", lat: 25.25, lon: 55.36, air: "DXB", hub: true },
  { id: "doha",     name: "Doha",         country: "Qatar", region: "ME", lat: 25.27, lon: 51.61, air: "DOH", hub: true },
  { id: "sydney",   name: "Sydney",       country: "Australia", region: "OCE", lat: -33.95, lon: 151.18, air: "SYD", hub: true },
  { id: "melbourne",name: "Melbourne",    country: "Australia", region: "OCE", lat: -37.67, lon: 144.84, air: "MEL" },
  { id: "auckland", name: "Auckland",     country: "New Zealand", region: "OCE", lat: -37.01, lon: 174.79, air: "AKL", hub: true },
  { id: "capetown", name: "Cape Town",    country: "South Africa", region: "AF", lat: -33.97, lon: 18.60, air: "CPT" },
  { id: "cairo",    name: "Cairo",        country: "Egypt", region: "AF", lat: 30.12, lon: 31.41, air: "CAI", hub: true },
  { id: "marrakesh",name: "Marrakesh",    country: "Morocco", region: "AF", lat: 31.61, lon: -8.04, air: "RAK" },
];

export const cityById = Object.fromEntries(WORLD.map((c) => [c.id, c]));
export const searchCities = (q) => {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return WORLD.filter(
    (c) => c.name.toLowerCase().includes(s) || c.country.toLowerCase().includes(s)
  ).slice(0, 8);
};
