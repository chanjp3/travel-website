/**
 * Transfer-partner reference data.
 *
 * This is REAL, static, public information (unlike award availability):
 * which transferable-points currencies move to which loyalty programs,
 * at what ratio, and roughly how fast. Review quarterly — partners and
 * transfer bonuses change a few times a year.
 *
 * ratio `r` = program points received per card point.
 * days  `d` = typical transfer time in days (0 = instant/same-day).
 */

export const SOURCES = {
  // transferable card currencies
  amexMR:  { name: "Amex Membership Rewards", short: "Amex MR", kind: "card" },
  chaseUR: { name: "Chase Ultimate Rewards", short: "Chase UR", kind: "card" },
  bilt:    { name: "Bilt Rewards", short: "Bilt", kind: "card" },
  // airline programs
  virginAtlantic: { name: "Virgin Atlantic Flying Club", short: "Virgin Atlantic", kind: "air" },
  aeroplan:       { name: "Air Canada Aeroplan", short: "Aeroplan", kind: "air" },
  united:         { name: "United MileagePlus", short: "United", kind: "air" },
  delta:          { name: "Delta SkyMiles", short: "Delta", kind: "air" },
  alaska:         { name: "Alaska Mileage Plan", short: "Alaska", kind: "air" },
  ana:            { name: "ANA Mileage Club", short: "ANA", kind: "air" },
  // hotel programs
  hyatt:    { name: "World of Hyatt", short: "Hyatt", kind: "hotel" },
  marriott: { name: "Marriott Bonvoy", short: "Marriott", kind: "hotel" },
  hilton:   { name: "Hilton Honors", short: "Hilton", kind: "hotel" },
};

/** card sourceId → { programId: { r, d } } */
export const TRANSFERS = {
  amexMR: {
    virginAtlantic: { r: 1, d: 0 },
    aeroplan:       { r: 1, d: 0 },
    ana:            { r: 1, d: 3 }, // ANA transfers take ~2–3 days — plan ahead
    delta:          { r: 1, d: 0 },
    hilton:         { r: 2, d: 0 }, // 1:2
    marriott:       { r: 1, d: 1 },
  },
  chaseUR: {
    united:         { r: 1, d: 0 },
    aeroplan:       { r: 1, d: 0 },
    virginAtlantic: { r: 1, d: 0 },
    hyatt:          { r: 1, d: 0 }, // the crown jewel of UR
    marriott:       { r: 1, d: 1 },
  },
  bilt: {
    alaska:         { r: 1, d: 0 },
    united:         { r: 1, d: 0 },
    hyatt:          { r: 1, d: 0 },
    virginAtlantic: { r: 1, d: 0 },
    aeroplan:       { r: 1, d: 0 },
    marriott:       { r: 1, d: 0 },
  },
};

/** Sources the user can hold a balance in (order = display order). */
export const BALANCE_SOURCES = ["amexMR", "chaseUR", "bilt", "alaska", "hyatt", "marriott", "hilton"];

export const DEFAULT_BALANCES = {
  amexMR: 260000,
  chaseUR: 180000,
  bilt: 0,
  alaska: 90000,
  hyatt: 90000,
  marriott: 120000,
  hilton: 150000,
};
