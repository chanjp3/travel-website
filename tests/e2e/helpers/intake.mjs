/**
 * Drives the map intake (src/atlas/meridianIntake.js) the way a traveler
 * does: intro → trip setup → flights → cities → the way home → hotels →
 * between cities → summary → "Price every piece" hands the trip to the desk.
 */
import { expect } from "@playwright/test";

export const card = (page) => page.locator("#qcard");
export const eyebrow = (page) => page.locator("#qcard .eyebrow");

/**
 * Uncaught errors in the page fail the test with the real cause instead of
 * a timeout on the next expectation. Call once per page (openIntake does).
 */
const watched = new WeakSet();
export function failOnPageError(page) {
  if (watched.has(page)) return;
  watched.add(page);
  page.on("pageerror", (err) => {
    throw new Error(`Uncaught error in the page: ${err.message}\n${err.stack ?? ""}`);
  });
}

/** Intro screen → the trip-setup card. */
export async function openIntake(page) {
  failOnPageError(page);
  await page.goto("/");
  await page.locator("#beginBtn").click();
  await expect(page.locator("#inFrom")).toBeVisible();
}

/** Type an airport code into From or To and take the top suggestion. */
export async function pickPlace(page, side, code) {
  const input = page.locator(side === "from" ? "#inFrom" : "#inTo");
  await input.click();
  await input.fill(code);
  const top = page.locator(side === "from" ? "#sgFrom" : "#sgTo").locator("div[data-i='0']");
  await expect(top).toContainText(code);
  await top.click();
  await expect(page.locator(`#t-${side}`)).toContainText(code);
}

/** Intro → From/To → "Find flights": lands on the outbound flight step. */
export async function startTrip(page, { from = "TPA", to = "HND" } = {}) {
  await openIntake(page);
  await pickPlace(page, "from", from);
  await pickPlace(page, "to", to);
  await page.locator("#go").click();
  await expect(eyebrow(page)).toContainText("Step 2");
}

export async function pickFirstFlight(page) {
  const first = card(page).locator(".fcard").first();
  await expect(first).toBeVisible();
  await first.click();
}

/** Add a city from the destination country's list on the cities step. */
export async function addStopFromList(page, city) {
  await page.locator("#sugg .opt", { hasText: city }).first().click();
  await expect(page.locator("#stopsNow .stoprow", { hasText: city })).toBeVisible();
}

/**
 * Wait for a city's hotel tour to pin its attractions before moving on. They
 * are geocoded one at a time (350 ms apart) and the card re-renders when the
 * pins are in; the "near sights" sort option changes its label at that moment.
 * (Leaving a city cancels whatever background work is still running, so the
 * card never re-renders over the next step; this wait only keeps the tour
 * steps deterministic.)
 */
export async function tourSettled(page) {
  await expect(card(page).locator("#fSort option[value='sights']")).toHaveText("sort: near sights", { timeout: 20_000 });
}

/**
 * Outbound flight step → … → "Price every piece": lands on the desk.
 *   stops        cities to add from the destination country's list
 *   hotel        a hotel name to pick on the first city's tour (false: skip the tour)
 *   atTransport  callback run on the between-cities step (only trips with hops have one)
 */
export async function finishTrip(page, { stops = [], hotel = false, atTransport = null } = {}) {
  await pickFirstFlight(page);
  await expect(eyebrow(page)).toContainText("Step 3");
  for (const s of stops) await addStopFromList(page, s);
  await page.locator("#go").click();                      // Continue →
  await expect(eyebrow(page)).toContainText("Step 4");    // round trip: the flight home
  await pickFirstFlight(page);
  await expect(eyebrow(page)).toContainText("Step 5");
  if (hotel) {
    const row = card(page).locator("[data-h]", { hasText: hotel });
    await row.click();
    await expect(row).toHaveClass(/\bsel\b/);
    const n = +(/city 1 of (\d+)/.exec(await eyebrow(page).textContent())?.[1] ?? 1);
    for (let i = 1; i <= n; i++) {
      await tourSettled(page);
      await page.locator("#nx").click();                  // Next city → / Continue →
      if (i < n) await expect(eyebrow(page)).toContainText(`city ${i + 1} of ${n}`);
    }
  } else {
    await tourSettled(page);
    await page.locator("#skip").click();
  }
  await expect(eyebrow(page)).toContainText(/Step [67]/);
  if (/Step 6/.test(await eyebrow(page).textContent())) {
    if (atTransport) await atTransport();
    await page.locator("#go").click();                    // See the whole trip →
  }
  await expect(eyebrow(page)).toContainText("Step 7");
  await page.locator("#doneBtn").click();                 // Price every piece →
  await expect(page.getByText(/orders scored/)).toBeVisible();
}

export async function plotTrip(page, opts = {}) {
  await startTrip(page, opts);
  await finishTrip(page, opts);
}

/** The desk's step bar in the header. */
export async function goToStep(page, name) {
  await page.locator("header").getByRole("button", { name }).click();
}

/** Open the Trips drawer (works on the map screen and on the desk). */
export async function openTrips(page) {
  await page.locator("button", { hasText: "Trips" }).last().click();
  await expect(page.locator("aside")).toContainText("Your trips");
}
