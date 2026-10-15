/**
 * flow-e2e — the whole journey on a desktop: map intake (seven steps) →
 * route & flights desk → itinerary & cost, for a Tampa → Tokyo → Osaka
 * round trip priced entirely from the mocked worker.
 */
import { test, expect } from "@playwright/test";
import { mockApi, blockExternal, PARTNER_OR_AIRLINE } from "./helpers/mockApi.mjs";
import { startTrip, pickFirstFlight, addStopFromList, tourSettled, goToStep, card, eyebrow } from "./helpers/intake.mjs";

test("a Tampa → Tokyo → Osaka round trip is plotted, priced and ready to book", async ({ page }) => {
  const external = await blockExternal(page);
  const api = await mockApi(page);

  // Step 1 — trip setup
  await startTrip(page, { from: "TPA", to: "HND" });
  await expect(page.locator("#t-from")).toContainText("Tampa");
  await expect(page.locator("#t-to")).toContainText("Tokyo");
  await expect(page.locator("#t-date")).not.toHaveText("———");

  // Step 2 — outbound flight: live fares and award space from the worker
  await expect(eyebrow(page)).toContainText("Step 2 — Outbound flight");
  await expect(card(page)).toContainText("TPA → HND");
  const cards = card(page).locator(".fcard");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThanOrEqual(2);
  await expect(cards.first()).toContainText(/Delta|ANA/);
  await expect(cards.first()).toContainText("Business");
  await expect(card(page)).toContainText("Google Flights");
  await expect(card(page).locator("#awPts")).toContainText("points option");
  await expect(card(page)).not.toContainText("Showing cached fares");
  const deep = api.calls("/api/flights", (r) => r.q.from === "TPA" && r.q.to === "HND" && r.q.deep === "1");
  expect(deep.length).toBeGreaterThan(0);
  expect(deep[0].q.cabin).toBe("BUSINESS");
  expect(api.calls("/api/awards", (r) => r.q.from === "TPA" && r.q.to === "HND" && r.q.detail === "1").length).toBeGreaterThan(0);

  await pickFirstFlight(page);
  await expect(page.locator("#t-flight")).toContainText("BIZ");

  // Step 3 — cities and nights: the landing city starts as the first stop
  await expect(eyebrow(page)).toContainText("Step 3 — Cities and nights");
  await expect(page.locator("#stopsNow .stoprow")).toHaveCount(1);
  await expect(page.locator("#stopsNow")).toContainText("Tokyo");
  await addStopFromList(page, "Osaka");
  await expect(page.locator("#stopsNow .stoprow")).toHaveCount(2);
  await expect(card(page).locator(".tally")).toContainText("2 stops · 4 nights");
  await page.locator("#go").click();

  // Step 4 — round trip: the flight home leaves from the landing airport
  await expect(eyebrow(page)).toContainText("Step 4 — The flight home");
  await expect(card(page)).toContainText("HND → TPA");
  await pickFirstFlight(page);

  // Step 5 — hotel tour, live rates per city
  await expect(eyebrow(page)).toContainText("Step 5 — Hotels · city 1 of 2");
  await expect(card(page).locator(".question")).toHaveText("Tokyo");
  const hotels = card(page).locator("[data-h]");
  await expect(hotels).toHaveCount(4);
  await expect(hotels.first()).toContainText("Meridian Test Inn Tokyo"); // cheapest first
  const pick = hotels.filter({ hasText: "Riverside Boutique Tokyo" });
  await expect(pick).toContainText("$520 total");
  await pick.click();
  await expect(pick).toHaveClass(/\bsel\b/);
  await expect(card(page).locator(".layerbar button")).toHaveCount(4);
  await expect(card(page)).toContainText("Don't miss");
  await tourSettled(page);
  await expect(page.locator(".dm-attr").first()).toBeVisible(); // the city's attractions pinned on the street map
  await page.locator("#nx").click(); // Next city →
  await expect(eyebrow(page)).toContainText("city 2 of 2");
  await expect(card(page).locator(".question")).toHaveText("Osaka");
  await expect(card(page).locator("[data-h]")).toHaveCount(4);
  await tourSettled(page);
  await page.locator("#nx").click(); // Continue →

  // Step 6 — between cities: the Shinkansen shows its published fare, booked with JR, never a partner
  await expect(eyebrow(page)).toContainText("Step 6 — Between cities");
  const legs = card(page).locator(".leg");
  await expect(legs).toHaveCount(2);
  const tokyoOsaka = legs.filter({ hasText: "Tokyo → Osaka" });
  await expect(tokyoOsaka.locator(".mode.sel")).toContainText("High-speed train");
  await expect(tokyoOsaka.locator(".mode.sel .pub")).toHaveText("Published fare");
  await expect(tokyoOsaka).toContainText("¥14,720");
  await expect(tokyoOsaka.locator("a.bookln")).toContainText("Book with smartEX");
  await expect(tokyoOsaka.locator("a.bookln")).toHaveAttribute("href", "https://smart-ex.jp/en/");
  await expect(card(page).locator("a[href*='p=omio']")).toHaveCount(0);
  await expect(card(page)).not.toContainText("partner links");
  await expect(legs.nth(1)).toContainText("Osaka → Tokyo (HND)");
  await expect(card(page)).toContainText("Getting around");
  await page.locator("#go").click(); // See the whole trip →

  // Step 7 — the plotted summary
  await expect(eyebrow(page)).toContainText("Step 7 — Your trip");
  await expect(card(page)).toContainText("Tampa → Tokyo → Osaka → Tampa");
  await expect(card(page)).toContainText("4 nights");
  await expect(card(page)).toContainText("Hotels picked on the map");
  await expect(card(page)).toContainText("$520");
  await page.locator("#doneBtn").click(); // Price every piece →

  // Desk — route & flights
  await expect(page.getByText(/orders scored/)).toBeVisible();
  await expect(page.locator("header").getByRole("button", { name: "Route & flights" })).toBeVisible();
  await expect(page.getByText(/Outbound · TPA → HND/)).toBeVisible();
  await expect(page.getByText(/^Return · HND → TPA/)).toBeVisible();
  await expect(page.getByText("GOOGLE FLIGHTS").first()).toBeVisible();
  await expect(page.getByText(/Live fares loaded/).first()).toBeVisible();
  await expect(page.getByText("Between cities — every way to get there")).toBeVisible();
  await expect(page.getByText("¥14,720").first()).toBeVisible();
  await expect(page.getByText("published fare").first()).toBeVisible();
  await expect(page.getByText("Showing cached fares")).toHaveCount(0);
  expect(api.calls("/api/hotels", (r) => r.q.name === "Tokyo").length).toBeGreaterThan(0);
  expect(api.calls("/api/hotels", (r) => r.q.name === "Osaka").length).toBeGreaterThan(0);

  // Desk — itinerary & cost
  await goToStep(page, "Itinerary & cost");
  await expect(page.locator("main h2").first()).toContainText(/\d+ days · Tampa → Tokyo → Osaka/);
  await expect(page.getByText("Cash out of pocket").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Share itinerary" })).toBeVisible();
  await expect(page.getByText("Hotels — points program or cash")).toBeVisible();
  const hotelRow = page.locator("button", { hasText: "Riverside Boutique Tokyo" }).first();
  await expect(hotelRow).toContainText("LIVE");
  await expect(page.getByText("Cost rundown")).toBeVisible();
  await expect(page.getByText("Riverside Boutique Tokyo · 2 nt")).toBeVisible();
  await expect(page.getByText("Tokyo → Osaka · High-speed train", { exact: true })).toBeVisible(); // the ledger line
  await expect(page.locator("#playbook")).toContainText("How to book it");
  await expect(page.getByText("Day by day")).toBeVisible();
  await expect(page.getByText("By city")).toBeVisible();

  // Everything came from the mocked worker and local answers; no partner or airline was contacted
  expect(external.filter((h) => PARTNER_OR_AIRLINE.test(h))).toEqual([]);
  expect(api.calls("/go")).toHaveLength(0);
});
