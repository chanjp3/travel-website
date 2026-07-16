/**
 * Rail network for the Japan corridor.
 * Times/fares reflect published schedules (reserved seat, ordinary class).
 * `jr` flags JR Pass coverage: true = fully covered, "hikari" = covered if
 * you take Hikari instead of Nozomi (times shown are Nozomi), "part" = mixed.
 *
 * The network is stable enough to encode directly; a GTFS-backed refresh
 * job is the eventual replacement (see docs/mvp-plan.md §7).
 */
export const RAIL = {
  "tokyo|hakone":      { min: 62,  yen: 3280,  svc: "Kodama → Odawara + local", jr: true },
  "tokyo|kyoto":       { min: 135, yen: 14170, svc: "Nozomi (Tokaido Shinkansen)", jr: "hikari" },
  "tokyo|osaka":       { min: 150, yen: 14720, svc: "Nozomi (Tokaido Shinkansen)", jr: "hikari" },
  "tokyo|kanazawa":    { min: 152, yen: 14380, svc: "Kagayaki (Hokuriku Shinkansen)", jr: true },
  "tokyo|nara":        { min: 190, yen: 14890, svc: "Nozomi → Kyoto + JR Nara Line", jr: "hikari" },
  "tokyo|hiroshima":   { min: 237, yen: 19440, svc: "Nozomi (Tokaido–Sanyo)", jr: "hikari" },
  "hakone|kyoto":      { min: 128, yen: 13870, svc: "Hikari from Odawara", jr: true },
  "hakone|osaka":      { min: 143, yen: 14420, svc: "Hikari from Odawara", jr: true },
  "hakone|nara":       { min: 183, yen: 14590, svc: "Hikari → Kyoto + JR Nara Line", jr: true },
  "hakone|kanazawa":   { min: 218, yen: 17660, svc: "back via Tokyo, Kagayaki", jr: true },
  "hakone|hiroshima":  { min: 230, yen: 19140, svc: "Hikari → Nozomi via Shin-Osaka", jr: "part" },
  "kanazawa|kyoto":    { min: 135, yen: 9410,  svc: "Tsurugi → Tsuruga → Thunderbird", jr: true },
  "kanazawa|osaka":    { min: 160, yen: 10130, svc: "Tsurugi → Thunderbird", jr: true },
  "kanazawa|nara":     { min: 195, yen: 10130, svc: "Thunderbird → Kyoto + JR Nara", jr: true },
  "kanazawa|hiroshima":{ min: 250, yen: 19540, svc: "Thunderbird → Nozomi", jr: "part" },
  "kyoto|nara":        { min: 45,  yen: 720,   svc: "JR Nara Line rapid", jr: true },
  "kyoto|osaka":       { min: 29,  yen: 580,   svc: "JR Special Rapid", jr: true },
  "kyoto|hiroshima":   { min: 100, yen: 11290, svc: "Nozomi (Sanyo Shinkansen)", jr: "hikari" },
  "nara|osaka":        { min: 50,  yen: 810,   svc: "JR Yamatoji rapid", jr: true },
  "nara|hiroshima":    { min: 160, yen: 11700, svc: "JR → Shin-Osaka → Nozomi", jr: "part" },
  "osaka|hiroshima":   { min: 85,  yen: 10620, svc: "Nozomi (Sanyo Shinkansen)", jr: "hikari" },
};

/** Symmetric edge lookup. */
export const edge = (a, b) => RAIL[`${a}|${b}`] || RAIL[`${b}|${a}`];

export const GATEWAYS = {
  HND: { name: "Tokyo Haneda", city: "Tokyo", lat: 35.55, lon: 139.78 },
  KIX: { name: "Osaka Kansai", city: "Osaka", lat: 34.43, lon: 135.24 },
};

/**
 * Door-to-door rail access from each city to each international gateway
 * (minutes / yen). Used by the optimizer to choose entry/exit airports.
 */
export const ACCESS = {
  tokyo:     { HND: { min: 30,  yen: 700 },   KIX: { min: 230, yen: 18170 } },
  hakone:    { HND: { min: 95,  yen: 3900 },  KIX: { min: 220, yen: 17800 } },
  kanazawa:  { HND: { min: 185, yen: 15080 }, KIX: { min: 235, yen: 13500 } },
  kyoto:     { HND: { min: 165, yen: 14870 }, KIX: { min: 78,  yen: 3110 } },
  nara:      { HND: { min: 220, yen: 15590 }, KIX: { min: 95,  yen: 2410 } },
  osaka:     { HND: { min: 180, yen: 15420 }, KIX: { min: 50,  yen: 1210 } },
  hiroshima: { HND: { min: 267, yen: 20140 }, KIX: { min: 155, yen: 11830 } },
};
