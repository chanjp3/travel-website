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
  { id: "nyc",      name: "New York",     country: "USA", region: "NA", lat: 40.64,  lon: -73.78,  air: "JFK", cc: "NYC", hub: true },
  { id: "chicago",  name: "Chicago",      country: "USA", region: "NA", lat: 41.98,  lon: -87.90,  air: "ORD", cc: "CHI", hub: true },
  { id: "dallas",   name: "Dallas",       country: "USA", region: "NA", lat: 32.90,  lon: -97.04,  air: "DFW", hub: true },
  { id: "denver",   name: "Denver",       country: "USA", region: "NA", lat: 39.86,  lon: -104.67, air: "DEN", hub: true },
  { id: "la",       name: "Los Angeles",  country: "USA", region: "NA", lat: 33.94,  lon: -118.41, air: "LAX", hub: true },
  { id: "sf",       name: "San Francisco",country: "USA", region: "NA", lat: 37.62,  lon: -122.38, air: "SFO", hub: true },
  { id: "seattle",  name: "Seattle",      country: "USA", region: "NA", lat: 47.45,  lon: -122.31, air: "SEA", hub: true },
  { id: "vegas",    name: "Las Vegas",    country: "USA", region: "NA", lat: 36.08,  lon: -115.15, air: "LAS" },
  { id: "honolulu", name: "Honolulu",     country: "USA", region: "NA", lat: 21.32,  lon: -157.92, air: "HNL", hub: true },
  { id: "toronto",  name: "Toronto",      country: "Canada", region: "NA", lat: 43.68, lon: -79.63, air: "YYZ", cc: "YTO", hub: true },
  { id: "vancouver",name: "Vancouver",    country: "Canada", region: "NA", lat: 49.19, lon: -123.18,air: "YVR", hub: true },
  { id: "mexico",   name: "Mexico City",  country: "Mexico", region: "NA", lat: 19.44, lon: -99.07, air: "MEX", hub: true },
  { id: "cancun",   name: "Cancún",       country: "Mexico", region: "NA", lat: 21.04, lon: -86.87, air: "CUN" },
  // ── South America ──
  { id: "lima",     name: "Lima",         country: "Peru", region: "SA", lat: -12.02, lon: -77.11, air: "LIM", hub: true },
  { id: "cusco",    name: "Cusco",        country: "Peru", region: "SA", lat: -13.54, lon: -71.94, air: "CUZ" },
  { id: "bogota",   name: "Bogotá",       country: "Colombia", region: "SA", lat: 4.70, lon: -74.15, air: "BOG", hub: true },
  { id: "rio",      name: "Rio de Janeiro", country: "Brazil", region: "SA", lat: -22.81, lon: -43.25, air: "GIG", cc: "RIO" },
  { id: "saopaulo", name: "São Paulo",    country: "Brazil", region: "SA", lat: -23.43, lon: -46.47, air: "GRU", cc: "SAO", hub: true },
  { id: "buenosaires", name: "Buenos Aires", country: "Argentina", region: "SA", lat: -34.82, lon: -58.54, air: "EZE", cc: "BUE" },
  { id: "santiago", name: "Santiago",     country: "Chile", region: "SA", lat: -33.39, lon: -70.79, air: "SCL", hub: true },
  // ── Europe ──
  { id: "london",   name: "London",       country: "UK", region: "EU", lat: 51.47, lon: -0.45,  air: "LHR", cc: "LON", hub: true },
  { id: "edinburgh",name: "Edinburgh",    country: "UK", region: "EU", lat: 55.95, lon: -3.37,  air: "EDI" },
  { id: "paris",    name: "Paris",        country: "France", region: "EU", lat: 49.01, lon: 2.55, air: "CDG", cc: "PAR", hub: true },
  { id: "amsterdam",name: "Amsterdam",    country: "Netherlands", region: "EU", lat: 52.31, lon: 4.76, air: "AMS", hub: true },
  { id: "brussels", name: "Brussels",     country: "Belgium", region: "EU", lat: 50.90, lon: 4.48, air: "BRU" },
  { id: "zurich",   name: "Zurich",       country: "Switzerland", region: "EU", lat: 47.46, lon: 8.55, air: "ZRH", hub: true },
  { id: "geneva",   name: "Geneva",       country: "Switzerland", region: "EU", lat: 46.24, lon: 6.11, air: "GVA" },
  { id: "munich",   name: "Munich",       country: "Germany", region: "EU", lat: 48.35, lon: 11.79, air: "MUC", hub: true },
  { id: "berlin",   name: "Berlin",       country: "Germany", region: "EU", lat: 52.37, lon: 13.50, air: "BER" },
  { id: "frankfurt",name: "Frankfurt",    country: "Germany", region: "EU", lat: 50.03, lon: 8.56, air: "FRA", hub: true },
  { id: "vienna",   name: "Vienna",       country: "Austria", region: "EU", lat: 48.11, lon: 16.57, air: "VIE" },
  { id: "prague",   name: "Prague",       country: "Czechia", region: "EU", lat: 50.10, lon: 14.26, air: "PRG" },
  { id: "rome",     name: "Rome",         country: "Italy", region: "EU", lat: 41.80, lon: 12.25, air: "FCO", cc: "ROM", hub: true },
  { id: "florence", name: "Florence",     country: "Italy", region: "EU", lat: 43.81, lon: 11.20, air: "FLR" },
  { id: "venice",   name: "Venice",       country: "Italy", region: "EU", lat: 45.50, lon: 12.35, air: "VCE" },
  { id: "milan",    name: "Milan",        country: "Italy", region: "EU", lat: 45.63, lon: 8.72,  air: "MXP", cc: "MIL" },
  { id: "madrid",   name: "Madrid",       country: "Spain", region: "EU", lat: 40.47, lon: -3.56, air: "MAD", hub: true },
  { id: "barcelona",name: "Barcelona",    country: "Spain", region: "EU", lat: 41.30, lon: 2.08,  air: "BCN" },
  { id: "lisbon",   name: "Lisbon",       country: "Portugal", region: "EU", lat: 38.77, lon: -9.13, air: "LIS", hub: true },
  { id: "athens",   name: "Athens",       country: "Greece", region: "EU", lat: 37.94, lon: 23.94, air: "ATH" },
  { id: "istanbul", name: "Istanbul",     country: "Türkiye", region: "EU", lat: 41.26, lon: 28.74, air: "IST", hub: true },
  { id: "reykjavik",name: "Reykjavík",    country: "Iceland", region: "EU", lat: 63.98, lon: -22.62, air: "KEF" },
  // ── NE Asia (Japan pack cities carry pack: "japan") ──
  { id: "tokyo",    name: "Tokyo",        country: "Japan", region: "NEASIA", lat: 35.68, lon: 139.69, air: "HND", cc: "TYO", hub: true, pack: "japan" },
  { id: "kyoto",    name: "Kyoto",        country: "Japan", region: "NEASIA", lat: 35.01, lon: 135.77, air: "KIX", pack: "japan" },
  { id: "osaka",    name: "Osaka",        country: "Japan", region: "NEASIA", lat: 34.69, lon: 135.50, air: "KIX", cc: "OSA", hub: true, pack: "japan" },
  { id: "hakone",   name: "Hakone",       country: "Japan", region: "NEASIA", lat: 35.23, lon: 139.03, air: "HND", pack: "japan" },
  { id: "nara",     name: "Nara",         country: "Japan", region: "NEASIA", lat: 34.69, lon: 135.83, air: "KIX", pack: "japan" },
  { id: "hiroshima",name: "Hiroshima",    country: "Japan", region: "NEASIA", lat: 34.39, lon: 132.46, air: "HIJ", pack: "japan" },
  { id: "kanazawa", name: "Kanazawa",     country: "Japan", region: "NEASIA", lat: 36.56, lon: 136.66, air: "KMQ", pack: "japan" },
  { id: "seoul",    name: "Seoul",        country: "South Korea", region: "NEASIA", lat: 37.46, lon: 126.44, air: "ICN", cc: "SEL", hub: true },
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
  // ── Secondary cities (tier 2) — suggestion pool around primary destinations ──
  // UK & Ireland
  { id: "manchester", name: "Manchester", country: "UK", region: "EU", lat: 53.35, lon: -2.28, air: "MAN", tier: 2 },
  { id: "glasgow", name: "Glasgow", country: "UK", region: "EU", lat: 55.87, lon: -4.43, air: "GLA", tier: 2 },
  { id: "liverpool", name: "Liverpool", country: "UK", region: "EU", lat: 53.40, lon: -2.98, air: "LPL", tier: 2 },
  { id: "bristol", name: "Bristol", country: "UK", region: "EU", lat: 51.45, lon: -2.59, air: "BRS", tier: 2 },
  { id: "york", name: "York", country: "UK", region: "EU", lat: 53.96, lon: -1.09, air: "LBA", tier: 2 },
  { id: "bath", name: "Bath", country: "UK", region: "EU", lat: 51.38, lon: -2.36, air: "BRS", tier: 2 },
  { id: "brighton", name: "Brighton", country: "UK", region: "EU", lat: 50.82, lon: -0.14, air: "LGW", tier: 2 },
  { id: "southampton", name: "Southampton", country: "UK", region: "EU", lat: 50.90, lon: -1.40, air: "SOU", tier: 2 },
  { id: "oxford", name: "Oxford", country: "UK", region: "EU", lat: 51.75, lon: -1.26, air: "LHR", tier: 2 },
  { id: "cambridge", name: "Cambridge", country: "UK", region: "EU", lat: 52.21, lon: 0.12, air: "STN", tier: 2 },
  { id: "dublin", name: "Dublin", country: "Ireland", region: "EU", lat: 53.43, lon: -6.25, air: "DUB", hub: true, tier: 2 },
  { id: "galway", name: "Galway", country: "Ireland", region: "EU", lat: 53.27, lon: -9.05, air: "SNN", tier: 2 },
  // France
  { id: "nice", name: "Nice", country: "France", region: "EU", lat: 43.66, lon: 7.22, air: "NCE", tier: 2 },
  { id: "lyon", name: "Lyon", country: "France", region: "EU", lat: 45.73, lon: 5.08, air: "LYS", tier: 2 },
  { id: "bordeaux", name: "Bordeaux", country: "France", region: "EU", lat: 44.83, lon: -0.72, air: "BOD", tier: 2 },
  { id: "marseille", name: "Marseille", country: "France", region: "EU", lat: 43.44, lon: 5.22, air: "MRS", tier: 2 },
  { id: "strasbourg", name: "Strasbourg", country: "France", region: "EU", lat: 48.54, lon: 7.63, air: "SXB", tier: 2 },
  { id: "toulouse", name: "Toulouse", country: "France", region: "EU", lat: 43.63, lon: 1.37, air: "TLS", tier: 2 },
  // Italy
  { id: "naples", name: "Naples", country: "Italy", region: "EU", lat: 40.88, lon: 14.29, air: "NAP", tier: 2 },
  { id: "bologna", name: "Bologna", country: "Italy", region: "EU", lat: 44.53, lon: 11.29, air: "BLQ", tier: 2 },
  { id: "turin", name: "Turin", country: "Italy", region: "EU", lat: 45.20, lon: 7.65, air: "TRN", tier: 2 },
  { id: "palermo", name: "Palermo", country: "Italy", region: "EU", lat: 38.18, lon: 13.10, air: "PMO", tier: 2 },
  { id: "pisa", name: "Pisa", country: "Italy", region: "EU", lat: 43.68, lon: 10.39, air: "PSA", tier: 2 },
  { id: "verona", name: "Verona", country: "Italy", region: "EU", lat: 45.40, lon: 10.89, air: "VRN", tier: 2 },
  // Spain & Portugal
  { id: "seville", name: "Seville", country: "Spain", region: "EU", lat: 37.42, lon: -5.89, air: "SVQ", tier: 2 },
  { id: "valencia", name: "Valencia", country: "Spain", region: "EU", lat: 39.49, lon: -0.48, air: "VLC", tier: 2 },
  { id: "granada", name: "Granada", country: "Spain", region: "EU", lat: 37.19, lon: -3.78, air: "GRX", tier: 2 },
  { id: "bilbao", name: "Bilbao", country: "Spain", region: "EU", lat: 43.30, lon: -2.91, air: "BIO", tier: 2 },
  { id: "malaga", name: "Málaga", country: "Spain", region: "EU", lat: 36.67, lon: -4.50, air: "AGP", tier: 2 },
  { id: "porto", name: "Porto", country: "Portugal", region: "EU", lat: 41.24, lon: -8.68, air: "OPO", tier: 2 },
  // Germany, Switzerland, Austria, Benelux
  { id: "hamburg", name: "Hamburg", country: "Germany", region: "EU", lat: 53.63, lon: 9.99, air: "HAM", tier: 2 },
  { id: "cologne", name: "Cologne", country: "Germany", region: "EU", lat: 50.94, lon: 6.96, air: "CGN", tier: 2 },
  { id: "dresden", name: "Dresden", country: "Germany", region: "EU", lat: 51.05, lon: 13.74, air: "DRS", tier: 2 },
  { id: "stuttgart", name: "Stuttgart", country: "Germany", region: "EU", lat: 48.78, lon: 9.18, air: "STR", tier: 2 },
  { id: "lucerne", name: "Lucerne", country: "Switzerland", region: "EU", lat: 47.05, lon: 8.31, air: "ZRH", tier: 2 },
  { id: "interlaken", name: "Interlaken", country: "Switzerland", region: "EU", lat: 46.69, lon: 7.87, air: "BRN", tier: 2 },
  { id: "zermatt", name: "Zermatt", country: "Switzerland", region: "EU", lat: 46.02, lon: 7.75, air: "GVA", tier: 2 },
  { id: "salzburg", name: "Salzburg", country: "Austria", region: "EU", lat: 47.80, lon: 13.04, air: "SZG", tier: 2 },
  { id: "innsbruck", name: "Innsbruck", country: "Austria", region: "EU", lat: 47.26, lon: 11.39, air: "INN", tier: 2 },
  { id: "rotterdam", name: "Rotterdam", country: "Netherlands", region: "EU", lat: 51.92, lon: 4.48, air: "RTM", tier: 2 },
  // Nordics & Central Europe
  { id: "copenhagen", name: "Copenhagen", country: "Denmark", region: "EU", lat: 55.62, lon: 12.66, air: "CPH", hub: true, tier: 2 },
  { id: "stockholm", name: "Stockholm", country: "Sweden", region: "EU", lat: 59.65, lon: 17.92, air: "ARN", hub: true, tier: 2 },
  { id: "oslo", name: "Oslo", country: "Norway", region: "EU", lat: 60.19, lon: 11.10, air: "OSL", tier: 2 },
  { id: "bergen", name: "Bergen", country: "Norway", region: "EU", lat: 60.29, lon: 5.22, air: "BGO", tier: 2 },
  { id: "helsinki", name: "Helsinki", country: "Finland", region: "EU", lat: 60.32, lon: 24.96, air: "HEL", hub: true, tier: 2 },
  { id: "krakow", name: "Kraków", country: "Poland", region: "EU", lat: 50.08, lon: 19.78, air: "KRK", tier: 2 },
  { id: "warsaw", name: "Warsaw", country: "Poland", region: "EU", lat: 52.17, lon: 20.97, air: "WAW", tier: 2 },
  { id: "budapest", name: "Budapest", country: "Hungary", region: "EU", lat: 47.44, lon: 19.26, air: "BUD", tier: 2 },
  { id: "dubrovnik", name: "Dubrovnik", country: "Croatia", region: "EU", lat: 42.56, lon: 18.27, air: "DBV", tier: 2 },
  { id: "split", name: "Split", country: "Croatia", region: "EU", lat: 43.54, lon: 16.30, air: "SPU", tier: 2 },
  // Greece & Türkiye
  { id: "santorini", name: "Santorini", country: "Greece", region: "EU", lat: 36.40, lon: 25.48, air: "JTR", tier: 2 },
  { id: "heraklion", name: "Heraklion (Crete)", country: "Greece", region: "EU", lat: 35.34, lon: 25.18, air: "HER", tier: 2 },
  { id: "thessaloniki", name: "Thessaloniki", country: "Greece", region: "EU", lat: 40.52, lon: 22.97, air: "SKG", tier: 2 },
  { id: "antalya", name: "Antalya", country: "Türkiye", region: "EU", lat: 36.90, lon: 30.79, air: "AYT", tier: 2 },
  { id: "cappadocia", name: "Cappadocia (Göreme)", country: "Türkiye", region: "EU", lat: 38.64, lon: 34.83, air: "NAV", tier: 2 },
  // Japan (beyond the rail-pack seven)
  { id: "sapporo", name: "Sapporo", country: "Japan", region: "NEASIA", lat: 42.78, lon: 141.69, air: "CTS", tier: 2 },
  { id: "fukuoka", name: "Fukuoka", country: "Japan", region: "NEASIA", lat: 33.59, lon: 130.45, air: "FUK", tier: 2 },
  { id: "nagoya", name: "Nagoya", country: "Japan", region: "NEASIA", lat: 34.86, lon: 136.81, air: "NGO", tier: 2 },
  { id: "sendai", name: "Sendai", country: "Japan", region: "NEASIA", lat: 38.14, lon: 140.92, air: "SDJ", tier: 2 },
  { id: "naha", name: "Naha (Okinawa)", country: "Japan", region: "NEASIA", lat: 26.21, lon: 127.65, air: "OKA", tier: 2 },
  // Asia
  { id: "busan", name: "Busan", country: "South Korea", region: "NEASIA", lat: 35.18, lon: 128.94, air: "PUS", tier: 2 },
  { id: "jeju", name: "Jeju", country: "South Korea", region: "NEASIA", lat: 33.51, lon: 126.49, air: "CJU", tier: 2 },
  { id: "beijing", name: "Beijing", country: "China", region: "NEASIA", lat: 40.08, lon: 116.58, air: "PEK", hub: true, tier: 2 },
  { id: "chiangmai", name: "Chiang Mai", country: "Thailand", region: "SEASIA", lat: 18.77, lon: 98.96, air: "CNX", tier: 2 },
  { id: "phuket", name: "Phuket", country: "Thailand", region: "SEASIA", lat: 8.11, lon: 98.31, air: "HKT", tier: 2 },
  { id: "krabi", name: "Krabi", country: "Thailand", region: "SEASIA", lat: 8.10, lon: 98.98, air: "KBV", tier: 2 },
  { id: "hochiminh", name: "Ho Chi Minh City", country: "Vietnam", region: "SEASIA", lat: 10.82, lon: 106.65, air: "SGN", hub: true, tier: 2 },
  { id: "danang", name: "Da Nang", country: "Vietnam", region: "SEASIA", lat: 16.04, lon: 108.20, air: "DAD", tier: 2 },
  { id: "hoian", name: "Hoi An", country: "Vietnam", region: "SEASIA", lat: 15.88, lon: 108.34, air: "DAD", tier: 2 },
  { id: "jakarta", name: "Jakarta", country: "Indonesia", region: "SEASIA", lat: -6.13, lon: 106.66, air: "CGK", hub: true, tier: 2 },
  { id: "ubud", name: "Ubud (Bali)", country: "Indonesia", region: "SEASIA", lat: -8.51, lon: 115.26, air: "DPS", tier: 2 },
  { id: "kualalumpur", name: "Kuala Lumpur", country: "Malaysia", region: "SEASIA", lat: 2.75, lon: 101.71, air: "KUL", hub: true, tier: 2 },
  { id: "penang", name: "Penang", country: "Malaysia", region: "SEASIA", lat: 5.30, lon: 100.27, air: "PEN", tier: 2 },
  { id: "jaipur", name: "Jaipur", country: "India", region: "SASIA", lat: 26.82, lon: 75.81, air: "JAI", tier: 2 },
  { id: "agra", name: "Agra", country: "India", region: "SASIA", lat: 27.16, lon: 77.96, air: "AGR", tier: 2 },
  { id: "goa", name: "Goa", country: "India", region: "SASIA", lat: 15.38, lon: 73.83, air: "GOI", tier: 2 },
  { id: "bengaluru", name: "Bengaluru", country: "India", region: "SASIA", lat: 13.20, lon: 77.71, air: "BLR", hub: true, tier: 2 },
  // Middle East & Africa
  { id: "abudhabi", name: "Abu Dhabi", country: "UAE", region: "ME", lat: 24.43, lon: 54.65, air: "AUH", hub: true, tier: 2 },
  { id: "amman", name: "Amman", country: "Jordan", region: "ME", lat: 31.72, lon: 35.99, air: "AMM", tier: 2 },
  { id: "luxor", name: "Luxor", country: "Egypt", region: "AF", lat: 25.67, lon: 32.71, air: "LXR", tier: 2 },
  { id: "fes", name: "Fes", country: "Morocco", region: "AF", lat: 33.93, lon: -4.98, air: "FEZ", tier: 2 },
  { id: "casablanca", name: "Casablanca", country: "Morocco", region: "AF", lat: 33.37, lon: -7.59, air: "CMN", hub: true, tier: 2 },
  { id: "nairobi", name: "Nairobi", country: "Kenya", region: "AF", lat: -1.32, lon: 36.93, air: "NBO", hub: true, tier: 2 },
  { id: "zanzibar", name: "Zanzibar", country: "Tanzania", region: "AF", lat: -6.22, lon: 39.22, air: "ZNZ", tier: 2 },
  { id: "johannesburg", name: "Johannesburg", country: "South Africa", region: "AF", lat: -26.14, lon: 28.25, air: "JNB", hub: true, tier: 2 },
  { id: "stellenbosch", name: "Stellenbosch", country: "South Africa", region: "AF", lat: -33.93, lon: 18.86, air: "CPT", tier: 2 },
  // Oceania
  { id: "brisbane", name: "Brisbane", country: "Australia", region: "OCE", lat: -27.38, lon: 153.12, air: "BNE", hub: true, tier: 2 },
  { id: "perth", name: "Perth", country: "Australia", region: "OCE", lat: -31.94, lon: 115.97, air: "PER", tier: 2 },
  { id: "cairns", name: "Cairns", country: "Australia", region: "OCE", lat: -16.88, lon: 145.75, air: "CNS", tier: 2 },
  { id: "queenstown", name: "Queenstown", country: "New Zealand", region: "OCE", lat: -45.02, lon: 168.74, air: "ZQN", tier: 2 },
  { id: "wellington", name: "Wellington", country: "New Zealand", region: "OCE", lat: -41.33, lon: 174.81, air: "WLG", tier: 2 },
  { id: "christchurch", name: "Christchurch", country: "New Zealand", region: "OCE", lat: -43.49, lon: 172.53, air: "CHC", tier: 2 },
  // North America
  { id: "boston", name: "Boston", country: "USA", region: "NA", lat: 42.36, lon: -71.01, air: "BOS", hub: true, tier: 2 },
  { id: "washington", name: "Washington DC", country: "USA", region: "NA", lat: 38.95, lon: -77.46, air: "IAD", hub: true, tier: 2 },
  { id: "orlando", name: "Orlando", country: "USA", region: "NA", lat: 28.43, lon: -81.31, air: "MCO", tier: 2 },
  { id: "neworleans", name: "New Orleans", country: "USA", region: "NA", lat: 29.99, lon: -90.26, air: "MSY", tier: 2 },
  { id: "nashville", name: "Nashville", country: "USA", region: "NA", lat: 36.13, lon: -86.67, air: "BNA", tier: 2 },
  { id: "austin", name: "Austin", country: "USA", region: "NA", lat: 30.19, lon: -97.67, air: "AUS", tier: 2 },
  { id: "sandiego", name: "San Diego", country: "USA", region: "NA", lat: 32.73, lon: -117.19, air: "SAN", tier: 2 },
  { id: "portlandor", name: "Portland", country: "USA", region: "NA", lat: 45.59, lon: -122.60, air: "PDX", tier: 2 },
  { id: "savannah", name: "Savannah", country: "USA", region: "NA", lat: 32.13, lon: -81.20, air: "SAV", tier: 2 },
  { id: "charleston", name: "Charleston", country: "USA", region: "NA", lat: 32.90, lon: -80.04, air: "CHS", tier: 2 },
  { id: "montreal", name: "Montreal", country: "Canada", region: "NA", lat: 45.47, lon: -73.74, air: "YUL", hub: true, tier: 2 },
  { id: "quebec", name: "Quebec City", country: "Canada", region: "NA", lat: 46.79, lon: -71.38, air: "YQB", tier: 2 },
  { id: "calgary", name: "Calgary", country: "Canada", region: "NA", lat: 51.13, lon: -114.01, air: "YYC", hub: true, tier: 2 },
  { id: "oaxaca", name: "Oaxaca", country: "Mexico", region: "NA", lat: 17.00, lon: -96.73, air: "OAX", tier: 2 },
  { id: "guadalajara", name: "Guadalajara", country: "Mexico", region: "NA", lat: 20.52, lon: -103.31, air: "GDL", tier: 2 },
  { id: "tulum", name: "Tulum", country: "Mexico", region: "NA", lat: 20.21, lon: -87.53, air: "CUN", tier: 2 },
  // South America
  { id: "arequipa", name: "Arequipa", country: "Peru", region: "SA", lat: -16.34, lon: -71.57, air: "AQP", tier: 2 },
  { id: "medellin", name: "Medellín", country: "Colombia", region: "SA", lat: 6.16, lon: -75.42, air: "MDE", tier: 2 },
  { id: "cartagena", name: "Cartagena", country: "Colombia", region: "SA", lat: 10.44, lon: -75.51, air: "CTG", tier: 2 },
  { id: "mendoza", name: "Mendoza", country: "Argentina", region: "SA", lat: -32.83, lon: -68.79, air: "MDZ", tier: 2 },
  { id: "bariloche", name: "Bariloche", country: "Argentina", region: "SA", lat: -41.15, lon: -71.16, air: "BRC", tier: 2 },
  { id: "salvador", name: "Salvador", country: "Brazil", region: "SA", lat: -12.91, lon: -38.32, air: "SSA", tier: 2 },
  { id: "iguazu", name: "Iguazú Falls", country: "Argentina", region: "SA", lat: -25.60, lon: -54.49, air: "IGU", tier: 2 },
];

