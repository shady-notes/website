import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, fakeResend, call, admin, subscribe } from "./helpers.js";
import { verifyUnsubscribeToken } from "../src/crypto.js";

let env;
let resend;
beforeEach(() => {
  env = makeEnv();
  resend = fakeResend();
});
afterEach(() => resend.restore());

const issue = (overrides = {}) => ({
  slug: "themes",
  subject: "Pick a theme in a few keystrokes",
  html: '<p>Hello</p><a href="{{unsubscribe_url}}">Unsubscribe</a>',
  text: "Hello\nUnsubscribe: {{unsubscribe_url}}",
  topics: ["how-to"],
  ...overrides,
});
const batches = () => resend.calls.filter((c) => c.path === "/emails/batch");

test("admin routes need the bearer key", async () => {
  assert.equal((await call(env, "GET", "/v1/admin/stats", { origin: null })).status, 401);
  const wrong = await call(env, "GET", "/v1/admin/stats", { origin: null, headers: { authorization: "Bearer nope" } });
  assert.equal(wrong.status, 401);
  env.ADMIN_KEY = "";
  assert.equal((await call(env, "GET", "/v1/admin/stats", { origin: null })).status, 503);
});

test("send refuses until the exact rendering was test-sent", async () => {
  await subscribe(env, resend, "a@example.com");
  assert.equal((await admin(env, "POST", "/v1/admin/issues/send", issue())).status, 409);
  const t = await admin(env, "POST", "/v1/admin/issues/test", issue());
  assert.equal(t.status, 200);
  const changed = await admin(env, "POST", "/v1/admin/issues/send", issue({ html: issue().html.replace("Hello", "Hi") }));
  assert.equal(changed.status, 409, "one changed word needs a new test");
});

test("test sends to TEST_RECIPIENTS only, with a harmless unsubscribe link", async () => {
  await subscribe(env, resend, "a@example.com");
  const before = resend.calls.length;
  const res = await admin(env, "POST", "/v1/admin/issues/test", issue());
  assert.equal(res.status, 200);
  const sent = resend.calls.slice(before);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].body.to, ["privacy@example.com"]);
  assert.match(sent[0].body.subject, /^\[Test\] /);
  assert.ok(sent[0].body.html.includes("https://subscribe.shadynotes.app/u/test"));
  assert.ok(!sent[0].body.html.includes("{{unsubscribe_url}}"));
});

test("the html and text must carry the unsubscribe placeholder", async () => {
  const res = await admin(env, "POST", "/v1/admin/issues/test", issue({ html: "<p>no link</p>" }));
  assert.equal(res.status, 400);
});

