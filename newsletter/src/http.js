import { SITE_ORIGINS } from "./config.js";

export class HttpError extends Error {
  /** @param {number} status @param {string} code @param {Record<string,string>} [headers] */
  constructor(status, code, headers = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

/** @param {unknown} body @param {number} [status] @param {Record<string,string>} [headers] */
export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

/** @param {any} env */
export function allowedOrigins(env) {
  const extra = String(env.EXTRA_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...SITE_ORIGINS, ...extra];
}

/** CORS headers for an allowed origin, or null. @param {string|null} origin @param {any} env */
export function corsHeaders(origin, env) {
  if (!origin || !allowedOrigins(env).includes(origin)) return null;
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

/** Parse a small JSON body; anything else is a 400. @param {Request} request */
export async function readJson(request, headers = {}, maxBytes = 64 * 1024) {
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, "too-large", headers);
  try {
    const value = JSON.parse(text);
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw new HttpError(400, "bad-json", headers);
  }
}

export const nowIso = () => new Date().toISOString();
/** @param {number} minutes */
export const minutesAgoIso = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();
/** @param {number} days */
export const daysAgoIso = (days) => new Date(Date.now() - days * 86_400_000).toISOString();
export const utcDay = () => new Date().toISOString().slice(0, 10);
