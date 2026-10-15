/**
 * share-ui — "Share itinerary" freezes the plan into a read-only snapshot
 * (POST /api/share) and share.html renders it without any live lookup.
 */
import { test, expect } from "@playwright/test";
import { mockApi, blockExternal } from "./helpers/mockApi.mjs";
import { plotTrip, goToStep } from "./helpers/intake.mjs";

test("Share itinerary makes a read-only link that the share page renders", async ({ page }) => {
  await blockExternal(page);
  const api = await mockApi(page);
  await plotTrip(page, { from: "TPA", to: "HND" });
  await goToStep(page, "Itinerary & cost");

  await expect(page.getByText("A read-only link to this plan as priced now")).toBeVisible();
  await page.getByRole("button", { name: "Share itinerary" }).click();
  const urlBox = page.locator("input[readonly]");
  await expect(urlBox).toHaveValue(/^http:\/\/localhost:4174\/share\.html\?id=[a-z0-9]+$/);
  const url = await urlBox.inputValue();
  const id = new URL(url).searchParams.get("id");
  await expect(page.getByRole("link", { name: "Open ↗" })).toHaveAttribute("href", url);
  await expect(page.getByRole("button", { name: "Copy" })).toBeVisible();

  // what the planner froze
  const [post] = api.calls("/api/share", (r) => r.method === "POST");
  expect(post.headers["content-type"]).toMatch(/application\/json/);
  const snap = JSON.parse(post.body);
  expect(snap.v).toBe(1);
  expect(snap.title).toBe("Tampa → Tokyo");
  expect(snap.cabin).toBe("Business");
  expect(snap.travelers).toBe("1 adult");
  expect(snap.stops).toEqual([expect.objectContaining({ name: "Tokyo", nights: 2 })]);
  expect(snap.flights).toHaveLength(2);
  expect(snap.flights[0]).toEqual(expect.objectContaining({ dir: "Outbound", from: "TPA", to: "HND" }));
  expect(snap.hotels).toHaveLength(1);
  expect(snap.costs.cash).toBeGreaterThan(0);
  expect(snap.costs.lines.length).toBeGreaterThan(0);
  expect(snap.days.length).toBeGreaterThan(0);
  expect(snap.playbook.steps.length).toBeGreaterThanOrEqual(3);

  // the share page
  await page.goto(url);
  await expect(page).toHaveTitle("Tampa → Tokyo · Meridian");
  await expect(page.locator("h1")).toHaveText("Tampa → Tokyo");
  await expect(page.locator(".sh-kick")).toHaveText("Meridian · Itinerary");
  await expect(page.locator(".sh-dates")).toContainText("2 nights · 1 adult · Business");
  for (const h of ["Flights", "Stays", "How to book it", "Day by day", "Costs"]) {
    await expect(page.locator("h2", { hasText: h })).toBeVisible();
  }
  await expect(page.locator(".sh-flight")).toHaveCount(2);
  await expect(page.locator(".sh-flight").first()).toContainText("TPA → HND");
  await expect(page.locator(".sh-flight").first()).toContainText("Outbound");
  await expect(page.locator(".sh-tiles")).toContainText("Cash out of pocket");
  await expect(page.locator(".sh-costs .sh-total").first()).toContainText("Cash out of pocket");
  await expect(page.locator("#shPrint")).toBeVisible();
  await expect(page.getByRole("link", { name: /Plan your own on Meridian/ })).toHaveAttribute("href", "/");
  expect(api.calls("/api/share", (r) => r.method === "GET" && r.q.id === id).length).toBeGreaterThan(0);

  // the checklist works here too, and its ticks persist per shared itinerary
  const boxes = page.locator(".sh-check input");
  await expect(boxes).toHaveCount(snap.playbook.steps.length);
  await boxes.first().check();
  await expect(page.locator(".sh-step").first()).toHaveClass(/sh-done/);
  await page.reload();
  await expect(page.locator(".sh-step").first()).toHaveClass(/sh-done/);
  await expect(page.locator(".sh-check input").first()).toBeChecked();
  expect(await page.evaluate((k) => localStorage.getItem(k), `meridian.share.ticks.${id}`)).toContain('"0":true');

  // only https links become hrefs, every one opens in a new tab
  const links = await page.locator(".sh-link").evaluateAll((as) => as.map((a) => [a.href, a.target, a.rel]));
  expect(links.length).toBeGreaterThan(0);
  for (const [href, target, rel] of links) {
    expect(href).toMatch(/^https:\/\//);
    expect(target).toBe("_blank");
    expect(rel).toContain("noopener");
  }
});

test("an unknown or missing id shows the not-found page", async ({ page }) => {
  await blockExternal(page);
  await mockApi(page);
  await page.goto("/share.html?id=nosuchid");
  await expect(page.locator("h1")).toHaveText("Itinerary not found");
  await expect(page.locator(".sh-dates")).toContainText("doesn't exist or has expired");
  await expect(page.getByRole("link", { name: /Plan a trip on Meridian/ })).toHaveAttribute("href", "/");
  await page.goto("/share.html");
  await expect(page.locator("h1")).toHaveText("Itinerary not found");
  await expect(page.locator(".sh-dates")).toContainText("missing its itinerary id");
});