test("send mails only confirmed, subscribed, unsuppressed readers of the post's topics, once", async () => {
  const a = await subscribe(env, resend, "a@example.com", ["how-to"]);
  await subscribe(env, resend, "b@example.com", ["release-news"]); // other topic
  const c = await subscribe(env, resend, "c@example.com", ["how-to", "behind-the-scenes"]);
  const d = await subscribe(env, resend, "d@example.com", ["how-to"]);
  const e = await subscribe(env, resend, "e@example.com", ["how-to"]);
  await call(env, "POST", "/v1/signup", { body: { email: "pending@example.com", interests: ["how-to"], source: "blog-index" } });
  env.DB.raw.prepare("UPDATE signups SET unsubscribed_at = '2026-11-01T00:00:00.000Z' WHERE id = ?").run(d.id);
  env.DB.raw.prepare("UPDATE signups SET suppressed_at = '2026-11-01T00:00:00.000Z' WHERE id = ?").run(e.id);

  await admin(env, "POST", "/v1/admin/issues/test", issue());
  const status = await (await admin(env, "POST", "/v1/admin/issues/status", { slug: "themes" })).json();
  assert.equal(status.remaining, 2);

  const res = await admin(env, "POST", "/v1/admin/issues/send", issue());
  assert.equal(res.status, 200);
  const out = await res.json();
  assert.equal(out.sent, 2);
  assert.equal(out.done, true);

  const [batch] = batches();
  assert.deepEqual(batch.body.map((m) => m.to[0]).sort(), ["a@example.com", "c@example.com"]);
  assert.ok(batch.headers["idempotency-key"]);
  for (const m of batch.body) {
    const url = /<(https:\/\/subscribe\.shadynotes\.app\/u\/([^>]+))>/.exec(m.headers["List-Unsubscribe"]);
    assert.ok(url, "per-reader List-Unsubscribe");
    assert.equal(m.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
    assert.ok(m.html.includes(url[1]) && m.text.includes(url[1]));
    const id = await verifyUnsubscribeToken(env.TOKEN_SECRET, url[2]);
    assert.equal(id, m.to[0] === "a@example.com" ? a.id : c.id);
  }

  const again = await (await admin(env, "POST", "/v1/admin/issues/send", issue())).json();
  assert.deepEqual(again, { sent: 0, remaining: 0, done: true });
  assert.equal(batches().length, 1, "nobody gets it twice");
  assert.equal((await admin(env, "POST", "/v1/admin/issues/test", issue())).status, 409, "no re-test once sending started");
});

test("batches are at most the limit, and a Resend 429 retries the same batch with the same key", async () => {
  for (let i = 0; i < 5; i++) await subscribe(env, resend, `r${i}@example.com`);
  await admin(env, "POST", "/v1/admin/issues/test", issue());

  const first = await (await admin(env, "POST", "/v1/admin/issues/send", { ...issue(), limit: 2 })).json();
  assert.equal(first.sent, 2);
  assert.equal(first.remaining, 3);

  resend.respond = () => ({ status: 429, body: { name: "daily_quota_exceeded", message: "You have reached your daily email sending quota." } });
  const limited = await admin(env, "POST", "/v1/admin/issues/send", { ...issue(), limit: 2 });
  assert.equal(limited.status, 429);
  const failedKey = batches().at(-1).headers["idempotency-key"];
  const failedTo = batches().at(-1).body.map((m) => m.to[0]);

  resend.respond = (path, body) => ({ status: 200, body: { data: body.map((_, i) => ({ id: `re_${i}` })) } });
  const retry = await (await admin(env, "POST", "/v1/admin/issues/send", { ...issue(), limit: 2 })).json();
  assert.equal(retry.sent, 2);
  assert.equal(batches().at(-1).headers["idempotency-key"], failedKey, "same key on retry");
  assert.deepEqual(batches().at(-1).body.map((m) => m.to[0]), failedTo, "same recipients on retry");

  const last = await (await admin(env, "POST", "/v1/admin/issues/send", { ...issue(), limit: 2 })).json();
  assert.equal(last.sent, 1);
  assert.equal(last.done, true);

  const delivered = env.DB.raw.prepare("SELECT count(*) AS n, count(DISTINCT signup_id) AS people FROM deliveries WHERE status = 'sent'").get();
  assert.equal(delivered.n, 5);
  assert.equal(delivered.people, 5);
});

test("stats give counts only; lookup and delete serve privacy requests", async () => {
  await subscribe(env, resend, "a@example.com");
  await call(env, "POST", "/v1/signup", { body: { email: "p@example.com", interests: ["how-to"], source: "blog-index" } });
  await admin(env, "POST", "/v1/admin/issues/test", issue());
  await admin(env, "POST", "/v1/admin/issues/send", issue());

  const stats = await (await admin(env, "GET", "/v1/admin/stats")).json();
  assert.deepEqual(stats, { unconfirmed: 1, subscribed: 1, unsubscribed: 0, suppressed: 0 });

  const found = await (await admin(env, "POST", "/v1/admin/lookup", { email: "A@example.com" })).json();
  assert.equal(found.found, true);
  assert.equal(found.signup.email, "a@example.com");
  assert.equal(found.signup.confirm_token_hash, undefined, "tokens are never returned");
  assert.deepEqual(found.deliveries.map((d) => d.slug), ["themes"]);

  const del = await (await admin(env, "POST", "/v1/admin/delete", { email: "a@example.com" })).json();
  assert.equal(del.deleted, true);
  assert.equal((await (await admin(env, "POST", "/v1/admin/lookup", { email: "a@example.com" })).json()).found, false);
  assert.equal(env.DB.raw.prepare("SELECT count(*) AS n FROM deliveries").get().n, 0);
});
