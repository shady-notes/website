#!/usr/bin/env node
// A stand-in for the Resend API, for local runs only. Accepts POST /emails and
// /emails/batch, appends each message to <dir>/mail.jsonl, and answers like
// Resend. Set RESEND_API_BASE=http://127.0.0.1:<port> in .dev.vars to use it.
//   node scripts/fake-resend.mjs <dir> [port]
import { createServer } from "node:http";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const [dir, port = "8788"] = process.argv.slice(2);
if (!dir) throw new Error("usage: fake-resend.mjs <dir> [port]");
mkdirSync(dir, { recursive: true });
const log = join(dir, "mail.jsonl");
const seen = new Map(); // idempotency key -> response, like Resend's 24h window
let n = 0;

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const reply = (status, data) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(data));
    };
    if (req.method !== "POST" || !["/emails", "/emails/batch"].includes(req.url)) return reply(404, { message: "not found" });
    if (!/^Bearer re_/.test(req.headers.authorization ?? "")) return reply(401, { message: "bad key" });
    const key = req.headers["idempotency-key"];
    if (key && seen.has(key)) return reply(200, seen.get(key));
    const messages = req.url === "/emails" ? [JSON.parse(body)] : JSON.parse(body);
    const ids = messages.map((m) => {
      const id = `fake_${++n}`;
      appendFileSync(log, `${JSON.stringify({ id, path: req.url, idempotencyKey: key ?? null, ...m })}\n`);
      return { id };
    });
    const data = req.url === "/emails" ? ids[0] : { data: ids };
    if (key) seen.set(key, data);
    reply(200, data);
  });
}).listen(Number(port), "127.0.0.1", () => console.log(`fake Resend on http://127.0.0.1:${port}, logging to ${log}`));
