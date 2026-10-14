/**
 * tour-layers — the hotel tour's map layers (Sights, Restaurants, Shopping,
 * Nicer districts): defaults, what each toggle fetches from /api/places,
 * and the pins that land on the street map.
 */
import { test, expect } from "@playwright/test";
import { mockApi, blockExternal } from "./helpers/mockApi.mjs";
import { startTrip, pickFirstFlight, tourSettled, card, eyebrow } from "./helpers/intake.mjs";

test("sights are on by default; restaurants and shops are fetched and pinned on demand", async ({ page }) => {
  await blockExternal(page);
  const api = await mockApi(page);

  await startTrip(page, { from: "TPA", to: "HND" });
  await pickFirstFlight(page);
  await expect(eyebrow(page)).toContainText("Step 3");
  await page.locator("#go").click();
  await expect(eyebrow(page)).toContainText("Step 4");
  await pickFirstFlight(page);
  await expect(eyebrow(page)).toContainText("Step 5 — Hotels · city 1 of 1");
  await expect(card(page).locator(".question")).toHaveText("Tokyo");

  const layer = (k) => card(page).locator(`.layerbar button[data-layer='${k}']`);
  await expect(card(page).locator(".layerbar button")).toHaveCount(4);
  await expect(card(page).locator(".layerbar button")).toHaveText(["◆ Sights", "🍽 Restaurants", "🛍 Shopping", "▒ Nicer districts"]);
  await expect(layer("sights")).toHaveClass(/\bon\b/);
  await expect(layer("districts")).toHaveClass(/\bon\b/);
  await expect(layer("food")).not.toHaveClass(/\bon\b/);
  await expect(layer("shop")).not.toHaveClass(/\bon\b/);

  // only the default layer was fetched, for the city's own area
  const places = (kind) => api.calls("/api/places", (r) => r.q.kind === kind);
  await expect.poll(() => places("sights").length).toBeGreaterThan(0);
  expect(places("food")).toHaveLength(0);
  expect(places("shop")).toHaveLength(0);
  const q = places("sights")[0].q;
  expect(+q.lat).toBeCloseTo(35.676, 2);
  expect(+q.lon).toBeCloseTo(139.65, 2);
  expect(+q.radius).toBe(2500);

  // live hotel rates arrive as a list and as price pins on the street map
  await expect(card(page).locator("[data-h]")).toHaveCount(4);
  await expect(page.locator(".detail-map")).toHaveClass(/\bshow\b/);
  await expect(page.locator(".dm-pin")).toHaveCount(4);
  await expect(page.locator(".dm-pin", { hasText: "$620" })).toHaveCount(1); // Park Hyatt, 1240 over 2 nights

  // the city's own attractions are geocoded one by one and pinned; the sort option then offers "near sights"
  await expect(card(page).locator("#fSort option[value='sights']")).toHaveText("near sights (pinning…)");
  await tourSettled(page);
  expect(await page.locator(".dm-attr").count()).toBeGreaterThanOrEqual(3);
  await card(page).locator("#fSort").selectOption("sights");
  await expect(card(page).locator("[data-h]").first()).toContainText("km to sights");

  // sights pins, notable ones marked
  await expect(page.locator(".dm-place.dm-sights")).toHaveCount(3);
  await expect(page.locator(".dm-place.dm-sights", { hasText: "Imperial Gardens" })).toHaveAttribute("title", "Imperial Gardens · park");
  await expect(page.locator(".dm-place.dm-top")).toHaveCount(2);
  await expect(page.locator(".dm-place.dm-food")).toHaveCount(0);

  // Restaurants on → fetched for the same area and pinned; off → pins gone
  await layer("food").click();
  await expect(layer("food")).toHaveClass(/\bon\b/);
  await expect.poll(() => places("food").length).toBeGreaterThan(0);
  await expect(page.locator(".dm-place.dm-food")).toHaveCount(3);
  await expect(page.locator(".dm-place.dm-food", { hasText: "Noodle House Test" })).toHaveCount(1);
  await expect(page.locator(".dm-place.dm-sights")).toHaveCount(3);
  await layer("food").click();
  await expect(layer("food")).not.toHaveClass(/\bon\b/);
  await expect(page.locator(".dm-place.dm-food")).toHaveCount(0);
  await expect(page.locator(".dm-place.dm-sights")).toHaveCount(3);

  // Shopping on, Sights off: each layer is independent
  await layer("shop").click();
  await expect.poll(() => places("shop").length).toBeGreaterThan(0);
  await expect(page.locator(".dm-place.dm-shop")).toHaveCount(3);
  await layer("sights").click();
  await expect(layer("sights")).not.toHaveClass(/\bon\b/);
  await expect(page.locator(".dm-place.dm-sights")).toHaveCount(0);
  await expect(page.locator(".dm-place.dm-shop")).toHaveCount(3);
  await expect(page.locator(".dm-pin")).toHaveCount(4);

  // Nicer districts off clears its shading markers
  await layer("districts").click();
  await expect(layer("districts")).not.toHaveClass(/\bon\b/);
  await expect(page.locator(".dm-district")).toHaveCount(0);

  // picking a hotel highlights its pin
  await card(page).locator("[data-h]", { hasText: "Park Hyatt Tokyo" }).click();
  await expect(page.locator(".dm-pin.dm-sel")).toHaveCount(1);
  await expect(page.locator(".dm-pin.dm-sel")).toContainText("$620");
  await expect(card(page).locator(".opt.sel[data-h]")).toContainText("Park Hyatt Tokyo");
});
