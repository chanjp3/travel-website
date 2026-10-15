/**
 * watch-ui — the award watchlist for a signed-in account: the list in the
 * Trips drawer (add, check now, mark seen, remove) and the "☆ watch award
 * space" shortcut on a flight leg of the desk.
 */
import { test, expect } from "@playwright/test";
import { mockApi, blockExternal } from "./helpers/mockApi.mjs";
import { plotTrip, openTrips } from "./helpers/intake.mjs";

const USER = { email: "tester@example.com", name: "Tester" };
const signIn = (page) => page.addInitScript(() => localStorage.setItem("meridian.auth", "test-session-token"));
const futureISO = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };

test("the award watchlist in Trips: add, check now, mark seen, remove", async ({ page }) => {
  await blockExternal(page);
  const api = await mockApi(page, { auth: USER });
  await signIn(page);
  await page.goto("/");
  await openTrips(page);

  const aside = page.locator("aside");
  await expect(aside).toContainText("Signed in as");
  await expect(aside).toContainText("tester@example.com");
  await expect(aside).toContainText("Award watchlist");
  await expect(aside).toContainText("0/10 · checked daily");
  await expect(aside).toContainText("Watch a route and Meridian re-checks its award space every morning");
  expect(api.calls("/api/auth/me")[0].headers.authorization).toBe("Bearer test-session-token");

  // add one from the form
  const watchBtn = aside.getByRole("button", { name: "Watch", exact: true });
  await expect(watchBtn).toBeDisabled();
  await aside.getByLabel("From").fill("tpa"); // letters only, uppercased
  await expect(aside.getByLabel("From")).toHaveValue("TPA");
  await aside.getByLabel("To").fill("HND");
  const date = futureISO(120);
  await aside.getByLabel("Date").fill(date);
  await expect(aside.getByLabel("Cabin")).toHaveValue("business");
  await expect(aside.getByLabel("Flexibility")).toHaveValue("2");
  await aside.getByLabel("Maximum miles in thousands").fill("90");
  await expect(watchBtn).toBeEnabled();
  await watchBtn.click();

  await expect.poll(() => api.calls("/api/watch", (r) => r.method === "POST").length).toBe(1);
  const [post] = api.calls("/api/watch", (r) => r.method === "POST");
  expect(post.headers.authorization).toBe("Bearer test-session-token");
  expect(JSON.parse(post.body)).toEqual({ from: "TPA", to: "HND", date, flex: 2, cabin: "business", maxMiles: 90000 });
  await expect(aside).toContainText("TPA → HND");
  await expect(aside).toContainText("· Business");
  await expect(aside).toContainText("No business award space yet — watching.");
  await expect(aside).toContainText("1/10 · checked daily");
  await expect(aside).toContainText("not checked yet");
  await expect(aside).toContainText("under 90K");
  await expect(aside.getByLabel("From")).toHaveValue(""); // form cleared

  // Check now → one hit, flagged NEW, counted on the Trips button
  await aside.getByRole("button", { name: "Check now" }).click();
  await expect(aside).toContainText("1 option · best 88K United");
  await expect(aside).toContainText("+ $45");
  await expect(aside).toContainText("1 NEW");
  await expect(aside).toContainText("checked just now");
  await expect(aside).toContainText("· nonstop");
  await expect(page.locator("button", { hasText: "Trips" }).last().locator("span[title='New award space on your watchlist']")).toHaveText("1");
  expect(api.calls("/api/watch/check", (r) => r.method === "POST" && r.q.id === "w1")).toHaveLength(1);

  await aside.getByRole("button", { name: "Mark seen" }).click();
  await expect(aside).not.toContainText("1 NEW");
  await expect(page.locator("button", { hasText: "Trips" }).last().locator("span[title='New award space on your watchlist']")).toHaveCount(0);
  await expect(aside.getByRole("link", { name: /seats\.aero/ })).toHaveAttribute("href", /seats\.aero\/search\?origin_airport=TPA&destination_airport=HND/);

  await aside.getByRole("button", { name: "Remove" }).click();
  await expect(aside).toContainText("0/10 · checked daily");
  await expect(aside).not.toContainText("TPA → HND");
  expect(api.calls("/api/watch", (r) => r.method === "DELETE" && r.q.id === "w1")).toHaveLength(1);
});

test("☆ watch award space on a flight leg adds that route to the watchlist", async ({ page }) => {
  await blockExternal(page);
  const api = await mockApi(page, { auth: USER });
  await signIn(page);
  await plotTrip(page, { from: "TPA", to: "HND" });

  const watchButtons = page.getByRole("button", { name: "☆ watch award space" });
  await expect(watchButtons).toHaveCount(2); // outbound and return legs
  await watchButtons.first().click();
  await expect(page.getByRole("button", { name: "★ watching" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "☆ watch award space" })).toHaveCount(1);

  const [post] = api.calls("/api/watch", (r) => r.method === "POST");
  expect(JSON.parse(post.body)).toEqual({ from: "TPA", to: "HND", date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), flex: 2, cabin: "business" });

  // "★ watching" opens the drawer where the route is listed
  await page.getByRole("button", { name: "★ watching" }).click();
  const aside = page.locator("aside");
  await expect(aside).toContainText("Award watchlist");
  await expect(aside).toContainText("TPA → HND");
  await expect(aside).toContainText("1/10 · checked daily");
});

test("signed out, the watchlist is not offered and the legs show no watch button", async ({ page }) => {
  await blockExternal(page);
  await mockApi(page); // sign-in not configured → 501
  await plotTrip(page, { from: "TPA", to: "HND" });
  await expect(page.getByRole("button", { name: "☆ watch award space" })).toHaveCount(0);
  await openTrips(page);
  const aside = page.locator("aside");
  await expect(aside).toContainText("Account sign-in isn't switched on yet");
  await expect(aside).not.toContainText("Award watchlist");
});
