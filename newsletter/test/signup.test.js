import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { makeEnv, fakeResend, call, subscribe, confirmTokenFrom, WEBHOOK_SECRET } from "./helpers.js";
import { signWebhook, unsubscribeToken } from "../src/crypto.js";
import { runRetention } from "../src/signup.js";

let env;
let resend;
beforeEach(() => {
  env = makeEnv();
  resend = fakeResend();
});
afterEach(() => resend.restore());

const row = (email) => env.DB.prepare("SELECT * FROM signups WHERE email = ?").bind(email).first();
const signup = (body, opts) => call(env, "POST", "/v1/signup", { body, ...opts });
const valid = { email: "Reader@Example.com", interests: ["how-to", "release-news"], source: "post:themes" };

test("preflight answers 204 for the site and 403 for anyone else", async () => {
  const ok = await call(env, "OPTIONS", "/v1/signup");
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://shadynotes.app");
  const bad = await call(env, "OPTIONS", "/v1/signup", { origin: "https://evil.example" });
  assert.equal(bad.status, 403);
  assert.equal(bad.headers.get("access-control-allow-origin"), null);
});

test("EXTRA_ORIGINS allows a dev origin", async () => {
  env.EXTRA_ORIGINS = "http://localhost:4321";
  const res = await call(env, "OPTIONS", "/v1/signup", { origin: "http://localhost:4321" });
  assert.equal(res.status, 204);
});

test("sign-up from another origin is refused", async () => {
  const res = await signup(valid, { origin: "https://evil.example" });
  assert.equal(res.status, 403);
  assert.equal(resend.calls.length, 0);
});

test("sign-ups answer 503 until POLICY_VERSION is set", async () => {
  env.POLICY_VERSION = "";
  const res = await signup(valid);
  assert.equal(res.status, 503);
  assert.equal(res.headers.get("access-control-allow-origin"), "https://shadynotes.app");
});

