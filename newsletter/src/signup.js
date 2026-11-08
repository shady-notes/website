// Sign-up, double opt-in, unsubscribe, resubscribe, bounce handling, retention.
// The behaviour here is what /privacy's Newsletter section promises; change
// both together.
import {
  TOPIC_IDS,
  TOPICS,
  CONFIRM_RESEND_MINUTES,
  CONFIRM_TOKEN_DAYS,
  RETENTION_DAYS,
  SIGNUP_LIMIT,
  SIGNUP_LIMIT_WINDOW_SECONDS,
} from "./config.js";
import { HttpError, json, corsHeaders, readJson, nowIso, minutesAgoIso, daysAgoIso, utcDay } from "./http.js";
import { sha256Hex, randomToken, verifyUnsubscribeToken, unsubscribeToken, verifyWebhook } from "./crypto.js";
import { confirmationEmail, sendEmail } from "./mail.js";
import { page, buttonPage, esc } from "./pages.js";

const EMAIL_RE =
  /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const SOURCE_RE = /^[a-z0-9][a-z0-9:/_-]{0,79}$/i;

/** Validate the form body: exactly {email, interests, source}. */
export function parseSignup(body, headers) {
  const keys = Object.keys(body).sort().join(",");
  if (keys !== "email,interests,source") throw new HttpError(400, "bad-fields", headers);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL_RE.test(email)) throw new HttpError(400, "bad-email", headers);
  const { interests, source } = body;
  if (
    !Array.isArray(interests) ||
    interests.length === 0 ||
    interests.length > TOPIC_IDS.length ||
    !interests.every((t) => typeof t === "string" && TOPIC_IDS.includes(t))
  ) {
    throw new HttpError(400, "bad-interests", headers);
  }
  if (typeof source !== "string" || !SOURCE_RE.test(source)) throw new HttpError(400, "bad-source", headers);
  // Store in TOPICS order, without duplicates.
  return { email, interests: TOPIC_IDS.filter((t) => interests.includes(t)), source };
}

/** OPTIONS /v1/signup */
export function handlePreflight(request, env) {
  const cors = corsHeaders(request.headers.get("origin"), env);
  return cors ? new Response(null, { status: 204, headers: cors }) : new Response(null, { status: 403 });
}

/** POST /v1/signup */
export async function handleSignup(request, env) {
  const cors = corsHeaders(request.headers.get("origin"), env);
  if (!cors) throw new HttpError(403, "origin");
  if (!env.POLICY_VERSION || !env.CONSENT_WORDING) throw new HttpError(503, "not-configured", cors);

  const { email, interests, source } = parseSignup(await readJson(request, cors, 4096), cors);

  const db = env.DB;

  // Rate limit on a hash that changes daily, so the IP is never stored or logged.
  // Counted in D1, not the rate-limit binding: that one is approximate per
  // location and let 27 tries a minute through in production.
  const ip = request.headers.get("cf-connecting-ip") ?? "";
  const limiterKey = await sha256Hex(`${env.LIMITER_SALT ?? ""}|${utcDay()}|${ip}`);
  const windowStart = new Date(Date.now() - SIGNUP_LIMIT_WINDOW_SECONDS * 1000).toISOString();
  const [, , recent] = await db.batch([
    db.prepare("DELETE FROM signup_attempts WHERE at < ?").bind(minutesAgoIso(60)),
    db.prepare("INSERT INTO signup_attempts (key, at) VALUES (?, ?)").bind(limiterKey, nowIso()),
    db.prepare("SELECT count(*) AS n FROM signup_attempts WHERE key = ? AND at >= ?").bind(limiterKey, windowStart),
  ]);
  if (Number(recent.results[0].n) > SIGNUP_LIMIT) throw new HttpError(429, "rate-limited", cors);

  const row = await db.prepare("SELECT * FROM signups WHERE email = ?").bind(email).first();

  // Bounced or complained: say "sent" so the form reveals nothing, but never mail.
  if (row?.suppressed_at) return json({ status: "sent" }, 202, cors);
  if (row?.confirmed_at && !row.unsubscribed_at) return json({ status: "already-confirmed" }, 200, cors);
  if (row && !row.confirmed_at && row.confirm_sent_at && row.confirm_sent_at > minutesAgoIso(CONFIRM_RESEND_MINUTES)) {
    return json({ status: "sent" }, 202, cors);
  }

  const cap = Number(env.DAILY_CONFIRM_CAP || 200);
  const today = `${utcDay()}T00:00:00.000Z`;
  const sentToday = await db.prepare("SELECT count(*) AS n FROM signups WHERE confirm_sent_at >= ?").bind(today).first("n");
  if (Number(sentToday) >= cap) throw new HttpError(429, "daily-cap", cors);

  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const now = nowIso();
  const interestsJson = JSON.stringify(interests);
  if (!row) {
    await db
      .prepare(
        "INSERT INTO signups (email, interests, source, created_at, confirm_token_hash, confirm_sent_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(email, interestsJson, source, now, tokenHash, now)
      .run();
  } else {
    // Unconfirmed (resend), or unsubscribed and signing up again (starts over).
    await db
      .prepare(
        `UPDATE signups SET interests = ?, source = ?, confirm_token_hash = ?, confirm_sent_at = ?,
           created_at = CASE WHEN unsubscribed_at IS NOT NULL THEN ? ELSE created_at END,
           confirmed_at = CASE WHEN unsubscribed_at IS NOT NULL THEN NULL ELSE confirmed_at END,
           unsubscribed_at = NULL
         WHERE id = ?`,
      )
      .bind(interestsJson, source, tokenHash, now, now, row.id)
      .run();
  }

  const mail = confirmationEmail(email, `${env.SUBSCRIBE_ORIGIN}/c/${token}`, interests);
  const result = await sendEmail(env, mail);
  if (!result.ok) {
    // Let the visitor try again straight away rather than wait out the resend window.
    await db.prepare("UPDATE signups SET confirm_sent_at = NULL WHERE email = ?").bind(email).run();
    throw new HttpError(502, "mail-failed", cors);
  }
  return json({ status: "sent" }, 202, cors);
}

const topicList = (interestsJson) =>
  JSON.parse(interestsJson)
    .map((t) => TOPICS[t] ?? t)
    .join(", ");

async function findPending(env, token) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const row = await env.DB.prepare("SELECT * FROM signups WHERE confirm_token_hash = ?").bind(await sha256Hex(token)).first();
  if (!row || !row.confirm_sent_at || row.confirm_sent_at < daysAgoIso(CONFIRM_TOKEN_DAYS)) return null;
  return row;
}

