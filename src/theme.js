/**
 * Design tokens — Meridian, cool edition: a private itinerary on cool
 * grey-blue paper. Midnight ink · steel blue for routes and accents ·
 * sea green for points · cool crimson for alerts. Same token names as
 * before — the whole app reskins from here (the map flow reads the same
 * palette from src/atlas/meridian.css, the share page from share.css).
 */
export const T = {
  ink: "#121A26",                       // primary text — midnight
  inkSoft: "#5A6B7E",                   // slate
  paper: "#EEF2F6",                     // page background — cool grey-blue
  card: "#F7F9FB",                      // raised panels
  deep: "#121A26",                      // dark filled buttons / hero panels
  mist: "#CBD5E1",                      // hairline borders
  rail: "#4A5B6E", // slate — ground/rail segments
  railTint: "rgba(74,91,110,.10)",
  flight: "#1F6F9F", // steel blue — flight segments, primary accent
  flightTint: "rgba(31,111,159,.10)",
  pine: "#1F7A5C", // savings / points-positive — sea green
  pineTint: "rgba(31,122,92,.10)",
  gold: "#2E7D9A", // badges, chosen hotel — teal
  goldTint: "rgba(46,125,154,.12)",
};

/** Display conversion rate, ¥ per USD. Replace with a live FX feed later. */
export const JPY = 150;
