/**
 * connections — "connect via": a layover the traveler chose.
 *   synthesizeConnections()  stitches origin→hub and hub→destination legs
 *                            from either source (fare cache or Google Flights)
 *   connectsVia() / applyFlightView()  rows through the chosen hub lead the list
 * All fares and flights here are made up.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { synthesizeConnections, autoHubOffers } from "../../worker/index.js";
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

test("when the cheapest onward leg stops, the cheapest nonstop onward is offered too", () => {
  const leg1 = [gf("TPA", "SEA", "2026-12-10T07:00:00", "2026-12-10T10:30:00", 150)];
  const oneStop = { ...gf("SEA", "NRT", "2026-12-10T14:00:00", "2026-12-11T20:10:00", 600, { durMin: 1030 }), transfers: 1 };
  const anaNonstop = { ...gf("SEA", "NRT", "2026-12-10T14:30:00", "2026-12-11T17:30:00", 850, { durMin: 660 }) }; // 4h after landing
  anaNonstop.itineraries[0].segments[0].carrier = "NH";
  const plans = synthesizeConnections([{ hub: "SEA", leg1, leg2: [oneStop, anaNonstop] }]);
  assert.deepEqual(plans.map((p) => [p.price, p.transfers, p.itineraries[0].segments.at(-1).carrier]), [[750, 2, "AA"], [1000, 1, "NH"]]);
});

const single = (price, durMin, ...legs) => ({
  price, durMin, carrier: legs[0][4], cabin: "ECONOMY", transfers: legs.length - 1, gfLive: true,
  itineraries: [{ duration: null, segments: legs.map(([from, to, dep, arr, carrier]) => ({ from, to, dep, arr, carrier, num: "1" })) }],
});

test("autoHubOffers re-prices the hubs Google used as one-way legs and keeps the ANA-nonstop kind of plan", async () => {
  // Single tickets: a Delta nonstop and a United itinerary via SEA — so SEA is a hub Google knows.
  const real = [
    single(1200, 840, ["TPA", "NRT", "2026-12-10T09:00:00", "2026-12-11T13:00:00", "DL"]),
    single(1100, 1100, ["TPA", "SEA", "2026-12-10T06:00:00", "2026-12-10T09:30:00", "UA"], ["SEA", "NRT", "2026-12-10T14:00:00", "2026-12-11T18:00:00", "UA"]),
  ];
  const calls = [];
  const serp = async (q, opts) => {
    calls.push([q.from, q.to, q.date, opts?.ttl]);
    if (q.from === "TPA" && q.to === "SEA") return [gf("TPA", "SEA", "2026-12-10T07:00:00", "2026-12-10T10:30:00", 180)];
    if (q.from === "SEA" && q.to === "NRT") {
      const nh = gf("SEA", "NRT", "2026-12-10T13:40:00", "2026-12-11T16:30:00", 1300, { durMin: 650 });
      nh.itineraries[0].segments[0].carrier = "NH";
      return [nh];
    }
    return [];
  };
  const q = { from: "TPA", to: "NRT", date: "2026-12-10", cabin: "ECONOMY", via: "SEA,ORD,DFW" };
  const plans = await autoHubOffers({}, q, real, serp, 3);
  // Hubs: SEA from Google first, then ORD and DFW from the client list; two one-way searches each, cached six hours.
  assert.equal(calls.length, 6);
  assert.ok(calls.every((c) => c[3] === 6 * 3600));
  assert.deepEqual(calls.slice(0, 2).map((c) => `${c[0]}-${c[1]}`), ["TPA-SEA", "SEA-NRT"]);
  // $1,480 is 1.23× the best single ticket: kept because the onward leg is an ANA nonstop no single ticket offers.
  assert.equal(plans.length, 1);
  assert.equal(plans[0].via, "SEA");
  assert.equal(plans[0].price, 1480);
  assert.equal(plans[0].itineraries[0].segments.at(-1).carrier, "NH");
});

test("autoHubOffers drops plans that are neither cheaper, faster, nor a new nonstop onward", async () => {
  const real = [single(1000, 900, ["TPA", "SEA", "2026-12-10T06:00:00", "2026-12-10T09:30:00", "DL"], ["SEA", "NRT", "2026-12-10T13:00:00", "2026-12-11T16:00:00", "DL"])];
  const dlOnward = (price) => {
    const o = gf("SEA", "NRT", "2026-12-10T14:00:00", "2026-12-11T17:00:00", price, { durMin: 660 });
    o.itineraries[0].segments[0].carrier = "DL"; // the same airline the single ticket already uses
    return o;
  };
  const serp = async (q) => q.to === "SEA"
    ? [gf("TPA", "SEA", "2026-12-10T07:00:00", "2026-12-10T10:30:00", 400)]
    : [dlOnward(1100)]; // $1,500 total: 1.5× the single ticket, no new airline, not faster
  const plans = await autoHubOffers({}, { from: "TPA", to: "NRT", date: "2026-12-10", cabin: "ECONOMY" }, real, serp, 1);
  assert.equal(plans.length, 0);
  // At 1.2× it is a nonstop onward within the 1.25× allowance: kept.
  const nearer = async (q) => q.to === "SEA" ? [gf("TPA", "SEA", "2026-12-10T07:00:00", "2026-12-10T10:30:00", 400)] : [dlOnward(800)];
  assert.equal((await autoHubOffers({}, { from: "TPA", to: "NRT", date: "2026-12-10", cabin: "ECONOMY" }, real, nearer, 1)).length, 1);
  const cheaper = async (q) => q.to === "SEA"
    ? [gf("TPA", "SEA", "2026-12-10T07:00:00", "2026-12-10T10:30:00", 100)]
    : [gf("SEA", "NRT", "2026-12-10T14:00:00", "2026-12-11T17:00:00", 700, { durMin: 660 })]; // $800: cheaper than $1,000
  assert.equal((await autoHubOffers({}, { from: "TPA", to: "NRT", date: "2026-12-10", cabin: "ECONOMY" }, real, cheaper, 1)).length, 1);
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
