/**
 * omio-e2e — Omio booking links for European ground hops always point at
 * the worker's /go?p=omio&u=<route page> redirect (never at omio.com
 * directly), carry rel=sponsored and the disclosure line, and skip airport
 * hops. Nothing here ever contacts Omio or an affiliate network.
 */
import { test, expect } from "@playwright/test";
import { mockApi, blockExternal, PARTNER_OR_AIRLINE } from "./helpers/mockApi.mjs";
import { startTrip, finishTrip, goToStep, card } from "./helpers/intake.mjs";

const GO = "http://localhost:8788/go";
const ROME_FLORENCE_TRAIN = "https://www.omio.com/trains/rome/florence";

/** The Omio route page a /go link carries, or null when the link is not a /go link. */
function omioTarget(href) {
  const u = new URL(href);
  if (u.origin + u.pathname !== GO || u.searchParams.get("p") !== "omio") return null;
  return u.searchParams.get("u");
}

test("Omio links on the map flow, the desk and the playbook all go through /go", async ({ page }) => {
  const external = await blockExternal(page);
  const api = await mockApi(page);

  await startTrip(page, { from: "TPA", to: "FCO" });
  await expect(page.locator("#t-to")).toContainText("Rome");

  await finishTrip(page, {
    stops: ["Florence"],
    atTransport: async () => {
      // Step 6 — between cities
      const legs = card(page).locator(".leg");
      await expect(legs).toHaveCount(2);
      await expect(card(page)).toContainText("Meridian may earn a commission when you book through partner links such as Omio");

      const hop = legs.filter({ hasText: "Rome → Florence" });
      await expect(hop.locator(".mode.sel")).toContainText(/train/i);
      const link = hop.locator("a.bookln");
      await expect(link).toHaveText(/Book on Omio/);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noreferrer sponsored");
      expect(omioTarget(await link.getAttribute("href"))).toBe(ROME_FLORENCE_TRAIN);

      // the bus is booked on Omio too, on its own route page
      await hop.locator(".mode[data-o='bus']").click();
      await expect(hop.locator(".mode.sel")).toContainText("Bus");
      expect(omioTarget(await hop.locator("a.bookln").getAttribute("href"))).toBe("https://www.omio.com/buses/rome/florence");
      await hop.locator(".mode", { hasText: /train/i }).first().click();
      expect(omioTarget(await hop.locator("a.bookln").getAttribute("href"))).toBe(ROME_FLORENCE_TRAIN);

      // the ride to the airport is never a partner booking
      const toAirport = legs.filter({ hasText: "Florence → Rome (FCO)" });
      await expect(toAirport).toHaveCount(1);
      await expect(toAirport.locator("a.bookln")).toHaveCount(0);

      // no link on the card points at omio.com directly
      const hrefs = await card(page).locator("a[href*='omio']").evaluateAll((as) => as.map((a) => a.href));
      expect(hrefs.length).toBeGreaterThan(0);
      for (const h of hrefs) expect(h.startsWith(`${GO}?p=omio&u=`)).toBe(true);
    },
  });

  // Desk — between cities
  await expect(page.getByText(/Meridian may earn a commission when you book through partner links such as Omio/).first()).toBeVisible();
  const hopCard = page.locator("div.rise", { has: page.getByText("Rome → Florence", { exact: true }) }).first();
  await expect(hopCard).toBeVisible();
  await hopCard.getByRole("button", { name: /train/i }).first().click();
  const deskLink = hopCard.getByRole("link", { name: /Book on Omio/ });
  await expect(deskLink).toHaveAttribute("rel", "noreferrer sponsored");
  await expect(deskLink).toHaveAttribute("target", "_blank");
  expect(omioTarget(await deskLink.getAttribute("href"))).toBe(ROME_FLORENCE_TRAIN);
  await expect(hopCard.getByRole("link", { name: /Compare options/ })).toHaveAttribute("href", /rome2rio\.com/);
  const airportCard = page.locator("div.rise", { has: page.getByText("Florence → Rome (FCO)", { exact: true }) }).first();
  await expect(airportCard).toBeVisible();
  await expect(airportCard.getByRole("link", { name: /Omio/ })).toHaveCount(0);

  // Itinerary — the playbook step for the hop carries the same sponsored link and the disclosure tip
  await goToStep(page, "Itinerary & cost");
  const pb = page.locator("#playbook");
  await expect(pb).toContainText("Meridian may earn a commission when you book through partner links such as Omio");
  const step = pb.locator("> ol > li", { hasText: "Rome → Florence" }).first();
  const pbLink = step.getByRole("link", { name: /Book on Omio/ });
  await expect(pbLink).toHaveAttribute("rel", "noreferrer noopener sponsored");
  await expect(pbLink).toHaveAttribute("target", "_blank");
  expect(omioTarget(await pbLink.getAttribute("href"))).toBe(ROME_FLORENCE_TRAIN);
  await expect(pb.locator("> ol > li", { hasText: "Florence → Rome (FCO)" }).getByRole("link", { name: /Omio/ })).toHaveCount(0);

  // the page never left for the partner: no Omio or affiliate-network request, and /go itself was never fetched
  expect(external.filter((h) => PARTNER_OR_AIRLINE.test(h))).toEqual([]);
  expect(api.calls("/go")).toHaveLength(0);
});
