/**
 * "Verify & book" deep links — straight into each loyalty program's own
 * award search for the exact route, date, and cabin. The airline's site is
 * the ultimate live availability check: cached data finds the deal, the
 * deep link confirms and books it. Programs without a stable deep-link
 * format land on the program's site. Best-effort — airlines change URLs.
 */
const PROGRAM_HOME = {
  flyingBlue: "https://www.flyingblue.com/",
  american: "https://www.aa.com/",
  qantas: "https://www.qantas.com/",
  emirates: "https://www.emirates.com/",
  etihad: "https://www.etihadguest.com/",
  qatar: "https://www.qatarairways.com/en-us/Privilege-Club.html",
  turkish: "https://www.turkishairlines.com/",
  jetblue: "https://www.jetblue.com/",
  velocity: "https://experience.velocityfrequentflyer.com/",
  eurobonus: "https://www.flysas.com/",
  aeromexico: "https://www.aeromexico.com/",
  connectmiles: "https://www.copaair.com/",
  azul: "https://www.voeazul.com.br/",
  smiles: "https://www.smiles.com.br/",
  ana: "https://www.ana.co.jp/en/us/amc/",
};

/** Live cash comparison without any API relationship: a Google Flights
 *  search pre-filled with the exact route, date, and cabin. Real routes,
 *  real prices, one click — the planning answer that needs no key. */
export function cashSearchLink(from, to, date, cabin) {
  if (!from || !to || !date) return null;
  const q = `Flights from ${from} to ${to} on ${date} one way${cabin === "Business" ? " business class" : ""}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

/** Hand the search to the user's seats.aero Pro login — their website runs
 *  the LIVE award search that the Partner API tier withholds. */
export function seatsSearchLink(from, to, date) {
  if (!from || !to || !date) return null;
  return `https://seats.aero/search?origin_airport=${from}&destination_airport=${to}&start_date=${date}&end_date=${date}`;
}

export function bookLink(programId, from, to, date, cabin) {
  if (!programId || !from || !to || !date) return null;
  const biz = cabin === "Business";
  switch (programId) {
    case "united":
      return `https://www.united.com/en/us/fsr/choose-flights?f=${from}&t=${to}&d=${date}&tt=1&at=1&sc=7&px=1&taxng=1&awardTravel=true`;
    case "aeroplan":
      return `https://www.aircanada.com/aeroplan/redeem/availability/outbound?org0=${from}&dest0=${to}&departureDate0=${date}&lang=en-CA&tripType=O&ADT=1&YTH=0&CHD=0&INF=0&INS=0&marketCode=TNB`;
    case "alaska":
      return `https://www.alaskaair.com/search/results?A=1&O=${from}&D=${to}&OD=${date}&OT=Award&RT=false${biz ? "&FT=jf" : ""}`;
    case "delta":
      return `https://www.delta.com/flight-search/search?action=findFlights&tripType=ONE_WAY&priceSchedule=AWARD&originCity=${from}&destinationCity=${to}&departureDate=${date}`;
    case "virginAtlantic": // Virgin's site runs on the same platform as Delta's
      return `https://www.virginatlantic.com/flight-search/search?action=findFlights&tripType=ONE_WAY&priceSchedule=award&originCity=${from}&destinationCity=${to}&departureDate=${date}`;
    default:
      return PROGRAM_HOME[programId] ?? null;
  }
}
