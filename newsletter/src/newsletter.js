// Admin routes behind ADMIN_KEY: test-send and send a post, issue status,
// sign-up stats, and lookup/delete for privacy requests. tools/post.mjs is
// the only intended client.
//
// Never-twice guarantee: recipients are claimed as `deliveries` rows (UNIQUE
// per issue and sign-up) inside a `send_batches` row before Resend is called,
// and the batch's idempotency key is reused on every retry of that batch.
import { TOPIC_IDS, BATCH_SIZE, UNSUBSCRIBE_PLACEHOLDER } from "./config.js";
import { HttpError, json, readJson, nowIso } from "./http.js";
import { sha256Hex, safeEqual, randomToken, unsubscribeToken } from "./crypto.js";
import { envelope, sendBatch, sendEmail } from "./mail.js";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** @param {Request} request @param {any} env */
export async function requireAdmin(request, env) {
  if (!env.ADMIN_KEY) throw new HttpError(503, "not-configured");
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!given || !safeEqual(await sha256Hex(given), await sha256Hex(env.ADMIN_KEY))) throw new HttpError(401, "unauthorized");
}

function parseIssue(body) {
  const { slug, subject, html, text, topics } = body;
  if (typeof slug !== "string" || !SLUG_RE.test(slug)) throw new HttpError(400, "bad-slug");
  if (typeof subject !== "string" || !subject.trim() || subject.length > 200) throw new HttpError(400, "bad-subject");
  if (typeof html !== "string" || html.length > 500_000 || !html.includes(UNSUBSCRIBE_PLACEHOLDER)) {
    throw new HttpError(400, "bad-html");
  }
  if (typeof text !== "string" || text.length > 200_000 || !text.includes(UNSUBSCRIBE_PLACEHOLDER)) {
    throw new HttpError(400, "bad-text");
  }
  if (!Array.isArray(topics) || topics.length === 0 || !topics.every((t) => TOPIC_IDS.includes(t))) {
    throw new HttpError(400, "bad-topics");
  }
  return { slug, subject, html, text, topics: TOPIC_IDS.filter((t) => topics.includes(t)) };
}

/** The hash a test send records and a real send must match. */
export const contentHash = ({ subject, html, text, topics }) => sha256Hex(JSON.stringify([subject, html, text, topics]));

const ELIGIBLE = `
  FROM signups s
  WHERE s.confirmed_at IS NOT NULL AND s.unsubscribed_at IS NULL AND s.suppressed_at IS NULL
    AND EXISTS (SELECT 1 FROM json_each(s.interests) i WHERE i.value IN (SELECT value FROM json_each(?1)))
    AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.issue_id = ?2 AND d.signup_id = s.id)`;

const remainingCount = async (env, topicsJson, issueId) =>
  Number(await env.DB.prepare(`SELECT count(*) AS n ${ELIGIBLE}`).bind(topicsJson, issueId).first("n"));

