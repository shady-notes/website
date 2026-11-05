// subscribe.shadynotes.app: newsletter sign-up Worker (playbook §6.2).
//
//   OPTIONS/POST /v1/signup        the form on the blog; CORS for the site only
//   GET/POST     /c/<token>        confirm (GET shows a button, POST confirms)
//   GET/POST     /u/<token>        unsubscribe; POST is also RFC 8058 one-click
//   GET/POST     /r/<token>        subscribe again after unsubscribing
//   POST         /v1/resend/webhook  bounces and complaints -> suppressed
//   *            /v1/admin/*       ADMIN_KEY bearer; used by tools/post.mjs
//   cron                           retention
import { HttpError, json } from "./http.js";
import {
  handlePreflight,
  handleSignup,
  showConfirm,
  confirm,
  showUnsubscribe,
  unsubscribe,
  showResubscribe,
  resubscribe,
  handleWebhook,
  runRetention,
} from "./signup.js";
import { handleAdmin } from "./newsletter.js";

const TOKEN_ROUTE = /^\/([cur])\/([A-Za-z0-9._-]{1,200})$/;

/** @param {Request} request @param {any} env */
async function route(request, env) {
  const { pathname } = new URL(request.url);
  const method = request.method;

  if (pathname === "/v1/signup") {
    if (method === "OPTIONS") return handlePreflight(request, env);
    if (method === "POST") return handleSignup(request, env);
    throw new HttpError(405, "method");
  }

  const m = TOKEN_ROUTE.exec(pathname);
  if (m) {
    const [, kind, token] = m;
    if (method !== "GET" && method !== "POST") throw new HttpError(405, "method");
    const get = method === "GET";
    if (kind === "c") return get ? showConfirm(env, token) : confirm(env, token);
    if (kind === "u") return get ? showUnsubscribe(env, token) : unsubscribe(env, token);
    return get ? showResubscribe(env, token) : resubscribe(env, token);
  }

  if (pathname === "/v1/resend/webhook" && method === "POST") return handleWebhook(request, env);
  if (pathname.startsWith("/v1/admin/")) return handleAdmin(request, env, pathname);
  if (pathname === "/" && method === "GET") return Response.redirect("https://shadynotes.app/blog/", 302);
  throw new HttpError(404, "not-found");
}

export default {
  /** @param {Request} request @param {any} env */
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code }, e.status, e.headers);
      // Observability is off, so this reaches only a live `wrangler tail`.
      console.error("unhandled", e instanceof Error ? e.stack : e);
      return json({ error: "internal" }, 500);
    }
  },

  /** @param {any} _event @param {any} env @param {{waitUntil(p: Promise<unknown>): void}} ctx */
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runRetention(env));
  },
};
