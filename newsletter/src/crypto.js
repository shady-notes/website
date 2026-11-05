const enc = new TextEncoder();

/** @param {ArrayBuffer|Uint8Array} buf */
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** @param {Uint8Array} bytes */
export function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** @param {Uint8Array} bytes */
const b64 = (bytes) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

/** @param {string} s */
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** @param {string} s */
export async function sha256Hex(s) {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

export function randomToken(bytes = 32) {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return b64url(b);
}

/** @param {Uint8Array|string} key @param {string} message */
async function hmac(key, message) {
  const raw = typeof key === "string" ? enc.encode(key) : key;
  const k = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
}

/** Constant-time string comparison. @param {string} a @param {string} b */
export function safeEqual(a, b) {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

// Unsubscribe tokens are derived, not stored: `<id>.<HMAC(TOKEN_SECRET, "u:<id>")>`.
// They never expire, so a link in an old email keeps working; rotating
// TOKEN_SECRET invalidates every one of them.

/** @param {string} secret @param {number} id */
export async function unsubscribeToken(secret, id) {
  const sig = await hmac(secret, `u:${id}`);
  return `${id}.${b64url(sig.slice(0, 16))}`;
}

/** @returns {Promise<number|null>} the sign-up id, or null. @param {string} secret @param {string} token */
export async function verifyUnsubscribeToken(secret, token) {
  const m = /^(\d{1,12})\.([A-Za-z0-9_-]{22})$/.exec(token);
  if (!m || !secret) return null;
  const id = Number(m[1]);
  return safeEqual(await unsubscribeToken(secret, id), token) ? id : null;
}

/**
 * Verify a Resend (Svix) webhook signature.
 * Signed content is `${svix-id}.${svix-timestamp}.${body}`, HMAC-SHA256 with the
 * base64 key after the `whsec_` prefix; the header holds `v1,<base64>` entries.
 * @param {string} secret @param {Headers} headers @param {string} body
 */
export async function verifyWebhook(secret, headers, body, nowSeconds = Math.floor(Date.now() / 1000)) {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!id || !timestamp || !signatures || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > 300) return false;
  let key;
  try {
    key = fromB64(secret.replace(/^whsec_/, ""));
  } catch {
    return false;
  }
  const expected = b64(await hmac(key, `${id}.${timestamp}.${body}`));
  return signatures.split(" ").some((entry) => {
    const [version, sig] = entry.split(",");
    return version === "v1" && typeof sig === "string" && safeEqual(sig, expected);
  });
}

/** For tests and tools: sign a webhook body the way Resend does. */
export async function signWebhook(secret, id, timestamp, body) {
  return `v1,${b64(await hmac(fromB64(secret.replace(/^whsec_/, "")), `${id}.${timestamp}.${body}`))}`;
}