export const cityById = Object.fromEntries(WORLD.map((c) => [c.id, c]));
export const searchCities = (q) => {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return WORLD.filter(
    (c) => c.name.toLowerCase().includes(s) || c.country.toLowerCase().includes(s)
  ).slice(0, 8);
};

/* ── Runtime registry: geocoded towns picked in the builder ──────────── */
import { km } from "../lib/geo.js";

/** Nearest curated city — used to inherit region and gateway airport. */
export function nearestCity(lat, lon, pred = (c) => !c.custom) {
  let best = null, bd = Infinity;
  for (const c of WORLD) {
    if (!pred(c)) continue;
    const d = km({ lat, lon }, c);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

/** Build a city object from an Open-Meteo geocoder hit (any town on Earth). */
export function makeCustomCity(g) {
  const near = nearestCity(g.latitude, g.longitude);
  return {
    id: `t-${(g.name ?? "town").toLowerCase().replace(/[^a-z0-9]+/g, "")}-${Math.round(g.latitude * 100)}x${Math.round(g.longitude * 100)}`,
    name: g.name,
    country: g.country ?? (g.country_code ?? "").toUpperCase() ?? "—",
    region: near?.region ?? "EU",
    lat: g.latitude, lon: g.longitude,
    air: near?.air ?? "—",
    custom: true,
  };
}

/** Register a custom town so every engine (cityById lookups) can see it. */
export function registerCity(city) {
  if (cityById[city.id]) return cityById[city.id];
  WORLD.push(city);
  cityById[city.id] = city;
  return city;
}
