// Test doubles: a D1-shaped wrapper over node:sqlite, a fake Resend behind
// globalThis.fetch, and a ready-made env.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import worker from "../src/worker.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

class Statement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  bind(...params) {
    for (const p of params) if (p === undefined) throw new Error("D1_TYPE_ERROR: undefined is not a supported type");
    return new Statement(this.db, this.sql, params);
  }
  async first(column) {
    const row = this.db.prepare(this.sql).get(...this.params);
    if (!row) return null;
    return column ? row[column] : { ...row };
  }
  async all() {
    return { success: true, results: this.db.prepare(this.sql).all(...this.params).map((r) => ({ ...r })) };
  }
  async run() {
    const info = this.db.prepare(this.sql).run(...this.params);
    return { success: true, meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } };
  }
}

export function createD1() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  const dir = join(ROOT, "migrations");
  for (const f of readdirSync(dir).sort()) db.exec(readFileSync(join(dir, f), "utf8"));
  return {
    raw: db,
    prepare: (sql) => new Statement(db, sql),
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const out = [];
        for (const s of statements) out.push(await s.all());
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}

/** Replace fetch with a fake Resend. `respond` can be swapped per test. */
export function fakeResend() {
  const calls = [];
  const fake = {
    calls,
    respond: (path, body) => {
      if (path === "/emails/batch") return { status: 200, body: { data: body.map((_, i) => ({ id: `re_${calls.length}_${i}` })) } };
      return { status: 200, body: { id: `re_${calls.length}` } };
    },
  };
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = new URL(url);
    if (u.origin !== "https://api.resend.test") return original(url, init);
    const body = JSON.parse(init.body);
    const headers = Object.fromEntries(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    calls.push({ path: u.pathname, body, headers });
    const r = fake.respond(u.pathname, body, headers);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json" } });
  };
  fake.restore = () => {
    globalThis.fetch = original;
  };
  return fake;
}

export const WEBHOOK_SECRET = `whsec_${Buffer.from("webhook-test-secret-0123456789").toString("base64")}`;

export function makeEnv(overrides = {}) {
  return {
    DB: createD1(),
    SUBSCRIBE_ORIGIN: "https://subscribe.shadynotes.app",
    POLICY_VERSION: "2026-11-06",
    CONSENT_WORDING: "Email me new Shady Notes posts on the topics I picked.",
    TEST_RECIPIENTS: "privacy@example.com",
    DAILY_CONFIRM_CAP: "200",
    RESEND_API_BASE: "https://api.resend.test",
    RESEND_API_KEY: "re_test",
    ADMIN_KEY: "admin-test-key",
    RESEND_WEBHOOK_SECRET: WEBHOOK_SECRET,
    LIMITER_SALT: "salt",
    TOKEN_SECRET: "token-secret",
    ...overrides,
  };
}

export const ORIGIN = "https://shadynotes.app";

/** Call the Worker like Cloudflare would. */
export function call(env, method, path, { body, headers = {}, origin = ORIGIN, raw } = {}) {
  const h = new Headers(headers);
  if (origin) h.set("origin", origin);
  if (body !== undefined && !h.has("content-type")) h.set("content-type", "application/json");
  h.set("cf-connecting-ip", h.get("cf-connecting-ip") ?? "203.0.113.7");
  const init = { method, headers: h };
  if (raw !== undefined) init.body = raw;
  else if (body !== undefined) init.body = JSON.stringify(body);
  return worker.fetch(new Request(`https://subscribe.shadynotes.app${path}`, init), env);
}

export const admin = (env, method, path, body) =>
  call(env, method, path, { body, origin: null, headers: { authorization: `Bearer ${env.ADMIN_KEY}` } });

/** Sign up and confirm an address; returns its row. */
export async function subscribe(env, resend, email, interests = ["how-to"]) {
  const before = resend.calls.length;
  const res = await call(env, "POST", "/v1/signup", { body: { email, interests, source: "blog-index" } });
  if (res.status !== 202) throw new Error(`signup ${res.status}`);
  const token = confirmTokenFrom(resend.calls[before]);
  const done = await call(env, "POST", `/c/${token}`, { origin: null });
  if (done.status !== 200) throw new Error(`confirm ${done.status}`);
  return env.DB.prepare("SELECT * FROM signups WHERE email = ?").bind(email).first();
}

export const confirmTokenFrom = (call) => /\/c\/([A-Za-z0-9_-]{43})/.exec(call.body.text)?.[1];
