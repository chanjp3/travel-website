/** IATA carrier code → display name, for live Amadeus itineraries. */
export const AIRLINES = {
  AA: "American", DL: "Delta", UA: "United", AS: "Alaska", B6: "JetBlue",
  WN: "Southwest", HA: "Hawaiian", F9: "Frontier", NK: "Spirit",
  AC: "Air Canada", WS: "WestJet", AM: "Aeroméxico", Y4: "Volaris",
  BA: "British Airways", VS: "Virgin Atlantic", AF: "Air France", KL: "KLM",
  LH: "Lufthansa", LX: "SWISS", OS: "Austrian", SN: "Brussels Airlines",
  IB: "Iberia", UX: "Air Europa", TP: "TAP Air Portugal", AZ: "ITA Airways",
  TK: "Turkish Airlines", AY: "Finnair", SK: "SAS", LO: "LOT Polish",
  EI: "Aer Lingus", FI: "Icelandair", A3: "Aegean",
  EK: "Emirates", QR: "Qatar Airways", EY: "Etihad", SV: "Saudia",
  NH: "ANA", JL: "Japan Airlines", OZ: "Asiana", KE: "Korean Air",
  CX: "Cathay Pacific", BR: "EVA Air", CI: "China Airlines",
  SQ: "Singapore Airlines", TG: "Thai Airways", MH: "Malaysia Airlines",
  GA: "Garuda Indonesia", VN: "Vietnam Airlines", PR: "Philippine Airlines",
  AI: "Air India", QF: "Qantas", NZ: "Air New Zealand", VA: "Virgin Australia",
  FJ: "Fiji Airways", LA: "LATAM", AV: "Avianca", CM: "Copa",
  AR: "Aerolíneas Argentinas", ET: "Ethiopian", MS: "EgyptAir",
  SA: "South African", AT: "Royal Air Maroc", KQ: "Kenya Airways",
};

export const airlineName = (code) => AIRLINES[code] ?? code ?? "Airline";
