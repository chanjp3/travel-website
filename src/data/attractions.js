/**
 * Attractions per city with realistic visit durations (hours).
 * The itinerary builder consumes these in order, packing days by duration.
 * Production version pulls from Google Places + an LLM curation layer.
 */
export const ATTRACTIONS = {
  tokyo: [
    { n: "Tsukiji Outer Market breakfast", h: 1.5 },
    { n: "Senso-ji & Asakusa", h: 2 },
    { n: "teamLab Planets", h: 2 },
    { n: "Meiji Shrine & Harajuku", h: 2.5 },
    { n: "Shibuya Crossing & Shibuya Sky", h: 2 },
    { n: "Ginza & Imperial Palace East Gardens", h: 2.5 },
    { n: "Akihabara evening", h: 2 },
    { n: "Golden Gai / Omoide Yokocho dinner", h: 2.5 },
  ],
  hakone: [
    { n: "Hakone Ropeway & Owakudani", h: 2.5 },
    { n: "Lake Ashi pirate-ship cruise", h: 1.5 },
    { n: "Open-Air Museum", h: 2 },
    { n: "Onsen evening at the ryokan", h: 2.5 },
  ],
  kanazawa: [
    { n: "Kenroku-en Garden", h: 2 },
    { n: "Higashi Chaya geisha district", h: 1.5 },
    { n: "Omicho Market lunch", h: 1.5 },
    { n: "21st Century Museum of Art", h: 1.5 },
  ],
  kyoto: [
    { n: "Fushimi Inari at dawn", h: 2.5 },
    { n: "Kiyomizu-dera & Higashiyama walk", h: 3 },
    { n: "Arashiyama bamboo grove & Tenryu-ji", h: 3 },
    { n: "Kinkaku-ji (Golden Pavilion)", h: 1.5 },
    { n: "Nishiki Market lunch", h: 1.5 },
    { n: "Gion evening walk", h: 2 },
  ],
  nara: [
    { n: "Todai-ji Great Buddha", h: 2 },
    { n: "Nara Park & the bowing deer", h: 1.5 },
    { n: "Kasuga Taisha lantern paths", h: 1.5 },
  ],
  osaka: [
    { n: "Osaka Castle & park", h: 2 },
    { n: "Kuromon Market grazing lunch", h: 1.5 },
    { n: "Umeda Sky Building at sunset", h: 1.5 },
    { n: "Dotonbori neon & street food", h: 2.5 },
  ],
  hiroshima: [
    { n: "Peace Memorial Park & Museum", h: 2.5 },
    { n: "Miyajima & the floating torii", h: 4 },
    { n: "Okonomimura dinner", h: 1.5 },
  ],
};
