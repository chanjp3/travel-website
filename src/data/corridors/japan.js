/** Japan corridor pack — full depth: rail, airport access, hotels, attractions. */
import { RAIL, edge as railLookup, ACCESS, GATEWAYS } from "../rail.js";
import { HOTELS } from "../hotels.js";
import { ATTRACTIONS } from "../attractions.js";

export const japan = {
  id: "japan",
  name: "Japan",
  cities: ["tokyo", "kyoto", "osaka", "hakone", "nara", "hiroshima", "kanazawa"],
  gateways: GATEWAYS,
  access: ACCESS,
  edge: (a, b) => {
    const e = railLookup(a, b);
    return e ? { min: e.min, usd: e.yen / 150, yen: e.yen, svc: e.svc, jr: e.jr } : null;
  },
  hotels: HOTELS,
  attractions: ATTRACTIONS,
  suggestions: ["hakone", "nara", "kanazawa", "hiroshima"],
  hasJrPass: true,
};
