/**
 * mobile-e2e — the same journey on a phone (Pixel 7 emulation, see the
 * "mobile" project in playwright.config.js): the question card is a bottom
 * sheet, typing gives it the screen, and the desk uses its compact header.
 */
import { test, expect } from "@playwright/test";
import { mockApi, blockExternal } from "./helpers/mockApi.mjs";
import { openIntake, pickPlace, finishTrip, goToStep, card, eyebrow } from "./helpers/intake.mjs";

test("the map flow and the desk work on a phone", async ({ page }, testInfo) => {
  expect(testInfo.project.name).toBe("mobile");
  await blockExternal(page);
  await mockApi(page);
  const vw = page.viewportSize();
  expect(vw.width).toBeLessThanOrEqual(640);

  await openIntake(page);

  // the question card is a bottom sheet above the ticket rail
  const box = await card(page).boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(10);
  expect(box.x + box.width).toBeLessThanOrEqual(vw.width - 10);
  expect(box.y + box.height).toBeLessThanOrEqual(vw.height - 80);
  expect(box.height).toBeLessThanOrEqual(vw.height * 0.56 + 2);

  // a text field in use gives the sheet the screen
  await page.locator("#inFrom").focus();
  await expect(card(page)).toHaveClass(/\btyping\b/);

  await pickPlace(page, "from", "TPA");
  await pickPlace(page, "to", "HND");
  await page.locator("#go").click();
  await expect(eyebrow(page)).toContainText("Step 2");
  await expect(card(page).locator(".fcard").first()).toBeVisible();

  await finishTrip(page);

  // the desk's compact header
  await expect(page.locator("header h1")).toBeHidden();
  const points = page.locator("header button", { hasText: "Points" });
  await expect(points.locator("span.sm\\:hidden")).toBeVisible();
  await expect(points.locator("span.hidden")).toBeHidden();
  await expect(page.locator("header").getByRole("button", { name: "Route & flights" })).toBeVisible();
  await expect(page.getByText(/Outbound · TPA → HND/)).toBeVisible();
  const main = await page.locator("main").boundingBox();
  expect(main.width).toBeLessThanOrEqual(vw.width);
  expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(1); // route & flights fits the phone

  await goToStep(page, "Itinerary & cost");
  await expect(page.locator("main h2").first()).toContainText("Tampa → Tokyo");
  await expect(page.locator("#playbook")).toContainText("How to book it");
  await expect(page.getByText("Day by day")).toBeVisible();
  await expect(page.getByText("Cost rundown")).toBeVisible();
});

/** How far the page scrolls sideways beyond the viewport, in CSS px. */
const sidewaysOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// The hotel filter bar's "Group" row (label + seven chips, ~440 px) is the
// widest thing on the itinerary page; its chips wrap at phone widths, so the
// page must not scroll sideways.
test("the itinerary page has no sideways scroll on a phone", async ({ page }) => {
  await blockExternal(page);
  await mockApi(page);
  await openIntake(page);
  await pickPlace(page, "from", "TPA");
  await pickPlace(page, "to", "HND");
  await page.locator("#go").click();
  await finishTrip(page);
  await goToStep(page, "Itinerary & cost");
  await expect(page.getByText("Cost rundown")).toBeVisible();
  expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(1);
});
