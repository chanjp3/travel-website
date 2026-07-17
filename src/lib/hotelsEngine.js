/**
 * Hotel engine — pack shortlists where we have them (Japan), generated
 * SAMPLE properties elsewhere. Live mode replaces the generator with
 * Amadeus hotel search + Google Places scoring.
 */
import { packFor } from "../data/corridors/index.js";
import { cityById } from "../data/world.js";

const PRICE_INDEX = { NA: 1.0, EU: 1.05, NEASIA: 0.95, SEASIA: 0.55, SASIA: 0.5, ME: 0.9, OCE: 1.0, SA: 0.6, AF: 0.6 };

export function hotelsFor(cityId) {
  const pack = packFor(cityId);
  if (pack?.hotels?.[cityId]?.length) return { hotels: pack.hotels[cityId], sample: false };
  const c = cityById[cityId];
  const ix = PRICE_INDEX[c.region] ?? 1;
  // Geocoded towns: humble local samples — live search finds the real
  // properties (and flags points brands) once connected.
  if (c.custom) {
    const base = Math.round(150 * ix);
    return {
      sample: true,
      hotels: [
        { name: `${c.name} boutique inn`, program: "cash", pid: null,
          pts: null, cash: Math.round(base * 1.15), view: 8.2, quality: 8.4,
          note: "Local independent — sample until live rates load" },
        { name: `${c.name} guesthouse`, program: "cash", pid: null,
          pts: null, cash: Math.round(base * 0.7), view: 7.6, quality: 8.0,
          note: "Sample listing — live search finds real properties here" },
      ],
    };
  }
  const base = Math.round(240 * ix);
  return {
    sample: true,
    hotels: [
      { name: `Park Hyatt ${c.name}`, program: "Hyatt", pid: "hyatt",
        pts: 35000, cash: Math.round(base * 2.6), view: 9.2, quality: 9.3,
        note: "Top-floor flagship — sample listing pending live hotel search" },
      { name: `Conrad ${c.name}`, program: "Hilton", pid: "hilton",
        pts: 80000, cash: Math.round(base * 1.9), view: 8.9, quality: 8.9,
        note: "High-floor views — sample listing pending live hotel search" },
      { name: `${c.name} Marriott`, program: "Marriott", pid: "marriott",
        pts: 50000, cash: Math.round(base * 1.3), view: 8.0, quality: 8.3,
        note: "Reliable points redemption — sample listing" },
      { name: `Boutique stay · ${c.name}`, program: "cash", pid: null,
        pts: null, cash: Math.round(base * 0.9), view: 7.8, quality: 8.6,
        note: "Local independent — sample listing" },
    ],
  };
}
