/**
 * Published train fares — networks that sell at fixed, published prices,
 * so Meridian can show the real fare without a live feed. Only fares we
 * could source are listed; every other hop stays an estimate.
 *
 *   JP  Tokaido–Sanyo Shinkansen (JR Central / JR West): adult, one way,
 *       reserved seat, regular season — fare + limited-express charge.
 *       Source: NAVITIME Tokaido/Sanyo fare table (updated Apr 2025).
 *       JR East's March 2026 revision does not touch these lines; JR
 *       East routes (Tohoku, Joetsu, Hokuriku) are left out until re-checked.
 *       Peak / off-peak seasons move reserved fares by about ±¥200–400.
 *   KR  KTX standard class after the KTX–SRT merger fare cut of
 *       1 Sep 2026 (SBS, Seoul Economic Daily, Korea Firsthand).
 *   TW  Taiwan High Speed Rail standard car, reserved (Taipei tourism
 *       guide 2026; fares unchanged pending new trains).
 *
 * Re-check this table when an operator announces a fare change.
 */
export const FARE_TABLES = {
  JP: {
    currency: "JPY", symbol: "¥", perUsd: 150, operator: "JR",
    book: { label: "smartEX (Shinkansen)", url: "https://smart-ex.jp/en/" },
    basis: "JR published fare · reserved seat · regular season",
    stations: {
      tokyo: [35.6812, 139.7671], nagoya: [35.1709, 136.8815], kyoto: [34.9858, 135.7588],
      osaka: [34.7335, 135.5003], okayama: [34.6664, 133.9176], hiroshima: [34.3976, 132.4754],
      fukuoka: [33.5897, 130.4207],
    },
    // [minutes on the fastest regular service, fare, service]
    fares: {
      "tokyo|nagoya": [94, 11300, "Nozomi"],
      "tokyo|kyoto": [132, 14170, "Nozomi"],
      "tokyo|osaka": [147, 14720, "Nozomi"],
      "tokyo|hiroshima": [231, 19760, "Nozomi"],
      "tokyo|fukuoka": [293, 23810, "Nozomi"],
      "nagoya|okayama": [97, 11610, "Nozomi"],
      "nagoya|hiroshima": [136, 14810, "Nozomi"],
      "nagoya|fukuoka": [198, 19310, "Nozomi"],
      "kyoto|fukuoka": [161, 16780, "Nozomi"],
      "osaka|hiroshima": [90, 10420, "Hikari"],
      "hiroshima|fukuoka": [62, 9630, "Nozomi / Mizuho"],
    },
  },
  KR: {
    currency: "KRW", symbol: "₩", perUsd: 1390, operator: "Korail",
    book: { label: "Korail (Let's Korail)", url: "https://www.letskorail.com/" },
    basis: "KTX published fare · standard class · from 1 Sep 2026",
    stations: { seoul: [37.5547, 126.9707], busan: [35.1151, 129.0422], gwangju: [35.1374, 126.7911] },
    fares: {
      "seoul|busan": [160, 54400, "KTX"],
      "seoul|gwangju": [110, 42000, "KTX"],
    },
  },
  TW: {
    currency: "TWD", symbol: "NT$", perUsd: 31, operator: "THSR",
    book: { label: "Taiwan High Speed Rail", url: "https://en.thsrc.com.tw/" },
    basis: "THSR published fare · standard car · reserved",
    stations: {
      taipei: [25.0478, 121.517], taichung: [24.1123, 120.6157], chiayi: [23.4593, 120.3234],
      tainan: [22.9248, 120.2857], kaohsiung: [22.687, 120.3071],
    },
    fares: {
      "taipei|taichung": [60, 700, "THSR"],
      "taipei|chiayi": [85, 1080, "THSR"],
      "taipei|tainan": [105, 1350, "THSR"],
      "taipei|kaohsiung": [95, 1490, "THSR"],
      "taichung|kaohsiung": [50, 790, "THSR"],
    },
  },
};

const R = 6371;
const kmBetween = (a, b) => {
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** The fare-table station a place is served by (within ~30 km), or null. */
function stationFor(table, p) {
  let best = null, bd = Infinity;
  for (const [id, xy] of Object.entries(table.stations)) {
    const d = kmBetween([p.lat, p.lon], xy);
    if (d < bd) { bd = d; best = id; }
  }
  return bd <= 30 ? best : null;
}

/**
 * The published fare between two places, or null.
 *   a, b: {lat, lon, iso2}
 * → {min, local, usd, currency, symbol, svc, operator, basis, book, jr?}
 */
export function publishedFare(a, b) {
  if (!a?.iso2 || a.iso2 !== b?.iso2) return null;
  const t = FARE_TABLES[a.iso2];
  if (!t) return null;
  const x = stationFor(t, a), y = stationFor(t, b);
  if (!x || !y || x === y) return null;
  const row = t.fares[`${x}|${y}`] ?? t.fares[`${y}|${x}`];
  if (!row) return null;
  const [min, local, svc] = row;
  return {
    min, local, usd: Math.round(local / t.perUsd), currency: t.currency, symbol: t.symbol,
    svc, operator: t.operator, basis: t.basis, book: t.book,
    // JR Pass: covers Hikari/Sakura; Nozomi/Mizuho need the special supplement
    ...(a.iso2 === "JP" ? { jr: /nozomi|mizuho/i.test(svc) ? "hikari" : true } : {}),
  };
}

export const fareText = (f, people = 1) =>
  `${f.symbol}${(f.local * people).toLocaleString("en-US")}`;
