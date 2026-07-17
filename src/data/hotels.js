/**
 * Hotel shortlists per city, scored on `view` and `quality` (0–10).
 * Static seed data — the production version derives these scores from
 * Google Places ratings/photos + review-text signals, with live award
 * rates from hotel program APIs (docs/mvp-plan.md §7).
 */
export const HOTELS = {
  tokyo: [
    { name: "Park Hyatt Tokyo", program: "Hyatt", pid: "hyatt", pts: 45000, cash: 950, view: 9.6, quality: 9.5,
      note: "52nd-floor Shinjuku skyline — the Lost in Translation view" },
    { name: "Andaz Tokyo Toranomon Hills", program: "Hyatt", pid: "hyatt", pts: 40000, cash: 780, view: 9.2, quality: 9.1,
      note: "Bay and Tokyo Tower from the 47th-floor rooftop bar" },
    { name: "Conrad Tokyo", program: "Hilton", pid: "hilton", pts: 95000, cash: 620, view: 9.0, quality: 8.9,
      note: "Hamarikyu Gardens and the bay from every room" },
    { name: "Prince Park Tower", program: "Marriott", pid: "marriott", pts: 60000, cash: 420, view: 8.7, quality: 8.2,
      note: "Tokyo Tower fills the window on the east side" },
  ],
  hakone: [
    { name: "Hyatt Regency Hakone", program: "Hyatt", pid: "hyatt", pts: 25000, cash: 540, view: 8.8, quality: 8.8,
      note: "Mountain onsen resort — exceptional points value" },
    { name: "Hakone Kowakien Ten-yu", program: "cash", pid: null, pts: null, cash: 610, view: 9.1, quality: 9.0,
      note: "Open-air infinity onsen over the valley" },
  ],
  kanazawa: [
    { name: "Hyatt Centric Kanazawa", program: "Hyatt", pid: "hyatt", pts: 17000, cash: 250, view: 7.8, quality: 8.4,
      note: "Steps from the station, modern and quiet" },
    { name: "Korinkyo", program: "cash", pid: null, pts: null, cash: 220, view: 7.5, quality: 8.6,
      note: "Design ryokan near the Higashi Chaya district" },
  ],
  kyoto: [
    { name: "Park Hyatt Kyoto", program: "Hyatt", pid: "hyatt", pts: 45000, cash: 1250, view: 9.7, quality: 9.6,
      note: "Yasaka Pagoda framed from the terrace — best view in the city" },
    { name: "The Ritz-Carlton Kyoto", program: "Marriott", pid: "marriott", pts: 110000, cash: 1450, view: 9.3, quality: 9.5,
      note: "Kamogawa river and the Higashiyama hills" },
    { name: "Hotel The Mitsui Kyoto", program: "cash", pid: null, pts: null, cash: 980, view: 8.9, quality: 9.4,
      note: "Private onsen and a 300-year-old gate" },
    { name: "Hyatt Place Kyoto", program: "Hyatt", pid: "hyatt", pts: 12000, cash: 190, view: 7.2, quality: 8.0,
      note: "The value play — save points for Park Hyatt Tokyo" },
  ],
  nara: [
    { name: "JW Marriott Nara", program: "Marriott", pid: "marriott", pts: 55000, cash: 480, view: 8.2, quality: 9.0,
      note: "First international luxury flag in Nara" },
    { name: "Noborioji Hotel", program: "cash", pid: null, pts: null, cash: 520, view: 8.5, quality: 8.8,
      note: "Boutique property beside Nara Park" },
  ],
  osaka: [
    { name: "Conrad Osaka", program: "Hilton", pid: "hilton", pts: 80000, cash: 520, view: 9.5, quality: 9.2,
      note: "40th-floor 'above the clouds' river and bay panorama" },
    { name: "St. Regis Osaka", program: "Marriott", pid: "marriott", pts: 70000, cash: 600, view: 8.4, quality: 9.1,
      note: "Midosuji polish, butler service" },
    { name: "W Osaka", program: "Marriott", pid: "marriott", pts: 75000, cash: 560, view: 8.3, quality: 8.9,
      note: "Tadao Ando-designed tower in Shinsaibashi" },
    { name: "Zentis Osaka", program: "cash", pid: null, pts: null, cash: 310, view: 7.6, quality: 8.7,
      note: "Design-forward boutique, superb breakfast" },
  ],
  hiroshima: [
    { name: "Hilton Hiroshima", program: "Hilton", pid: "hilton", pts: 60000, cash: 280, view: 8.6, quality: 8.7,
      note: "Upper floors face the Seto Inland Sea" },
    { name: "Sheraton Grand Hiroshima", program: "Marriott", pid: "marriott", pts: 35000, cash: 250, view: 7.9, quality: 8.3,
      note: "Connected to the Shinkansen station" },
  ],
};
