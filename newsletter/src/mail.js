// Resend client and the confirmation email. No open or click tracking is ever
// requested here; tracking is also switched off on the Resend domain itself.
import { FROM, REPLY_TO, RESEND_API_BASE, SITE, SENDER_IDENTITY, TOPICS, CONTACT } from "./config.js";
import { esc } from "./pages.js";

/**
 * @param {any} env
 * @param {"/emails"|"/emails/batch"} path
 * @param {unknown} payload
 * @param {string} [idempotencyKey]
 * @returns {Promise<{ok:boolean,status:number,data:any}>}
 */
async function resend(env, path, payload, idempotencyKey) {
  if (!env.RESEND_API_KEY) return { ok: false, status: 503, data: { message: "RESEND_API_KEY not set" } };
  const headers = {
    authorization: `Bearer ${env.RESEND_API_KEY}`,
    "content-type": "application/json",
    "user-agent": "shadynotes-subscribe/1",
  };
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;
  let res;
  try {
    res = await fetch(`${env.RESEND_API_BASE || RESEND_API_BASE}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return { ok: false, status: 0, data: { message: String(e) } };
  }
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** @param {any} env @param {object} email */
export const sendEmail = (env, email, idempotencyKey) => resend(env, "/emails", email, idempotencyKey);
/** @param {any} env @param {object[]} emails */
export const sendBatch = (env, emails, idempotencyKey) => resend(env, "/emails/batch", emails, idempotencyKey);

/** The mail fields every message shares. */
export const envelope = (to) => ({ from: FROM, to: [to], reply_to: REPLY_TO });

/**
 * The one email sent before someone confirms.
 * @param {string} to @param {string} confirmUrl @param {string[]} interests
 */
export function confirmationEmail(to, confirmUrl, interests) {
  const topics = interests.map((t) => TOPICS[t] ?? t).join(", ");
  const subject = "Confirm your Shady Notes subscription";
  const text = `Someone, hopefully you, asked to get new Shady Notes posts by email at this address.

Topics: ${topics}

To confirm, open this link and press the Confirm button:
${confirmUrl}

If you didn't ask for this, ignore this email. Nothing more will be sent, and the request is deleted after 30 days.

${SENDER_IDENTITY} · ${SITE} · ${CONTACT}
`;
  const html = `<!doctype html>
<html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light dark"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#000000;">
<p style="margin:0 0 24px;font-weight:700;">Shady Notes</p>
<p style="margin:0 0 16px;">Someone, hopefully you, asked to get new Shady Notes posts by email at this address.</p>
<p style="margin:0 0 16px;"><strong>Topics:</strong> ${esc(topics)}</p>
<p style="margin:24px 0;"><a href="${esc(confirmUrl)}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:#ffd60a;color:#000000;font-weight:600;text-decoration:none;border:1px solid #000000;">Confirm subscription</a></p>
<p style="margin:0 0 16px;font-size:14px;color:#555555;">Or open this link: <a href="${esc(confirmUrl)}" style="color:#000000;">${esc(confirmUrl)}</a></p>
<p style="margin:0 0 16px;font-size:14px;color:#555555;">If you didn't ask for this, ignore this email. Nothing more will be sent, and the request is deleted after 30 days.</p>
<p style="margin:32px 0 0;font-size:13px;color:#555555;">${esc(SENDER_IDENTITY)} · <a href="${SITE}" style="color:#555555;">shadynotes.app</a> · ${CONTACT}</p>
</div></body></html>`;
  return { ...envelope(to), subject, text, html };
}
