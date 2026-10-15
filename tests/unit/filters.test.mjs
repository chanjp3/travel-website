/**
 * filters — Google Flights-style controls shared by the map flow and the desk.
 *   airlinesOf() / airlineOptions()  which airlines a row carries, and the chips
 *   filterFlights()                  airline choice, layover length (min / max)
 * All rows here are made up.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { airlinesOf, airlineOptions, filterFlights } from "../../src/lib/flightFilters.js";

const seg = (from, to, dep, arr, carrier) => ({ from, to, dep, arr, carrier, num: "1" });
const rows = [
  { id: "nonstop-dl", cash: 900, airline: "Delta", segs: [seg("TPA", "NRT", "2026-12-10T09:00:00", "2026-12-11T13:00:00", "DL")] },
  { id: "ua-via-ord", cash: 700, airline: "United", segs: [seg("TPA", "ORD", "2026-12-10T06:00:00", "2026-12-10T08:00:00", "UA"), seg("ORD", "NRT", "2026-12-10T12:30:00", "2026-12-11T16:00:00", "NH")] },
  { id: "as-plus-nh", cash: 800, airline: "Alaska + ANA", selfTransfer: true, hub: "SEA", segs: [seg("TPA", "SEA", "2026-12-10T07:00:00", "2026-12-10T10:30:00", "AS"), seg("SEA", "NRT", "2026-12-10T13:00:00", "2026-12-11T16:00:00", "NH")] },
  { id: "seed-award", points: 60000, programId: "x", airline: "Hawaiian/Alaska" },
];

test("airlinesOf names every operating carrier, plus the row's own label", () => {
  assert.deepEqual(airlinesOf(rows[1]), ["United", "ANA"]);
  assert.deepEqual(airlinesOf(rows[2]), ["Alaska", "ANA"]);
  assert.deepEqual(airlinesOf(rows[3]), ["Hawaiian", "Alaska"]);
});

test("airlineOptions lists airlines across rows, most frequent first, then by name", () => {
  // Alaska and ANA appear twice each; the tie breaks alphabetically.
  assert.deepEqual(airlineOptions(rows), ["Alaska", "ANA", "Delta", "Hawaiian", "United"]);
});

test("choosing an airline keeps rows where any leg is on it", () => {
  assert.deepEqual(filterFlights(rows, { airlines: ["ANA"] }).map((r) => r.id), ["ua-via-ord", "as-plus-nh"]);
  assert.deepEqual(filterFlights(rows, { airlines: ["Delta", "Hawaiian"] }).map((r) => r.id), ["nonstop-dl", "seed-award"]);
  assert.equal(filterFlights(rows, { airlines: [] }).length, 4);
});

test("layover caps judge only rows whose layover times are known", () => {
  // ORD layover 4h30, SEA layover 2h30; the nonstop and the seed row have none.
  assert.deepEqual(filterFlights(rows, { layMax: 180 }).map((r) => r.id), ["nonstop-dl", "as-plus-nh", "seed-award"]);
  assert.deepEqual(filterFlights(rows, { layMin: 180 }).map((r) => r.id), ["nonstop-dl", "ua-via-ord", "seed-award"]);
  assert.deepEqual(filterFlights(rows, { layMin: 120, layMax: 300 }).map((r) => r.id), ["nonstop-dl", "ua-via-ord", "as-plus-nh", "seed-award"]);
});
