import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { kindOf, countable } from "../src/worker.js";

const SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

test("who is downloading", () => {
  assert.equal(kindOf(SAFARI), "site");
  assert.equal(kindOf("Shady Notes/4.1.16 Sparkle/2.6.4"), "update");
  assert.equal(kindOf("Homebrew/4.4.0 (Macintosh; arm64 Mac OS X 15.1) curl/8.7.1"), "homebrew");
  assert.equal(kindOf("curl/8.7.1"), "other");
  for (const ua of [null, "", "Googlebot/2.1", "Mozilla/5.0 (compatible; bingbot/2.0)", "facebookexternalhit/1.1", "Mozilla/5.0 HeadlessChrome/120"]) {
    assert.equal(kindOf(ua), null, String(ua));
  }
});

test("one count per download: full GET or a range from byte 0", () => {
  const req = (method, range) => new Request("https://d/x", { method, headers: range ? { Range: range } : {} });
  assert.equal(countable(req("GET")), true);
  assert.equal(countable(req("GET", "bytes=0-")), true);
  assert.equal(countable(req("GET", "bytes=0-1048575")), true);
  assert.equal(countable(req("GET", "bytes=1048576-")), false);
  assert.equal(countable(req("HEAD")), false);
});

function setup(status = 200) {
  const rows = [], waits = [];
  const env = {
    ASSETS: { fetch: async () => new Response("dmg-bytes", { status, headers: { "content-type": "application/x-apple-diskimage" } }) },
    DB: { prepare: (sql) => ({ bind: (...args) => ({ run: async () => rows.push(args) }) }) },
  };
  const ctx = { waitUntil: (p) => waits.push(p) };
  return { env, ctx, rows, waits };
}
const get = (path, ua = SAFARI, extra = {}) =>
  new Request("https://downloads.shadynotes.app" + path, { headers: { "user-agent": ua, ...extra } });

test("a browser download is served unchanged and counted", async () => {
  const { env, ctx, rows, waits } = setup();
  const res = await worker.fetch(get("/macos/ShadyNotes-4.1.19.dmg"), env, ctx);
  await Promise.all(waits);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "dmg-bytes");
  assert.deepEqual(rows.map((r) => r.slice(1)), [["ShadyNotes-4.1.19.dmg", "site"]]);
});

test("the unversioned alias and Sparkle updates are counted by kind", async () => {
  const { env, ctx, rows, waits } = setup();
  await worker.fetch(get("/macos/ShadyNotes.dmg"), env, ctx);
  await worker.fetch(get("/macos/ShadyNotes-4.1.19.dmg", "Shady Notes/4.1.16 Sparkle/2.6.4"), env, ctx);
  await Promise.all(waits);
  assert.deepEqual(rows.map((r) => r.slice(1)), [["ShadyNotes.dmg", "site"], ["ShadyNotes-4.1.19.dmg", "update"]]);
});

test("not counted: 404s, resumed ranges, bots, other paths", async () => {
  const miss = setup(404);
  await worker.fetch(get("/macos/ShadyNotes-9.9.9.dmg"), miss.env, miss.ctx);
  const s = setup();
  await worker.fetch(get("/macos/ShadyNotes-4.1.19.dmg", SAFARI, { Range: "bytes=500-" }), s.env, s.ctx);
  await worker.fetch(get("/macos/ShadyNotes-4.1.19.dmg", "Googlebot/2.1"), s.env, s.ctx);
  await worker.fetch(get("/macos/appcast.xml"), s.env, s.ctx);
  await worker.fetch(get("/macos/Other.dmg"), s.env, s.ctx);
  await Promise.all([...miss.waits, ...s.waits]);
  assert.equal(miss.rows.length + s.rows.length, 0);
});

test("a failing database never breaks the download", async () => {
  const { env, ctx, waits } = setup();
  env.DB = { prepare: () => ({ bind: () => ({ run: async () => { throw new Error("d1 down"); } }) }) };
  const res = await worker.fetch(get("/macos/ShadyNotes-4.1.19.dmg"), env, ctx);
  await Promise.all(waits);
  assert.equal(res.status, 200);
});

test("film byte ranges still answer 206", async () => {
  const env = { ASSETS: { fetch: async () => new Response("0123456789", { status: 200 }) } };
  const res = await worker.fetch(
    new Request("https://downloads.shadynotes.app/media/f.mp4", { headers: { Range: "bytes=2-4" } }), env, { waitUntil() {} });
  assert.equal(res.status, 206);
  assert.equal(await res.text(), "234");
  assert.equal(res.headers.get("content-range"), "bytes 2-4/10");
});
