/**
 * limit-ui — when the worker holds back a metered lookup it says why in the
 * X-Meridian-Limit header; the map flow and the desk both explain it.
 */
import { test, expect } from "@playwright/test";
import { mockApi, blockExternal } from "./helpers/mockApi.mjs";
import { startTrip, finishTrip, card } from "./helpers/intake.mjs";

test("signin: cached fares are flagged and the desk offers to sign in", async ({ page }) => {
  await blockExternal(page);
  const api = await mockApi(page, { limit: "signin" });
  await startTrip(page, { from: "TPA", to: "HND" });

  // the flight step of the map flow
  await expect(card(page).locator(".fcard").first()).toBeVisible();
  await expect(card(page)).toContainText("Showing cached fares.");
  await expect(card(page)).toContainText("Sign in (Trips, top right) for live Google Flights prices in every cabin.");
  expect(api.calls("/api/flights", (r) => r.q.deep === "1").length).toBeGreaterThan(0);

  // the desk
  await finishTrip(page);
  const note = page.locator("main p", { hasText: "Showing cached fares." });
  await expect(note).toBeVisible();
  await expect(note).toContainText("Sign in for live Google Flights prices in every cabin.");
  await note.getByRole("button", { name: "Sign in →" }).click();
  await expect(page.locator("aside")).toContainText("Your trips");
  await expect(page.locator("aside")).toContainText("Account");
});

test("user-cap: the daily allowance message, no sign-in prompt", async ({ page }) => {
  await blockExternal(page);
  await mockApi(page, { limit: "user-cap" });
  await startTrip(page, { from: "TPA", to: "HND" });
  await expect(card(page).locator(".fcard").first()).toBeVisible();
  await expect(card(page)).toContainText("You've used today's live Google Flights searches — showing cached fares until midnight UTC.");
  await expect(card(page)).not.toContainText("Showing cached fares.");

  await finishTrip(page);
  await expect(page.getByText(/You've used today's live Google Flights searches/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in →" })).toHaveCount(0);
});

test("global-cap: the site-wide message", async ({ page }) => {
  await blockExternal(page);
  await mockApi(page, { limit: "global-cap" });
  await startTrip(page, { from: "TPA", to: "HND" });
  await expect(card(page).locator(".fcard").first()).toBeVisible();
  await expect(card(page)).toContainText("Live Google Flights searches are at today's site-wide limit");
});

test("no limit header: no notice anywhere", async ({ page }) => {
  await blockExternal(page);
  await mockApi(page);
  await startTrip(page, { from: "TPA", to: "HND" });
  await expect(card(page).locator(".fcard").first()).toBeVisible();
  await expect(card(page)).not.toContainText("cached fares");
  await finishTrip(page);
  await expect(page.getByText(/cached fares/)).toHaveCount(0);
});
