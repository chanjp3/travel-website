/**
 * worker-go — the affiliate redirect in worker/index.js.
 *   trackedUrl()      how a network's tracking link learns the route page
 *   GET /go?p=&u=     the 302, and the allowlist that keeps it from being an open redirect
 * Every tracking link here is made up: never a real affiliate link.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { trackedUrl } from "../../worker/index.js";

const OMIO = /(^|\.)omio\.(com|co\.uk|de|fr|it|es|nl|pl|pt|at|ch|be|se|dk|cz|ie|ca|com\.br|com\.mx|com\.au|com\.ar)$/i;
const ROUTE = "https://www.omio.com/trains/rome/florence";
const ENC = encodeURIComponent(ROUTE);
// The shape of an Impact "Regular" link (account / ad / campaign ids) on a fake host.
const FAKE_IMPACT = "https://tracking.example/c/1001/2002/3003";

test("an Impact /c/<n>/<n>/<n> link gets u=<route page> appended", () => {
  assert.equal(trackedUrl(FAKE_IMPACT, ROUTE, OMIO), `${FAKE_IMPACT}?u=${ENC}`);
});

test("existing parameters on the Impact link survive", () => {
  assert.equal(trackedUrl(`${FAKE_IMPACT}?subId1=meridian`, ROUTE, OMIO), `${FAKE_IMPACT}?subId1=meridian&u=${ENC}`);
});

test("a shortened vanity link has no destination slot: tracked, but lands on the home page", () => {
  assert.equal(trackedUrl("https://tracking.example/abc123", ROUTE, OMIO), "https://tracking.example/abc123");
});

test("{url} templates take the encoded route page", () => {
  assert.equal(trackedUrl("https://net.example/click?dest={url}&id=7", ROUTE, OMIO), `https://net.example/click?dest=${ENC}&id=7`);
});

test("Partnerize-style destination: segments are swapped", () => {
  assert.equal(
    trackedUrl("https://prf.example/click/camref:1/destination:https%3A%2F%2Fwww.omio.com%2F", ROUTE, OMIO),
    `https://prf.example/click/camref:1/destination:${ENC}`,
  );
});

test("a direct partner link keeps its tracking parameters on the route page", () => {
  const out = new URL(trackedUrl("https://www.omio.com/?utm_source=meridian&partner=abc", ROUTE, OMIO));
  assert.equal(out.origin + out.pathname, ROUTE);
  assert.equal(out.searchParams.get("utm_source"), "meridian");
  assert.equal(out.searchParams.get("partner"), "abc");
});

test("network redirects with a URL-valued parameter get the route page in it", () => {
  assert.equal(trackedUrl("https://net.example/r?aff=9&u=https%3A%2F%2Fwww.omio.com%2F", ROUTE, OMIO), `https://net.example/r?aff=9&u=${ENC}`);
  assert.equal(trackedUrl("https://net.example/r?ulp=https://www.omio.com/&id=1", ROUTE, OMIO), `https://net.example/r?ulp=${ENC}&id=1`);
});

test("Awin links take the route page as ued=", () => {
  assert.equal(trackedUrl("https://www.awin1.com/cread.php?awinmid=1&awinaffid=2", ROUTE, OMIO), `https://www.awin1.com/cread.php?awinmid=1&awinaffid=2&ued=${ENC}`);
});

test("no usable template → the plain route page", () => {
  assert.equal(trackedUrl(undefined, ROUTE, OMIO), ROUTE);
  assert.equal(trackedUrl("", ROUTE, OMIO), ROUTE);
  assert.equal(trackedUrl("   ", ROUTE, OMIO), ROUTE);
  assert.equal(trackedUrl("not a url", ROUTE, OMIO), ROUTE);
});

const go = (u, env = {}, p = "omio") => worker.fetch(new Request(`https://api.test/go?p=${p}&u=${encodeURIComponent(u)}`), env);

test("GET /go 302s to the tracked link carrying the route page", async () => {
  const res = await go(ROUTE, { OMIO_LINK: FAKE_IMPACT });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), `${FAKE_IMPACT}?u=${ENC}`);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  assert.equal(res.headers.get("Referrer-Policy"), "no-referrer-when-downgrade");
});

test("without OMIO_LINK the redirect goes straight to the partner page", async () => {
  const res = await go(ROUTE, {});
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), ROUTE);
});

test("Omio country domains pass the allowlist", async () => {
  for (const host of ["www.omio.fr", "www.omio.co.uk", "omio.de", "www.omio.com.br"]) {
    const res = await go(`https://${host}/trains/paris/lyon`, { OMIO_LINK: FAKE_IMPACT });
    assert.equal(res.status, 302, host);
    assert.equal(new URL(res.headers.get("Location")).searchParams.get("u"), `https://${host}/trains/paris/lyon`);
  }
});

test("never an open redirect: foreign hosts, look-alikes, plain http and junk are refused", async () => {
  for (const u of [
    "https://evil.example/x",
    "https://omio.com.evil.example/",
    "https://notomio.com/trains/a/b",
    "http://www.omio.com/trains/rome/florence",
    "javascript:alert(1)",
    "nonsense",
  ]) {
    const res = await go(u, { OMIO_LINK: FAKE_IMPACT });
    assert.equal(res.status, 400, u);
    assert.match((await res.json()).error, /not a partner link|bad link/);
  }
});

test("unknown partners are refused before any link is built", async () => {
  const res = await go(ROUTE, { OMIO_LINK: FAKE_IMPACT }, "unknown");
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "unknown partner" });
});

test("OPTIONS preflight on /go answers with CORS headers", async () => {
  const res = await worker.fetch(new Request("https://api.test/go?p=omio&u=x", { method: "OPTIONS" }), {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
});
