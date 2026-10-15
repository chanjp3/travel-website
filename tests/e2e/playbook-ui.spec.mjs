/**
 * playbook-ui — "How to book it" on the itinerary: an ordered checklist
 * with links and steps per booking, whose ticks and confirmation codes
 * are kept per trip in this browser.
 */
import { test, expect } from "@playwright/test";
import { mockApi, blockExternal } from "./helpers/mockApi.mjs";
import { plotTrip, goToStep, openTrips } from "./helpers/intake.mjs";

test("the booking playbook is a checklist whose ticks survive a reload", async ({ page }) => {
  await blockExternal(page);
  await mockApi(page);
  await plotTrip(page, { from: "TPA", to: "HND" });
  await goToStep(page, "Itinerary & cost");

  const pb = page.locator("#playbook");
  await expect(pb).toContainText("How to book it");
  const steps = pb.locator("> ol > li");
  const n = await steps.count();
  expect(n).toBeGreaterThanOrEqual(3); // outbound, return, hotel
  await expect(pb).toContainText(`0 of ${n} booked`);

  // scarce pieces first: the flights lead, outbound before return
  await expect(steps.nth(0)).toContainText("Outbound flight · TPA → HND");
  await expect(steps.nth(1)).toContainText("Return flight · HND → TPA");
  await expect(steps.nth(0)).toContainText("cash");
  await expect(steps.nth(0).locator("ol li")).toHaveCount(3); // how-to steps
  await expect(steps.nth(0).getByRole("link", { name: /Open in Google Flights/ })).toBeVisible();
  await expect(pb.locator("ul > li").first()).toContainText("Book in the order below");
  await expect(pb).toContainText("Save every confirmation code below");

  // every link opens in a new tab, without a referrer, over https
  const links = await pb.locator("a").evaluateAll((as) => as.map((a) => [a.href, a.target, a.rel]));
  expect(links.length).toBeGreaterThan(0);
  for (const [href, target, rel] of links) {
    expect(href).toMatch(/^https:\/\//);
    expect(target).toBe("_blank");
    expect(rel).toContain("noreferrer");
  }

  // tick the first step, note a confirmation code on the second
  await steps.nth(0).getByRole("button", { name: "Mark step 1 booked" }).click();
  await expect(pb).toContainText(`1 of ${n} booked`);
  await expect(steps.nth(0).getByRole("button", { name: "Mark step 1 not booked" })).toBeVisible();
  await expect(steps.nth(0).locator("a")).toHaveCount(0); // links fold away once booked
  await steps.nth(1).getByPlaceholder("Confirmation code").fill("ABC123");

  // stored per trip in this browser
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("meridian.booked.v1") ?? "{}"));
  const keys = Object.keys(stored);
  expect(keys).toHaveLength(1);
  expect(keys[0]).toMatch(/^tampa\|tokyo\|\d{4}-\d{2}-\d{2}$/);
  const marks = Object.values(stored[keys[0]]);
  expect(marks.some((m) => m.done === true)).toBe(true);
  expect(marks.some((m) => m.conf === "ABC123")).toBe(true);

  // the desk autosaves the trip 800 ms after its last change; wait for that before reloading
  await expect.poll(() => page.evaluate(() => localStorage.getItem("meridian.autosave")), { timeout: 10_000 }).not.toBeNull();
  const auto = await page.evaluate(() => JSON.parse(localStorage.getItem("meridian.autosave")));
  expect(auto).toEqual(expect.objectContaining({ v: 1, originId: "tampa", destIds: ["tokyo"], label: "Tampa → Tokyo" }));

  // reload, resume the autosaved trip: the same checklist state
  await page.reload();
  await openTrips(page);
  await page.getByRole("button", { name: /Continue where you left off/ }).click();
  await expect(page.getByText(/orders scored/)).toBeVisible();
  await goToStep(page, "Itinerary & cost");
  const again = page.locator("#playbook");
  await expect(again).toContainText(`1 of ${n} booked`);
  await expect(again.locator("> ol > li").nth(1).getByPlaceholder("Confirmation code")).toHaveValue("ABC123");

  // and it can be undone
  await again.locator("> ol > li").nth(0).getByRole("button", { name: "Mark step 1 not booked" }).click();
  await expect(again).toContainText(`0 of ${n} booked`);
  await expect(again.locator("> ol > li").nth(0).locator("a").first()).toBeVisible();
});