const expiredConfirm = () =>
  page(
    "This link has expired",
    `<p>This confirmation link was already used or has expired. If you pressed Confirm before, you're subscribed.</p>
<p>To start again, sign up on <a href="https://shadynotes.app/blog/">the blog</a>.</p>`,
    404,
  );

/** GET /c/<token>: a page with a button; never confirms. */
export async function showConfirm(env, token) {
  const row = await findPending(env, token);
  if (!row) return expiredConfirm();
  return buttonPage(
    "Confirm your subscription",
    `<p>Press the button to get new Shady Notes posts by email at <strong>${esc(row.email)}</strong>.</p>
<p class="muted">Topics: ${esc(topicList(row.interests))}</p>
<p class="muted">${esc(env.CONSENT_WORDING)}</p>`,
    "Confirm subscription",
    `/c/${token}`,
  );
}

/** POST /c/<token> */
export async function confirm(env, token) {
  const row = await findPending(env, token);
  if (!row) return expiredConfirm();
  await env.DB.prepare(
    `UPDATE signups SET confirmed_at = ?, confirm_token_hash = NULL, policy_version = ?, consent_wording = ?
     WHERE id = ? AND confirm_token_hash IS NOT NULL`,
  )
    .bind(nowIso(), env.POLICY_VERSION, env.CONSENT_WORDING, row.id)
    .run();
  const unsub = await unsubscribeToken(env.TOKEN_SECRET, row.id);
  return page(
    "You're subscribed",
    `<p>You'll get an email when a new post goes up on: ${esc(topicList(row.interests))}.</p>
<p>Every email has a one-click unsubscribe link. You can also <a href="/u/${esc(unsub)}">unsubscribe here</a>.</p>
<p><a href="https://shadynotes.app/blog/">Read the blog</a></p>`,
  );
}

const notSubscribed = () =>
  page("You're not subscribed", "<p>This address isn't on the list any more, so there's nothing to unsubscribe.</p>", 404);

const testLink = () =>
  page(
    "Unsubscribe link (test)",
    "<p>This is a test send. In a real email this link unsubscribes the reader in one click.</p>",
  );

async function signupForUnsubscribe(env, token) {
  const id = await verifyUnsubscribeToken(env.TOKEN_SECRET, token);
  if (id === null) return null;
  return env.DB.prepare("SELECT * FROM signups WHERE id = ?").bind(id).first();
}