/** One personalised message: the unsubscribe link is per reader. */
async function personalise(env, issue, email, signupId, test = false) {
  const url = test
    ? `${env.SUBSCRIBE_ORIGIN}/u/test`
    : `${env.SUBSCRIBE_ORIGIN}/u/${await unsubscribeToken(env.TOKEN_SECRET, signupId)}`;
  return {
    ...envelope(email),
    subject: test ? `[Test] ${issue.subject}` : issue.subject,
    html: issue.html.split(UNSUBSCRIBE_PLACEHOLDER).join(url),
    text: issue.text.split(UNSUBSCRIBE_PLACEHOLDER).join(url),
    headers: {
      "List-Unsubscribe": `<${url}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

/** POST /v1/admin/issues/test: send the exact rendering to TEST_RECIPIENTS and record its hash. */
async function testIssue(request, env) {
  const issue = parseIssue(await readJson(request, {}, 1_000_000));
  const hash = await contentHash(issue);
  const existing = await env.DB.prepare("SELECT id FROM issues WHERE slug = ?").bind(issue.slug).first();
  if (existing) {
    const started = await env.DB.prepare("SELECT 1 AS x FROM deliveries WHERE issue_id = ? LIMIT 1").bind(existing.id).first();
    if (started) throw new HttpError(409, "already-sending");
  }
  const recipients = String(env.TEST_RECIPIENTS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (recipients.length === 0) throw new HttpError(400, "no-test-recipients");
  for (const to of recipients) {
    const result = await sendEmail(env, await personalise(env, issue, to, 0, true));
    if (!result.ok) return json({ error: "resend", status: result.status, message: result.data?.message }, 502);
  }
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO issues (slug, subject, topics, tested_hash, tested_at, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (slug) DO UPDATE SET subject = excluded.subject, topics = excluded.topics,
       tested_hash = excluded.tested_hash, tested_at = excluded.tested_at`,
  )
    .bind(issue.slug, issue.subject, JSON.stringify(issue.topics), hash, now, now)
    .run();
  return json({ hash, sent_to: recipients.length });
}

/** POST /v1/admin/issues/status {slug, topics} */
async function issueStatus(request, env) {
  const body = await readJson(request);
  if (typeof body.slug !== "string" || !SLUG_RE.test(body.slug)) throw new HttpError(400, "bad-slug");
  const issue = await env.DB.prepare("SELECT * FROM issues WHERE slug = ?").bind(body.slug).first();
  const topics = issue ? issue.topics : JSON.stringify(Array.isArray(body.topics) ? body.topics : []);
  const issueId = issue?.id ?? -1;
  const counts = issue
    ? await env.DB.prepare(
        `SELECT sum(status = 'sent') AS sent, sum(status = 'claimed') AS claimed FROM deliveries WHERE issue_id = ?`,
      )
        .bind(issue.id)
        .first()
    : null;
  return json({
    tested: Boolean(issue),
    tested_hash: issue?.tested_hash ?? null,
    tested_at: issue?.tested_at ?? null,
    sent: Number(counts?.sent ?? 0),
    claimed: Number(counts?.claimed ?? 0),
    remaining: await remainingCount(env, topics, issueId),
  });
}

/** POST /v1/admin/issues/send: send (or retry) one batch of at most BATCH_SIZE. */
async function sendIssue(request, env) {
  const body = await readJson(request, {}, 1_000_000);
  const issue = parseIssue(body);
  const hash = await contentHash(issue);
  const stored = await env.DB.prepare("SELECT * FROM issues WHERE slug = ?").bind(issue.slug).first();
  if (!stored || stored.tested_hash !== hash) throw new HttpError(409, "not-tested");
  const topicsJson = stored.topics;

  let batch = await env.DB.prepare("SELECT * FROM send_batches WHERE issue_id = ? AND status = 'pending' ORDER BY id LIMIT 1")
    .bind(stored.id)
    .first();

  if (!batch) {
    const limit = Math.max(1, Math.min(Number(body.limit) || BATCH_SIZE, BATCH_SIZE));
    const { results: picked } = await env.DB.prepare(`SELECT s.id ${ELIGIBLE} ORDER BY s.id LIMIT ?3`)
      .bind(topicsJson, stored.id, limit)
      .all();
    if (picked.length === 0) return json({ sent: 0, remaining: 0, done: true });
    const now = nowIso();
    batch = await env.DB.prepare(
      "INSERT INTO send_batches (issue_id, idempotency_key, status, created_at) VALUES (?, ?, 'pending', ?) RETURNING *",
    )
      .bind(stored.id, `issue-${stored.id}-${randomToken(12)}`, now)
      .first();
    await env.DB.batch(
      picked.map((r) =>
        env.DB.prepare(
          "INSERT OR IGNORE INTO deliveries (issue_id, signup_id, batch_id, status, created_at) VALUES (?, ?, ?, 'claimed', ?)",
        ).bind(stored.id, r.id, batch.id, now),
      ),
    );
  }

  const { results: recipients } = await env.DB.prepare(
    `SELECT d.id AS delivery_id, s.id AS signup_id, s.email FROM deliveries d JOIN signups s ON s.id = d.signup_id
     WHERE d.batch_id = ? AND d.status = 'claimed' ORDER BY d.id`,
  )
    .bind(batch.id)
    .all();

  if (recipients.length > 0) {
    const emails = [];
    for (const r of recipients) emails.push(await personalise(env, issue, r.email, r.signup_id));
    const result = await sendBatch(env, emails, batch.idempotency_key);
    if (!result.ok) {
      const message = String(result.data?.message ?? result.data?.name ?? "unknown").slice(0, 500);
      await env.DB.prepare("UPDATE send_batches SET error = ? WHERE id = ?").bind(`${result.status}: ${message}`, batch.id).run();
      return json({ error: "resend", status: result.status, message, batch: batch.id }, result.status === 429 ? 429 : 502);
    }
    const ids = Array.isArray(result.data?.data) ? result.data.data : [];
    await env.DB.batch(
      recipients.map((r, i) =>
        env.DB.prepare("UPDATE deliveries SET status = 'sent', resend_id = ? WHERE id = ?").bind(ids[i]?.id ?? null, r.delivery_id),
      ),
    );
  }
  await env.DB.prepare("UPDATE send_batches SET status = 'sent', sent_at = ?, error = NULL WHERE id = ?").bind(nowIso(), batch.id).run();
  const remaining = await remainingCount(env, topicsJson, stored.id);
  return json({ sent: recipients.length, remaining, batch: batch.id, done: remaining === 0 });
}

/** GET /v1/admin/stats: counts only, never addresses. */
async function stats(env) {
  const row = await env.DB.prepare(
    `SELECT
       sum(confirmed_at IS NULL) AS unconfirmed,
       sum(confirmed_at IS NOT NULL AND unsubscribed_at IS NULL AND suppressed_at IS NULL) AS subscribed,
       sum(unsubscribed_at IS NOT NULL) AS unsubscribed,
       sum(suppressed_at IS NOT NULL) AS suppressed
     FROM signups`,
  ).first();
  return json(Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, Number(v ?? 0)])));
}

