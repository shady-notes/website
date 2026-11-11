import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve, isBot } from "../src/links.js";
import worker from "../src/worker.js";

const utm = (href) => Object.fromEntries(new URL(href).searchParams);

test("source alone lands on the homepage with content=post", () => {
  const r = resolve("/hn");
  assert.equal(new URL(r.location).pathname, "/");
  assert.deepEqual(utm(r.location), {
    utm_source: "hn",
    utm_medium: "community",
    utm_campaign: "launch_2026q4",
    utm_content: "post",
  });
});

test("source + content, case-insensitive, trailing slash", () => {
  const r = resolve("/X/Tables/");
  assert.equal(r.source, "x");
  assert.equal(utm(r.location).utm_source, "x");
  assert.equal(utm(r.location).utm_medium, "organic_social");
  assert.equal(utm(r.location).utm_content, "tables");
});

test("short source slugs map to the plan's utm_source names", () => {
  assert.equal(utm(resolve("/ph").location).utm_source, "producthunt");
  assert.equal(utm(resolve("/yt/short-gesture").location).utm_source, "youtube");
  assert.equal(utm(resolve("/alt").location).utm_medium, "directory");
  assert.equal(utm(resolve("/news/dec-1").location).utm_medium, "email");
});

test("pricing and download content slugs pick the landing page", () => {
  assert.equal(new URL(resolve("/x/pricing").location).pathname, "/pricing");
  assert.equal(new URL(resolve("/reddit/download").location).pathname, "/download");
});

test("unknown sources, bad slugs and deep paths are not campaign links", () => {
  for (const p of ["/", "/nope", "/x/a/b", "/x/-lead", "/x/" + "a".repeat(41), "/x/sp ace", "/x/%3Cs%3E"]) {
    assert.equal(resolve(p), null, p);
  }
});

test("link-preview fetchers are bots, browsers are not", () => {
  for (const ua of [null, "", "Twitterbot/1.0", "facebookexternalhit/1.1", "Slackbot-LinkExpanding 1.0", "Mozilla/5.0 (compatible; Discordbot/2.0)", "redditbot/1.0", "curl/8.4.0"]) {
    assert.equal(isBot(ua), true, String(ua));
  }
  assert.equal(isBot("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"), false);
});

function env() {
  const rows = [];
  return {
    rows,
    DB: {
      prepare: (sql) => ({
        bind: (...args) => ({ run: async () => rows.push({ sql, args }) }),
      }),
    },
  };
}
const ctx = () => {
  const waits = [];
  return { waits, waitUntil: (p) => waits.push(p) };
};
const SAFARI = { "user-agent": "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15" };

test("a browser click redirects and counts once", async () => {
  const e = env(), c = ctx();
  const res = await worker.fetch(new Request("https://go.shadynotes.app/reddit/macapps", { headers: SAFARI }), e, c);
  await Promise.all(c.waits);
  assert.equal(res.status, 302);
  assert.equal(utm(res.headers.get("location")).utm_content, "macapps");
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(e.rows.length, 1);
  assert.deepEqual(e.rows[0].args.slice(1), ["reddit", "macapps"]);
});

test("bots and HEAD redirect without counting; others go home", async () => {
  const e = env(), c = ctx();
  await worker.fetch(new Request("https://go.shadynotes.app/hn", { headers: { "user-agent": "Twitterbot/1.0" } }), e, c);
  await worker.fetch(new Request("https://go.shadynotes.app/hn", { method: "HEAD", headers: SAFARI }), e, c);
  const home = await worker.fetch(new Request("https://go.shadynotes.app/whatever", { headers: SAFARI }), e, c);
  await Promise.all(c.waits);
  assert.equal(e.rows.length, 0);
  assert.equal(home.headers.get("location"), "https://shadynotes.app/");
  const post = await worker.fetch(new Request("https://go.shadynotes.app/hn", { method: "POST" }), e, c);
  assert.equal(post.status, 405);
});
