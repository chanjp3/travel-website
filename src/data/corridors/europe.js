/**
 * Europe rail pack (lite) — headline high-speed corridors only.
 * Times = typical fastest service; fares = typical advance-purchase USD.
 * Full pack later via Trainline Partner / Rail Europe APIs.
 */
const E = {
  "london|paris":      { min: 136, usd: 90,  svc: "Eurostar" },
  "london|brussels":   { min: 116, usd: 80,  svc: "Eurostar" },
  "london|amsterdam":  { min: 240, usd: 110, svc: "Eurostar direct" },
  "london|edinburgh":  { min: 260, usd: 95,  svc: "LNER Azuma" },
  "paris|amsterdam":   { min: 200, usd: 75,  svc: "Eurostar (ex-Thalys)" },
  "paris|brussels":    { min: 82,  usd: 55,  svc: "Eurostar (ex-Thalys)" },
  "paris|zurich":      { min: 244, usd: 85,  svc: "TGV Lyria" },
  "paris|geneva":      { min: 190, usd: 80,  svc: "TGV Lyria" },
  "paris|barcelona":   { min: 400, usd: 110, svc: "TGV InOui" },
  "madrid|barcelona":  { min: 150, usd: 70,  svc: "AVE" },
  "zurich|milan":      { min: 197, usd: 70,  svc: "EuroCity via Gotthard" },
  "geneva|zurich":     { min: 165, usd: 45,  svc: "SBB InterCity" },
  "milan|florence":    { min: 105, usd: 55,  svc: "Frecciarossa" },
  "milan|venice":      { min: 145, usd: 50,  svc: "Frecciarossa" },
  "florence|rome":     { min: 92,  usd: 50,  svc: "Frecciarossa" },
  "florence|venice":   { min: 125, usd: 55,  svc: "Frecciarossa" },
  "rome|venice":       { min: 225, usd: 70,  svc: "Frecciarossa" },
  "munich|vienna":     { min: 240, usd: 65,  svc: "Railjet" },
  "vienna|prague":     { min: 240, usd: 45,  svc: "Railjet" },
  "berlin|prague":     { min: 255, usd: 50,  svc: "EuroCity" },
  "berlin|munich":     { min: 235, usd: 80,  svc: "ICE Sprinter" },
  "amsterdam|brussels":{ min: 105, usd: 45,  svc: "Eurostar (ex-Thalys)" },
  "amsterdam|berlin":  { min: 370, usd: 70,  svc: "IC Berlin" },
  "frankfurt|paris":   { min: 226, usd: 80,  svc: "ICE/TGV" },
  "frankfurt|munich":  { min: 190, usd: 65,  svc: "ICE" },
  "frankfurt|amsterdam":{min: 240, usd: 70,  svc: "ICE" },
};
export const europe = {
  id: "europe",
  name: "Europe",
  cities: [...new Set(Object.keys(E).flatMap((k) => k.split("|")))],
  edge: (a, b) => E[`${a}|${b}`] || E[`${b}|${a}`] || null,
  hotels: {},
  attractions: {},
  suggestions: [],
  hasJrPass: false,
};