const emailFrom = (body) => {
  if (typeof body.email !== "string" || !body.email.includes("@")) throw new HttpError(400, "bad-email");
  return body.email.trim().toLowerCase();
};

/** POST /v1/admin/lookup {email}: what we hold about one address (privacy requests). */
async function lookup(request, env) {
  const email = emailFrom(await readJson(request));
  const row = await env.DB.prepare(
    `SELECT id, email, interests, source, created_at, confirm_sent_at, confirmed_at, unsubscribed_at,
            suppressed_at, suppressed_reason, policy_version, consent_wording FROM signups WHERE email = ?`,
  )
    .bind(email)
    .first();
  if (!row) return json({ found: false });
  const { results } = await env.DB.prepare(
    `SELECT i.slug, d.status, d.created_at FROM deliveries d JOIN issues i ON i.id = d.issue_id WHERE d.signup_id = ? ORDER BY d.id`,
  )
    .bind(row.id)
    .all();
  return json({ found: true, signup: { ...row, interests: JSON.parse(row.interests) }, deliveries: results });
}

/** POST /v1/admin/delete {email}: erase an address and its delivery records. */
async function erase(request, env) {
  const email = emailFrom(await readJson(request));
  const row = await env.DB.prepare("SELECT id FROM signups WHERE email = ?").bind(email).first();
  if (!row) return json({ deleted: false });
  await env.DB.batch([
    env.DB.prepare("DELETE FROM deliveries WHERE signup_id = ?").bind(row.id),
    env.DB.prepare("DELETE FROM signups WHERE id = ?").bind(row.id),
  ]);
  return json({ deleted: true });
}

/** @param {Request} request @param {any} env @param {string} path */
export async function handleAdmin(request, env, path) {
  await requireAdmin(request, env);
  const route = `${request.method} ${path}`;
  switch (route) {
    case "GET /v1/admin/stats":
      return stats(env);
    case "POST /v1/admin/lookup":
      return lookup(request, env);
    case "POST /v1/admin/delete":
      return erase(request, env);
    case "POST /v1/admin/issues/test":
      return testIssue(request, env);
    case "POST /v1/admin/issues/status":
      return issueStatus(request, env);
    case "POST /v1/admin/issues/send":
      return sendIssue(request, env);
    default:
      throw new HttpError(404, "not-found");
  }
}