test("the body must be exactly {email, interests, source}", async () => {
  for (const body of [
    { ...valid, name: "x" },
    { email: valid.email, interests: valid.interests },
    { ...valid, email: "not-an-email" },
    { ...valid, email: `${"a".repeat(250)}@example.com` },
    { ...valid, interests: [] },
    { ...valid, interests: ["gossip"] },
    { ...valid, interests: "how-to" },
    { ...valid, source: "<script>" },
  ]) {
    const res = await signup(body);
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  const res = await call(env, "POST", "/v1/signup", { raw: "not json" });
  assert.equal(res.status, 400);
  assert.equal(resend.calls.length, 0);
});

test("a new sign-up stores a pending row and sends one confirmation mail", async () => {
  const res = await signup(valid);
  assert.equal(res.status, 202);
  assert.deepEqual(await res.json(), { status: "sent" });
  const r = await row("reader@example.com");
  assert.equal(r.confirmed_at, null);
  assert.equal(r.source, "post:themes");
  assert.deepEqual(JSON.parse(r.interests), ["release-news", "how-to"]);
  assert.equal(resend.calls.length, 1);
  const mail = resend.calls[0];
  assert.equal(mail.path, "/emails");
  assert.deepEqual(mail.body.to, ["reader@example.com"]);
  assert.match(mail.body.subject, /Confirm/);
  const token = confirmTokenFrom(mail);
  assert.ok(token);
  assert.ok(mail.body.html.includes(`https://subscribe.shadynotes.app/c/${token}`));
  assert.notEqual(r.confirm_token_hash, token, "only a hash of the token is stored");
});

test("the rate limit allows 5 sign-ups a minute per IP, keyed by a daily hash, never the IP", async () => {
  for (let i = 0; i < 5; i++) assert.equal((await signup({ ...valid, email: `r${i}@example.com` })).status, 202);
  const sixth = await signup({ ...valid, email: "r5@example.com" });
  assert.equal(sixth.status, 429);
  assert.equal(resend.calls.length, 5, "the refused sign-up sent no mail");
  const keys = env.DB.raw.prepare("SELECT DISTINCT key FROM signup_attempts").all();
  assert.equal(keys.length, 1);
  assert.match(keys[0].key, /^[0-9a-f]{64}$/);
  assert.ok(!keys[0].key.includes("203.0.113.7"));
});

test("rate-limit records older than an hour are removed", async () => {
  env.DB.raw.prepare("INSERT INTO signup_attempts (key, at) VALUES ('old', '2000-01-01T00:00:00.000Z')").run();
  await signup(valid);
  assert.equal(env.DB.raw.prepare("SELECT count(*) AS n FROM signup_attempts WHERE key = 'old'").get().n, 0);
});

test("a repeat within 10 minutes sends no second mail", async () => {
  await signup(valid);
  const again = await signup(valid);
  assert.equal(again.status, 202);
  assert.equal(resend.calls.length, 1);
});

test("a repeat after 10 minutes resends with a new token", async () => {
  await signup(valid);
  env.DB.raw.exec("UPDATE signups SET confirm_sent_at = '2000-01-01T00:00:00.000Z'");
  const first = confirmTokenFrom(resend.calls[0]);
  await signup(valid);
  assert.equal(resend.calls.length, 2);
  const second = confirmTokenFrom(resend.calls[1]);
  assert.notEqual(first, second);
  assert.equal((await call(env, "GET", `/c/${first}`, { origin: null })).status, 404, "the old link is dead");
});

test("GET /c/<token> only shows a button; POST confirms and records consent", async () => {
  await signup(valid);
  const token = confirmTokenFrom(resend.calls[0]);
  const page = await call(env, "GET", `/c/${token}`, { origin: null });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /<form method="post" action="\/c\//);
  assert.equal((await row("reader@example.com")).confirmed_at, null, "a GET never confirms (mail scanners)");

  const done = await call(env, "POST", `/c/${token}`, { origin: null });
  assert.equal(done.status, 200);
  const r = await row("reader@example.com");
  assert.ok(r.confirmed_at);
  assert.equal(r.policy_version, "2026-11-06");
  assert.equal(r.consent_wording, env.CONSENT_WORDING);
  assert.equal(r.confirm_token_hash, null);
  assert.equal((await call(env, "POST", `/c/${token}`, { origin: null })).status, 404, "a token works once");
});

test("a confirmed address gets already-confirmed and no mail", async () => {
  await subscribe(env, resend, "reader@example.com");
  const before = resend.calls.length;
  const res = await signup({ ...valid, email: "reader@example.com" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "already-confirmed" });
  assert.equal(resend.calls.length, before);
});

test("a confirm link older than 30 days has expired", async () => {
  await signup(valid);
  env.DB.raw.exec("UPDATE signups SET confirm_sent_at = '2000-01-01T00:00:00.000Z'");
  const res = await call(env, "POST", `/c/${confirmTokenFrom(resend.calls[0])}`, { origin: null });
  assert.equal(res.status, 404);
});

test("a Resend failure answers 502 and lets the visitor retry at once", async () => {
  resend.respond = () => ({ status: 500, body: { message: "boom" } });
  const res = await signup(valid);
  assert.equal(res.status, 502);
  resend.respond = () => ({ status: 200, body: { id: "re_ok" } });
  const retry = await signup(valid);
  assert.equal(retry.status, 202);
  assert.equal(resend.calls.length, 2);
});

test("the daily cap stops confirmation mails", async () => {
  env.DAILY_CONFIRM_CAP = "2";
  assert.equal((await signup({ ...valid, email: "a@example.com" })).status, 202);
  assert.equal((await signup({ ...valid, email: "b@example.com" })).status, 202);
  assert.equal((await signup({ ...valid, email: "c@example.com" })).status, 429);
});

test("unsubscribe: GET shows a button, POST (one-click) unsubscribes, resubscribe undoes it", async () => {
  const r = await subscribe(env, resend, "reader@example.com");
  const token = await unsubscribeToken(env.TOKEN_SECRET, r.id);

  const page = await call(env, "GET", `/u/${token}`, { origin: null });
  assert.equal(page.status, 200);
  assert.equal((await row("reader@example.com")).unsubscribed_at, null, "a GET never unsubscribes");

  const oneClick = await call(env, "POST", `/u/${token}`, {
    origin: null,
    raw: "List-Unsubscribe=One-Click",
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
  assert.equal(oneClick.status, 200);
  assert.ok((await row("reader@example.com")).unsubscribed_at);

  assert.equal((await call(env, "GET", `/r/${token}`, { origin: null })).status, 200);
  assert.ok((await row("reader@example.com")).unsubscribed_at, "a GET never resubscribes");
  const back = await call(env, "POST", `/r/${token}`, { origin: null });
  assert.equal(back.status, 200);
  assert.equal((await row("reader@example.com")).unsubscribed_at, null);
});

test("a forged unsubscribe token is rejected", async () => {
  const r = await subscribe(env, resend, "reader@example.com");
  const res = await call(env, "POST", `/u/${r.id}.AAAAAAAAAAAAAAAAAAAAAA`, { origin: null });
  assert.equal(res.status, 404);
  assert.equal((await row("reader@example.com")).unsubscribed_at, null);
});

test("signing up again after unsubscribing starts a new double opt-in", async () => {
  const r = await subscribe(env, resend, "reader@example.com");
  await call(env, "POST", `/u/${await unsubscribeToken(env.TOKEN_SECRET, r.id)}`, { origin: null });
  const res = await signup({ ...valid, email: "reader@example.com" });
  assert.equal(res.status, 202);
  const again = await row("reader@example.com");
  assert.equal(again.confirmed_at, null);
  assert.equal(again.unsubscribed_at, null);
});

async function webhook(body, { secret = WEBHOOK_SECRET, timestamp = Math.floor(Date.now() / 1000) } = {}) {
  const raw = JSON.stringify(body);
  const signature = await signWebhook(secret, "msg_1", timestamp, raw);
  return call(env, "POST", "/v1/resend/webhook", {
    origin: null,
    raw,
    headers: { "svix-id": "msg_1", "svix-timestamp": String(timestamp), "svix-signature": signature },
  });
}

test("webhook: 503 without a secret, 401 on a bad or stale signature", async () => {
  const event = { type: "email.bounced", data: { to: ["reader@example.com"] } };
  env.RESEND_WEBHOOK_SECRET = "";
  assert.equal((await webhook(event)).status, 503);
  env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;
  const other = `whsec_${Buffer.from("another-secret-entirely").toString("base64")}`;
  assert.equal((await webhook(event, { secret: other })).status, 401);
  assert.equal((await webhook(event, { timestamp: Math.floor(Date.now() / 1000) - 3600 })).status, 401);
});

test("webhook: bounces and complaints suppress the address; the form then sends nothing", async () => {
  await subscribe(env, resend, "reader@example.com");
  const res = await webhook({ type: "email.complained", data: { to: ["Reader@Example.com"] } });
  assert.equal(res.status, 200);
  const r = await row("reader@example.com");
  assert.ok(r.suppressed_at);
  assert.equal(r.suppressed_reason, "email.complained");
  env.DB.raw.exec("UPDATE signups SET unsubscribed_at = '2026-01-01T00:00:00.000Z'");
  const before = resend.calls.length;
  const again = await signup({ ...valid, email: "reader@example.com" });
  assert.equal(again.status, 202);
  assert.equal(resend.calls.length, before, "never mail a suppressed address");
});

test("retention deletes stale unconfirmed and unsubscribed sign-ups only", async () => {
  await signup({ ...valid, email: "stale@example.com" });
  await signup({ ...valid, email: "fresh@example.com" });
  await subscribe(env, resend, "kept@example.com");
  await subscribe(env, resend, "gone@example.com");
  const old = "2000-01-01T00:00:00.000Z";
  env.DB.raw.prepare("UPDATE signups SET created_at = ?, confirm_sent_at = ? WHERE email = 'stale@example.com'").run(old, old);
  env.DB.raw.prepare("UPDATE signups SET unsubscribed_at = ? WHERE email = 'gone@example.com'").run(old);
  await runRetention(env);
  const left = env.DB.raw.prepare("SELECT email FROM signups ORDER BY email").all().map((r) => r.email);
  assert.deepEqual(left, ["fresh@example.com", "kept@example.com"]);
});

test("unknown routes are 404 JSON", async () => {
  const res = await call(env, "GET", "/wp-login.php", { origin: null });
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "not-found" });
});
