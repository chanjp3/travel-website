/**
 * City dataset for the Japan corridor.
 * `core` cities are pre-selected; the rest are optimizer-aware suggestions
 * carrying the true incremental time/cost of adding them.
 */
export const CITIES = {
  tokyo: {
    name: "Tokyo", jp: "東京", lat: 35.68, lon: 139.69, nights: 3, core: true,
    blurb: "Arrival city for most itineraries — Senso-ji, Shibuya, teamLab, and the best food city on earth.",
  },
  kyoto: {
    name: "Kyoto", jp: "京都", lat: 35.01, lon: 135.77, nights: 3, core: true,
    blurb: "Temples, gardens, and Gion. The cultural anchor of any first Japan trip.",
  },
  osaka: {
    name: "Osaka", jp: "大阪", lat: 34.69, lon: 135.5, nights: 2, core: true,
    blurb: "Street food capital and your likely exit gateway via KIX.",
  },
  hakone: {
    name: "Hakone", jp: "箱根", lat: 35.23, lon: 139.03, nights: 1,
    why: "Sits directly on the Tokaido corridor between Tokyo and Kyoto — an onsen night with Mt. Fuji views costs almost no detour.",
    addTime: "+1h 10m travel", addCost: "≈ $46 rail",
    blurb: "Onsen ryokan, the ropeway over Owakudani, Lake Ashi.",
  },
  nara: {
    name: "Nara", jp: "奈良", lat: 34.69, lon: 135.83, nights: 1,
    why: "45 minutes from Kyoto or Osaka. Todai-ji's Great Buddha and the bowing deer — works as an overnight or a day trip.",
    addTime: "+1h 35m travel", addCost: "≈ $10 rail",
    blurb: "Great Buddha, Nara Park, Kasuga Taisha lanterns.",
  },
  hiroshima: {
    name: "Hiroshima", jp: "広島", lat: 34.39, lon: 132.46, nights: 1,
    why: "1h 25m past Osaka on the Sanyo Shinkansen. Peace Memorial plus the Miyajima floating torii justify the western extension.",
    addTime: "+2h 50m travel", addCost: "≈ $142 rail",
    blurb: "Peace Memorial Park, Miyajima island, okonomiyaki.",
  },
  kanazawa: {
    name: "Kanazawa", jp: "金沢", lat: 36.56, lon: 136.66, nights: 1,
    why: "The Hokuriku arc (Tokyo → Kanazawa → Kyoto) sees a fraction of the tourists — Kenroku-en garden and a preserved geisha district.",
    addTime: "+2h 20m travel", addCost: "≈ $95 rail",
    blurb: "Kenroku-en, Higashi Chaya district, Omicho market.",
  },
};
