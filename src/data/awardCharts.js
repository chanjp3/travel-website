/**
 * ── AWARD ESTIMATE ENGINE (data) ──
 * Typical one-way saver-level award prices by region pair, per program.
 * These are ESTIMATES from published charts and observed pricing — they set
 * expectations until live availability (Seats.aero Partner API) is wired in.
 * pts = per person one-way; fees = typical USD surcharges+taxes.
 */
export const AWARD_CHARTS = {
  "NA|NEASIA": [
    { programId: "virginAtlantic", airline: "ANA", cabin: "Business", pts: 60000, fees: 310 },
    { programId: "virginAtlantic", airline: "ANA", cabin: "Economy",  pts: 32500, fees: 290 },
    { programId: "alaska",   airline: "JAL",              cabin: "Business", pts: 80000, fees: 95 },
    { programId: "alaska",   airline: "JAL/AA",           cabin: "Economy",  pts: 42500, fees: 60 },
    { programId: "aeroplan", airline: "United/ANA",       cabin: "Business", pts: 88000, fees: 85 },
    { programId: "aeroplan", airline: "United/ANA",       cabin: "Economy",  pts: 55000, fees: 60 },
    { programId: "united",   airline: "United (saver)",   cabin: "Economy",  pts: 44000, fees: 6 },
    { programId: "delta",    airline: "Delta One",        cabin: "Business", pts: 120000, fees: 45 },
  ],
  "EU|NA": [
    { programId: "virginAtlantic", airline: "Virgin/Delta", cabin: "Business", pts: 47500, fees: 320 },
    { programId: "virginAtlantic", airline: "Virgin/Delta", cabin: "Economy",  pts: 20000, fees: 190 },
    { programId: "flyingBlue", airline: "Air France/KLM/Delta", cabin: "Business", pts: 60000, fees: 250 },
    { programId: "flyingBlue", airline: "Air France/KLM/Delta", cabin: "Economy",  pts: 25000, fees: 130 },
    { programId: "aeroplan", airline: "United/Lufthansa/AC", cabin: "Business", pts: 60000, fees: 120 },
    { programId: "aeroplan", airline: "Star Alliance",       cabin: "Economy",  pts: 35000, fees: 90 },
    { programId: "alaska",   airline: "AA/BA/Iberia",        cabin: "Business", pts: 60000, fees: 250 },
    { programId: "united",   airline: "United (saver)",      cabin: "Economy",  pts: 33000, fees: 6 },
    { programId: "delta",    airline: "Delta One",           cabin: "Business", pts: 100000, fees: 60 },
  ],
  "NA|SEASIA": [
    { programId: "aeroplan", airline: "Star Alliance",  cabin: "Business", pts: 105000, fees: 90 },
    { programId: "aeroplan", airline: "Star Alliance",  cabin: "Economy",  pts: 60000,  fees: 70 },
    { programId: "alaska",   airline: "JAL/Cathay",     cabin: "Business", pts: 85000,  fees: 90 },
    { programId: "united",   airline: "United (saver)", cabin: "Economy",  pts: 50000,  fees: 6 },
  ],
  "NA|OCE": [
    { programId: "aeroplan", airline: "United/Air Canada", cabin: "Business", pts: 110000, fees: 90 },
    { programId: "alaska",   airline: "Qantas/Fiji",       cabin: "Business", pts: 110000, fees: 80 },
    { programId: "united",   airline: "United (saver)",    cabin: "Economy",  pts: 55000,  fees: 6 },
    { programId: "delta",    airline: "Delta One",         cabin: "Business", pts: 150000, fees: 60 },
  ],
  "NA|SA": [
    { programId: "aeroplan", airline: "Star Alliance",  cabin: "Business", pts: 60000, fees: 70 },
    { programId: "aeroplan", airline: "Star Alliance",  cabin: "Economy",  pts: 35000, fees: 50 },
    { programId: "alaska",   airline: "LATAM/AA",       cabin: "Business", pts: 45000, fees: 40 },
    { programId: "united",   airline: "United (saver)", cabin: "Economy",  pts: 30000, fees: 6 },
    { programId: "delta",    airline: "Delta One",      cabin: "Business", pts: 90000, fees: 45 },
  ],
  "NA|NA": [
    { programId: "united",   airline: "United (saver)", cabin: "Economy",  pts: 12500, fees: 6 },
    { programId: "alaska",   airline: "Alaska/AA",      cabin: "Economy",  pts: 12500, fees: 6 },
    { programId: "delta",    airline: "Delta",          cabin: "Economy",  pts: 15000, fees: 6 },
    { programId: "aeroplan", airline: "United/AC",      cabin: "Business", pts: 25000, fees: 30 },
  ],
  "EU|NEASIA": [
    { programId: "aeroplan", airline: "Star Alliance", cabin: "Business", pts: 85000, fees: 150 },
    { programId: "aeroplan", airline: "Star Alliance", cabin: "Economy",  pts: 50000, fees: 100 },
    { programId: "alaska",   airline: "JAL/Finnair",   cabin: "Business", pts: 75000, fees: 130 },
  ],
  "ME|NA": [
    { programId: "aeroplan", airline: "Star Alliance", cabin: "Business", pts: 85000, fees: 90 },
    { programId: "alaska",   airline: "Qatar",         cabin: "Business", pts: 85000, fees: 80 },
    { programId: "united",   airline: "United/Turkish",cabin: "Economy",  pts: 44000, fees: 20 },
  ],
  "AF|NA": [
    { programId: "aeroplan", airline: "Star Alliance", cabin: "Business", pts: 100000, fees: 100 },
    { programId: "united",   airline: "Star Alliance", cabin: "Economy",  pts: 50000,  fees: 30 },
  ],
  "NA|SASIA": [
    { programId: "aeroplan", airline: "Star Alliance", cabin: "Business", pts: 105000, fees: 90 },
    { programId: "united",   airline: "Star Alliance", cabin: "Economy",  pts: 55000,  fees: 20 },
  ],
  // regional shorts (intra-region, non-NA)
  "EU|EU": [
    { programId: "aeroplan", airline: "Star Alliance", cabin: "Economy", pts: 10000, fees: 40 },
    { programId: "alaska",   airline: "BA/Iberia",     cabin: "Economy", pts: 12500, fees: 50 },
  ],
  "NEASIA|NEASIA": [
    { programId: "alaska",   airline: "JAL/Cathay",    cabin: "Economy", pts: 15000, fees: 30 },
    { programId: "aeroplan", airline: "ANA/Star",      cabin: "Economy", pts: 15000, fees: 30 },
  ],
  "NEASIA|SEASIA": [
    { programId: "alaska",   airline: "JAL/Cathay",    cabin: "Economy",  pts: 20000, fees: 35 },
    { programId: "aeroplan", airline: "Star Alliance", cabin: "Business", pts: 45000, fees: 60 },
  ],
  "SA|SA": [
    { programId: "aeroplan", airline: "Star Alliance", cabin: "Economy", pts: 12500, fees: 30 },
  ],
};

/** Fallback when no chart exists for a pair: distance-scaled Aeroplan-style estimate. */
export function fallbackAwards(distKm) {
  const econ = Math.round((12500 + distKm * 4.2) / 500) * 500;
  return [
    { programId: "aeroplan", airline: "Star Alliance", cabin: "Economy",  pts: econ, fees: 60, fallback: true },
    { programId: "aeroplan", airline: "Star Alliance", cabin: "Business", pts: Math.round(econ * 2.1 / 500) * 500, fees: 90, fallback: true },
  ];
}
