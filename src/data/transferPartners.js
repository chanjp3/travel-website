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
  citiTYP: { name: "Citi ThankYou Points", short: "Citi TYP", kind: "card" },
  bilt:    { name: "Bilt Rewards", short: "Bilt", kind: "card" },
  // airline programs
  virginAtlantic: { name: "Virgin Atlantic Flying Club", short: "Virgin Atlantic", kind: "air" },
  flyingBlue:     { name: "Air France/KLM Flying Blue", short: "Flying Blue", kind: "air" },
  aeroplan:       { name: "Air Canada Aeroplan", short: "Aeroplan", kind: "air" },
  united:         { name: "United MileagePlus", short: "United", kind: "air" },
  delta:          { name: "Delta SkyMiles", short: "Delta", kind: "air" },
  alaska:         { name: "Alaska Mileage Plan", short: "Alaska", kind: "air" },
  ana:            { name: "ANA Mileage Club", short: "ANA", kind: "air" },
  // programs Seats.aero tracks — shown whenever they hold live space, even
  // when no card transfers to them (you may hold their miles directly)
  american:    { name: "American AAdvantage", short: "American", kind: "air" },
  qantas:      { name: "Qantas Frequent Flyer", short: "Qantas", kind: "air" },
  emirates:    { name: "Emirates Skywards", short: "Emirates", kind: "air" },
  etihad:      { name: "Etihad Guest", short: "Etihad", kind: "air" },
  qatar:       { name: "Qatar Privilege Club", short: "Qatar", kind: "air" },
  turkish:     { name: "Turkish Miles&Smiles", short: "Turkish", kind: "air" },
  jetblue:     { name: "JetBlue TrueBlue", short: "JetBlue", kind: "air" },
  velocity:    { name: "Virgin Australia Velocity", short: "Velocity", kind: "air" },
  eurobonus:   { name: "SAS EuroBonus", short: "EuroBonus", kind: "air" },
  aeromexico:  { name: "Aeromexico Rewards", short: "Aeromexico", kind: "air" },
  connectmiles:{ name: "Copa ConnectMiles", short: "Copa", kind: "air" },
  azul:        { name: "Azul Fidelidade", short: "Azul", kind: "air" },
  smiles:      { name: "GOL Smiles", short: "Smiles", kind: "air" },
  // hotel programs
  hyatt:    { name: "World of Hyatt", short: "Hyatt", kind: "hotel" },
  marriott: { name: "Marriott Bonvoy", short: "Marriott", kind: "hotel" },
  hilton:   { name: "Hilton Honors", short: "Hilton", kind: "hotel" },
};

/** card sourceId → { programId: { r, d } } */
export const TRANSFERS = {
  amexMR: {
    virginAtlantic: { r: 1, d: 0 },
    flyingBlue:     { r: 1, d: 0 },
    aeroplan:       { r: 1, d: 0 },
    ana:            { r: 1, d: 3 }, // ANA transfers take ~2–3 days — plan ahead
    delta:          { r: 1, d: 0 },
    emirates:       { r: 1, d: 0 },
    qantas:         { r: 1, d: 0 },
    aeromexico:     { r: 1.6, d: 0 }, // 1:1.6
    jetblue:        { r: 0.8, d: 0 }, // 250:200
    hilton:         { r: 2, d: 0 }, // 1:2
    marriott:       { r: 1, d: 1 },
  },
  chaseUR: {
    united:         { r: 1, d: 0 },
    aeroplan:       { r: 1, d: 0 },
    virginAtlantic: { r: 1, d: 0 },
    flyingBlue:     { r: 1, d: 0 },
    emirates:       { r: 1, d: 0 },
    jetblue:        { r: 1, d: 0 },
    hyatt:          { r: 1, d: 0 }, // the crown jewel of UR
    marriott:       { r: 1, d: 1 },
  },
  citiTYP: {
    flyingBlue:     { r: 1, d: 0 },
    virginAtlantic: { r: 1, d: 0 },
    emirates:       { r: 1, d: 0 },
    etihad:         { r: 1, d: 0 },
    qantas:         { r: 1, d: 0 },
    qatar:          { r: 1, d: 0 },
    turkish:        { r: 1, d: 0 },
    jetblue:        { r: 1, d: 0 },
  },
  bilt: {
    alaska:         { r: 1, d: 0 },
    united:         { r: 1, d: 0 },
    hyatt:          { r: 1, d: 0 },
    virginAtlantic: { r: 1, d: 0 },
    flyingBlue:     { r: 1, d: 0 },
    aeroplan:       { r: 1, d: 0 },
    american:       { r: 1, d: 0 },
    turkish:        { r: 1, d: 0 },
    marriott:       { r: 1, d: 0 },
  },
};

/** Sources the user can hold a balance in (order = display order). */
export const BALANCE_SOURCES = ["amexMR", "chaseUR", "citiTYP", "bilt", "alaska", "hyatt", "marriott", "hilton"];

export const DEFAULT_BALANCES = {
  amexMR: 260000,
  chaseUR: 180000,
  citiTYP: 0,
  bilt: 0,
  alaska: 90000,
  hyatt: 90000,
  marriott: 120000,
  hilton: 150000,
};
