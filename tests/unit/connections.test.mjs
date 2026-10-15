/**
 * connections — "connect via": a layover the traveler chose.
 *   synthesizeConnections()  stitches origin→hub and hub→destination legs
 *                            from either source (fare cache or Google Flights)
 *   connectsVia() / applyFlightView()  rows through the chosen hub lead the list
 * All fares and flights here are made up.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { synthesizeConnections } from "../../worker/index.js";
import { applyFlightView, connectsVia } from "../../src/lib/flightFilters.js";

// Google Flights style: local stamps, no offsets, a real arrival at the hub.
const gf = (from, to, dep, arr, price, extra = {}) => ({
  price, carrier: "AA", cabin: "ECONOMY", transfers: 0, durMin: extra.durMin ?? 170, gfLive: true,
  itineraries: [{ duration: "PT2H50M", segments: [{ from, to, dep, arr, carrier: "AA", num: "1" }] }],
  ...extra,
});
// Fare-cache style: one segment, departure with offset, flight time, no arrival.
const tp = (from, to, dep, durMin, price) => ({
  price, carrier: "NK", cabin: "ECONOMY", transfers: 0, durMin,
  itineraries: [{ duration: null, segments: [{ from, to, dep, arr: null, carrier: "NK", num: "9" }] }],
});

test("Google Flights legs: the real hub arrival sets the layover, the cheapest workable second leg wins", () => {
  const leg1 = [gf("TPA", "DFW", "2026-12-10T07:00:00", "2026-12-10T08:50:00", 150)];
  const leg2 = [
    gf("DFW", "NRT", "2026-12-10T10:00:00", "2026-12-11T14:30:00", 700, { durMin: 790 }), // 70 min: too tight
    gf("DFW", "NRT", "2026-12-10T12:30:00", "2026-12-11T16:40:00", 900, { durMin: 790 }), // 3h40
    gf("DFW", "NRT", "2026-12-10T16:00:00", "2026-12-11T20:10:00", 800, { durMin: 790 }), // 7h10, cheaper
  ];
  const [plan, ...rest] = synthesizeConnections([{ hub: "DFW", leg1, leg2 }]);
  assert.equal(rest.length, 0);
  assert.equal(plan.price, 950);
  assert.equal(plan.layoverMin, 430);
  assert.equal(plan.via, "DFW");
  assert.equal(plan.selfTransfer, true);
  assert.equal(plan.gfLive, true);
  assert.equal(plan.cabin, "ECONOMY");
  assert.equal(plan.overnight, false);
  assert.equal(plan.durMin, 170 + 430 + 790);
  assert.deepEqual(plan.itineraries[0].segments.map((s) => `${s.from}-${s.to}`), ["TPA-DFW", "DFW-NRT"]);
  assert.equal(plan.itineraries[0].segments[0].arr, "2026-12-10T08:50:00");
});

test("every segment of a multi-stop first leg is kept", () => {
  const leg1 = [{
    price: 180, carrier: "AA", cabin: "BUSINESS", transfers: 1, durMin: 300, gfLive: true,
    itineraries: [{ duration: "PT5H", segments: [
      { from: "TPA", to: "CLT", dep: "2026-12-10T06:00:00", arr: "2026-12-10T07:45:00", carrier: "AA", num: "2" },
      { from: "CLT", to: "DFW", dep: "2026-12-10T09:00:00", arr: "2026-12-10T10:00:00", carrier: "AA", num: "3" },
    ] }],
  }];
  const leg2 = [gf("DFW", "NRT", "2026-12-10T14:00:00", "2026-12-11T18:10:00", 2000, { cabin: "BUSINESS", durMin: 790 })];
  const [plan] = synthesizeConnections([{ hub: "DFW", leg1, leg2 }]);
  assert.deepEqual(plan.itineraries[0].segments.map((s) => `${s.from}-${s.to}`), ["TPA-CLT", "CLT-DFW", "DFW-NRT"]);
  assert.equal(plan.transfers, 2);
  assert.equal(plan.cabin, "BUSINESS");
  assert.equal(plan.layoverMin, 240);
});

test("fare-cache legs: departure plus flight time stands in for the missing arrival, offsets respected", () => {
  // TPA 07:00 ET = 12:00Z, +170 min → 14:50Z. DFW 12:30 CT = 18:30Z → 220 min layover.
  const leg1 = [tp("TPA", "DFW", "2026-12-10T07:00:00-05:00", 170, 120)];
  const leg2 = [tp("DFW", "NRT", "2026-12-10T12:30:00-06:00", 790, 640)];
  const [plan] = synthesizeConnections([{ hub: "DFW", leg1, leg2 }]);
  assert.equal(plan.layoverMin, 220);
  assert.equal(plan.price, 760);
  assert.equal(plan.gfLive, undefined);
  assert.match(plan.itineraries[0].segments[0].arr, /^2026-12-10T08:50:00-06:00$/);
});

test("the layover window: shorter than the minimum or longer than 26h is not a plan", () => {
  const leg1 = [gf("TPA", "DFW", "2026-12-10T07:00:00", "2026-12-10T08:50:00", 150)];
  const tight = [gf("DFW", "NRT", "2026-12-10T10:00:00", "2026-12-11T14:30:00", 700)];
  const twoDays = [gf("DFW", "NRT", "2026-12-12T10:00:00", "2026-12-13T14:30:00", 700)];
  assert.equal(synthesizeConnections([{ hub: "DFW", leg1, leg2: tight }]).length, 0);
  assert.equal(synthesizeConnections([{ hub: "DFW", leg1, leg2: twoDays }]).length, 0);
  const fiveHours = [gf("DFW", "NRT", "2026-12-10T13:50:00", "2026-12-11T18:00:00", 700)];
  assert.equal(synthesizeConnections([{ hub: "DFW", leg1, leg2: fiveHours }], { minLayoverMin: 360 }).length, 0);
  assert.equal(synthesizeConnections([{ hub: "DFW", leg1, leg2: fiveHours }], { minLayoverMin: 240 }).length, 1);
});

test("a next-morning second leg is an overnight plan", () => {
  const leg1 = [gf("TPA", "DFW", "2026-12-10T18:00:00", "2026-12-10T19:50:00", 150)];
  const leg2 = [gf("DFW", "NRT", "2026-12-11T10:30:00", "2026-12-12T14:40:00", 800)];
  const [plan] = synthesizeConnections([{ hub: "DFW", leg1, leg2 }]);
  assert.equal(plan.layoverMin, 880);
  assert.equal(plan.overnight, true);
});

test("connectsVia reads the hub from segments, a self-transfer hub, or a two-booking hub", () => {
  assert.equal(connectsVia({ segs: [{ from: "TPA", to: "DFW" }, { from: "DFW", to: "NRT" }] }, "dfw"), true);
  assert.equal(connectsVia({ selfTransfer: true, hub: "DFW" }, "DFW"), true);
  assert.equal(connectsVia({ twoBookings: true, viaHub: "DFW" }, "DFW"), true);
  assert.equal(connectsVia({ segs: [{ from: "TPA", to: "NRT" }] }, "DFW"), false);
  assert.equal(connectsVia({ segs: [{ from: "TPA", to: "DFW" }, { from: "DFW", to: "NRT" }] }, null), false);
});

test("with a chosen hub, rows through it lead the list without breaking cash-first or the sort", () => {
  const rows = [
    { id: "a", cash: 500, dur: "14h 00m", segs: [{ from: "TPA", to: "NRT" }] },
    { id: "b", cash: 900, dur: "20h 00m", segs: [{ from: "TPA", to: "DFW" }, { from: "DFW", to: "NRT" }] },
    { id: "c", cash: 700, dur: "18h 00m", segs: [{ from: "TPA", to: "ORD" }, { from: "ORD", to: "NRT" }] },
    { id: "d", points: 60000, programId: "x", segs: [{ from: "TPA", to: "DFW" }, { from: "DFW", to: "NRT" }] },
    { id: "e", points: 50000, programId: "x", segs: [{ from: "TPA", to: "NRT" }] },
  ];
  assert.deepEqual(applyFlightView(rows, { sort: "cheapest" }).map((r) => r.id), ["a", "c", "b", "e", "d"]);
  assert.deepEqual(applyFlightView(rows, { sort: "cheapest", via: "DFW" }).map((r) => r.id), ["b", "a", "c", "d", "e"]);
});