/** GET /u/<token> */
export async function showUnsubscribe(env, token) {
  if (token === "test") return testLink();
  const row = await signupForUnsubscribe(env, token);
  if (!row) return notSubscribed();
  if (row.unsubscribed_at) return unsubscribedPage(token);
  return buttonPage(
    "Unsubscribe",
    `<p>Press the button to stop getting Shady Notes posts at <strong>${esc(row.email)}</strong>.</p>`,
    "Unsubscribe",
    `/u/${token}`,
  );
}

const unsubscribedPage = (token) =>
  buttonPage(
    "You're unsubscribed",
    `<p>You won't get any more Shady Notes emails. Your address is deleted after 30 days.</p>
<p class="muted">Changed your mind?</p>`,
    "Subscribe again",
    `/r/${token}`,
    true,
  );

/**
 * POST /u/<token>. Also the RFC 8058 one-click target: mail clients POST
 * `List-Unsubscribe=One-Click` here without showing the page.
 */
export async function unsubscribe(env, token) {
  if (token === "test") return testLink();
  const row = await signupForUnsubscribe(env, token);
  if (!row) return notSubscribed();
  await env.DB.prepare("UPDATE signups SET unsubscribed_at = ? WHERE id = ? AND unsubscribed_at IS NULL")
    .bind(nowIso(), row.id)
    .run();
  return unsubscribedPage(token);
}

/** GET /r/<token> */
export async function showResubscribe(env, token) {
  const row = await signupForUnsubscribe(env, token);
  if (!row || !row.confirmed_at) return notSubscribed();
  if (!row.unsubscribed_at) return page("You're subscribed", "<p>This address already gets new posts.</p>");
  return buttonPage(
    "Subscribe again",
    `<p>Press the button to get new Shady Notes posts at <strong>${esc(row.email)}</strong> again.</p>
<p class="muted">${esc(env.CONSENT_WORDING)}</p>`,
    "Subscribe again",
    `/r/${token}`,
  );
}

/** POST /r/<token>: undo an unsubscribe (the row still exists for 30 days). */
export async function resubscribe(env, token) {
  if (!env.POLICY_VERSION) return page("Not available", "<p>Sign-ups are closed right now.</p>", 503);
  const row = await signupForUnsubscribe(env, token);
  if (!row || !row.confirmed_at) return notSubscribed();
  await env.DB.prepare(
    `UPDATE signups SET unsubscribed_at = NULL, confirmed_at = ?, policy_version = ?, consent_wording = ?
     WHERE id = ? AND unsubscribed_at IS NOT NULL`,
  )
    .bind(nowIso(), env.POLICY_VERSION, env.CONSENT_WORDING, row.id)
    .run();
  return page(
    "You're subscribed again",
    `<p>You'll get new posts on: ${esc(topicList(row.interests))}.</p>
<p>Changed your mind again? <a href="/u/${esc(token)}">Unsubscribe</a>.</p>`,
  );
}

/** POST /v1/resend/webhook: suppress addresses that bounced or complained. */
export async function handleWebhook(request, env) {
  if (!env.RESEND_WEBHOOK_SECRET) return json({ error: "not-configured" }, 503);
  const body = await request.text();
  if (!(await verifyWebhook(env.RESEND_WEBHOOK_SECRET, request.headers, body))) return json({ error: "signature" }, 401);
  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return json({ error: "bad-json" }, 400);
  }
  if (event?.type === "email.bounced" || event?.type === "email.complained") {
    const to = Array.isArray(event.data?.to) ? event.data.to : [event.data?.to];
    const now = nowIso();
    for (const address of to) {
      if (typeof address !== "string") continue;
      await env.DB.prepare(
        "UPDATE signups SET suppressed_at = COALESCE(suppressed_at, ?), suppressed_reason = COALESCE(suppressed_reason, ?) WHERE email = ?",
      )
        .bind(now, event.type, address.trim().toLowerCase())
        .run();
    }
  }
  return json({ ok: true });
}

/** Daily cron: delete stale unconfirmed and unsubscribed sign-ups, with their delivery records. */
export async function runRetention(env) {
  const cutoff = daysAgoIso(RETENTION_DAYS);
  // An unconfirmed sign-up's clock starts at its latest confirmation mail, so a
  // fresh resend is never deleted out from under its link.
  const stale = `SELECT id FROM signups
    WHERE (confirmed_at IS NULL AND COALESCE(confirm_sent_at, created_at) < ?1)
       OR (unsubscribed_at IS NOT NULL AND unsubscribed_at < ?1)`;
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM deliveries WHERE signup_id IN (${stale})`).bind(cutoff),
    env.DB.prepare(`DELETE FROM signups WHERE id IN (${stale})`).bind(cutoff),
    env.DB.prepare("DELETE FROM signup_attempts WHERE at < ?").bind(minutesAgoIso(60)),
  ]);
}
