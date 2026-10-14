/**
 * fares-unit — published train fares and the between-cities option builder.
 *   src/data/fixedFares.js   publishedFare(), fareText(), FARE_TABLES
 *   src/lib/groundModes.js   hopOptions(), omioUrl(), chosenOption()
 * Plain node:test; no browser, no network.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { FARE_TABLES, publishedFare, fareText } from "../../src/data/fixedFares.js";
import { hopOptions, omioUrl, chosenOption } from "../../src/lib/groundModes.js";

const JP = (name, lat, lon) => ({ name, lat, lon, iso2: "JP" });
const TOKYO = JP("Tokyo", 35.68, 139.69), OSAKA = JP("Osaka", 34.69, 135.5), KYOTO = JP("Kyoto", 35.01, 135.77);
const HIROSHIMA = JP("Hiroshima", 34.39, 132.46), NAGOYA = JP("Nagoya", 35.17, 136.88);
const SEOUL = { name: "Seoul", lat: 37.57, lon: 126.98, iso2: "KR" }, BUSAN = { name: "Busan", lat: 35.18, lon: 129.08, iso2: "KR" };
const TAIPEI = { name: "Taipei", lat: 25.05, lon: 121.52, iso2: "TW" }, KAOHSIUNG = { name: "Kaohsiung", lat: 22.63, lon: 120.3, iso2: "TW" };
const ROME = { name: "Rome", lat: 41.9, lon: 12.5, iso2: "IT" }, FLORENCE = { name: "Florence", lat: 43.77, lon: 11.25, iso2: "IT" };
const FCO = { name: "Rome (FCO)", lat: 41.805, lon: 12.252, iso2: "IT", iata: "FCO", airport: true };
const ONE = { adults: 1, children: 0, infants: 0 }, TWO = { adults: 2, children: 0, infants: 0 };

test("Tokyo → Osaka is the published Nozomi fare, not an estimate", () => {
  const f = publishedFare(TOKYO, OSAKA);
  assert.equal(f.local, 14720);
  assert.equal(f.min, 147);
  assert.equal(f.currency, "JPY");
  assert.equal(f.symbol, "¥");
  assert.equal(f.svc, "Nozomi");
  assert.equal(f.operator, "JR");
  assert.equal(f.usd, Math.round(14720 / FARE_TABLES.JP.perUsd));
  assert.equal(f.jr, "hikari", "Nozomi needs the JR Pass supplement; Hikari is covered");
  assert.equal(f.book.label, "smartEX (Shinkansen)");
  assert.match(f.book.url, /^https:\/\/smart-ex\.jp\//);
  assert.match(f.basis, /published fare/);
});

test("fares read the same in both directions", () => {
  assert.equal(publishedFare(OSAKA, TOKYO).local, publishedFare(TOKYO, OSAKA).local);
  assert.equal(publishedFare(KYOTO, TOKYO).local, 14170);
});

test("Hikari-served pairs are fully covered by the JR Pass", () => {
  const f = publishedFare(OSAKA, HIROSHIMA);
  assert.equal(f.local, 10420);
  assert.equal(f.svc, "Hikari");
  assert.equal(f.jr, true);
});

test("KTX and Taiwan HSR fares in local currency", () => {
  const ktx = publishedFare(SEOUL, BUSAN);
  assert.equal(ktx.local, 54400);
  assert.equal(ktx.currency, "KRW");
  assert.equal(ktx.symbol, "₩");
  assert.equal(ktx.svc, "KTX");
  assert.equal(ktx.jr, undefined, "the JR Pass flag is Japan-only");
  const thsr = publishedFare(TAIPEI, KAOHSIUNG);
  assert.equal(thsr.local, 1490);
  assert.equal(thsr.currency, "TWD");
  assert.equal(thsr.symbol, "NT$");
  assert.equal(thsr.min, 95);
});

test("no published fare → null, so the hop stays an estimate", () => {
  assert.equal(publishedFare(TOKYO, SEOUL), null, "different countries");
  assert.equal(publishedFare(TOKYO, JP("Tokyo Skytree", 35.7, 139.75)), null, "same station both ends");
  assert.equal(publishedFare({ lat: 27.98, lon: -82.53, iso2: "US" }, { lat: 25.79, lon: -80.29, iso2: "US" }), null, "no table for the country");
  assert.equal(publishedFare(TOKYO, JP("Nikko", 36.75, 139.6)), null, "more than 30 km from any table station");
  assert.equal(publishedFare(NAGOYA, KYOTO), null, "pair not in the table");
  assert.equal(publishedFare(null, OSAKA), null);
  assert.equal(publishedFare(TOKYO, {}), null);
});

test("fareText prices the whole party in the local currency", () => {
  const f = publishedFare(TOKYO, OSAKA);
  assert.equal(fareText(f), "¥14,720");
  assert.equal(fareText(f, 2), "¥29,440");
  assert.equal(fareText(publishedFare(SEOUL, BUSAN), 3), "₩163,200");
});

test("every fare row points at stations in its own table", () => {
  for (const [cc, t] of Object.entries(FARE_TABLES)) {
    assert.ok(t.perUsd > 0 && t.currency && t.symbol && t.book?.url, `${cc} table header`);
    for (const [key, row] of Object.entries(t.fares)) {
      const [a, b] = key.split("|");
      assert.ok(t.stations[a] && t.stations[b], `${cc} ${key} names known stations`);
      assert.equal(row.length, 3, `${cc} ${key} is [minutes, fare, service]`);
      assert.ok(row[0] > 0 && row[1] > 0 && typeof row[2] === "string", `${cc} ${key} values`);
    }
  }
});

test("hopOptions: a published fare leads as a real high-speed rail option", () => {
  const hop = hopOptions({ a: TOKYO, b: OSAKA, pax: TWO });
  const rail = hop.options.find((o) => o.id === "rail");
  assert.equal(rail.mode, "hsr");
  assert.equal(rail.est, false);
  assert.deepEqual(rail.fare, { local: 14720, symbol: "¥", currency: "JPY", basis: FARE_TABLES.JP.basis, seats: 2 });
  assert.equal(rail.pp, 98);
  assert.equal(rail.total, 196, "both seats");
  assert.equal(rail.min, 147 + 30, "station time added");
  assert.equal(rail.svc, "Nozomi");
  assert.equal(rail.jr, "hikari");
  assert.equal(rail.book.label, "smartEX (Shinkansen)");
  assert.equal(rail.book.partner, undefined, "JR sells it, not a partner");
  assert.ok(hop.options.every((o) => !o.book?.partner), "Omio never appears in Japan");
  assert.equal(hop.overWater, false);
  assert.ok(hop.best, "a best-balance pick exists");
});

test("hopOptions: trains, buses and ferries in Omio countries carry the Omio partner slot", () => {
  const hop = hopOptions({ a: ROME, b: FLORENCE, pax: ONE });
  const rail = hop.options.find((o) => o.mode === "hsr" || o.mode === "train");
  assert.ok(rail, "a train option exists");
  assert.equal(rail.est, true, "no published fare in Italy: an estimate");
  assert.deepEqual(rail.book, { partner: "omio", label: "Omio", url: "https://www.omio.com/trains/rome/florence" });
  const bus = hop.options.find((o) => o.mode === "bus");
  assert.equal(bus.book.partner, "omio");
  assert.equal(bus.book.url, "https://www.omio.com/buses/rome/florence");
  for (const o of hop.options) if (["flight", "car", "private"].includes(o.mode)) assert.equal(o.book, undefined, `${o.mode} has no partner`);
  for (const tag of ["cheapest", "fastest", "best"]) assert.ok(hop.options.some((o) => o.tags?.includes(tag)), `${tag} tagged`);
});

test("hopOptions: airport hops never get a partner link", () => {
  const hop = hopOptions({ a: FLORENCE, b: FCO, pax: ONE });
  assert.ok(hop.options.length > 0);
  assert.ok(hop.options.every((o) => !o.book), "nothing bookable through a partner on the way to the airport");
});

test("omioUrl: English slugs, atlas suffix dropped, one path per mode", () => {
  assert.equal(omioUrl("train", { name: "Köln" }, { name: "Tokyo (13)" }), "https://www.omio.com/trains/koln/tokyo");
  assert.equal(omioUrl("hsr", { name: "Paris" }, { name: "Lyon" }), "https://www.omio.com/trains/paris/lyon");
  assert.equal(omioUrl("bus", { name: "São Paulo" }, { name: "Rio de Janeiro" }), "https://www.omio.com/buses/sao-paulo/rio-de-janeiro");
  assert.equal(omioUrl("ferry", { name: "Naples" }, { name: "Capri" }), "https://www.omio.com/ferries/naples/capri");
  assert.equal(omioUrl("train", { name: " Aix-en-Provence " }, { name: "Marseille" }), "https://www.omio.com/trains/aix-en-provence/marseille");
});

test("chosenOption: the traveler's pick wins, otherwise the best balance", () => {
  const hop = hopOptions({ a: ROME, b: FLORENCE, pax: ONE });
  assert.equal(chosenOption(hop, "bus").id, "bus");
  assert.equal(chosenOption(hop, "not-an-option"), hop.best);
  assert.equal(chosenOption(hop, undefined), hop.best);
});
