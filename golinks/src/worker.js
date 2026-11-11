// go.shadynotes.app: campaign short links (launch plan 2.3–2.4).
//
//   GET /<source>[/<content>]   302 to shadynotes.app with UTMs, +1 click
//   anything else               302 to the homepage, counts nothing
//
// The count is the only per-channel number that needs no consent: a row per
// (UTC day, source, content) with a number. No IP, user agent, referrer or
// cookie is stored, and request logs are off (wrangler.toml).
import { resolve, isBot, SITE } from "./links.js";

/** @param {any} env @param {string} source @param {string} content */
export async function count(env, source, content) {
  const day = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    `INSERT INTO clicks (day, source, content, n) VALUES (?1, ?2, ?3, 1)
     ON CONFLICT (day, source, content) DO UPDATE SET n = n + 1`,
  )
    .bind(day, source, content)
    .run();
}

export default {
  /** @param {Request} request @param {any} env @param {ExecutionContext} ctx */
  async fetch(request, env, ctx) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
    }
    const link = resolve(new URL(request.url).pathname);
    const headers = {
      location: link ? link.location : SITE,
      "cache-control": "no-store", // every click must reach the Worker to be counted
      "referrer-policy": "no-referrer",
    };
    if (link && request.method === "GET" && !isBot(request.headers.get("user-agent"))) {
      ctx.waitUntil(count(env, link.source, link.content).catch(() => {}));
    }
    return new Response(null, { status: 302, headers });
  },
};
