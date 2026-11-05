#!/usr/bin/env node
// Send a published blog post as the newsletter (playbook §6.4).
//
//   node tools/post.mjs preview <slug> [--out DIR]   render HTML and text, send nothing
//   node tools/post.mjs test    <slug>               one copy to TEST_RECIPIENTS; records the exact rendering
//   node tools/post.mjs send    <slug> [--limit N] [--yes]
//   node tools/post.mjs status  <slug>               counts only, never addresses
//
// `send` refuses unless the post is published with `email: true`, its page and
// every image answer 200 on the live site, and this exact rendering was sent
// with `test` (change a word, test again). It sends in batches of 100, can be
// re-run after any failure or a Resend daily limit, and never mails anyone twice.
//
// Options: --api URL (default https://subscribe.shadynotes.app), --site URL
// (default https://shadynotes.app). The admin key comes from NEWSLETTER_ADMIN_KEY
// or the macOS keychain item `shadynotes-newsletter` / account `admin`.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { loadPost, renderEmail, imagesFromPage, imageUrls } from "./render.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const BLOG_DIR = resolve(HERE, "../../src/content/blog");
const UA = "shadynotes-newsletter/1 (+https://shadynotes.app)";

function parseArgs(argv) {
  const [command, slug, ...rest] = argv;
  const opts = { api: "https://subscribe.shadynotes.app", site: "https://shadynotes.app", out: "", limit: 0, yes: false };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--yes") opts.yes = true;
    else if (["--api", "--site", "--out", "--limit"].includes(a) && rest[i + 1]) opts[a.slice(2)] = rest[++i];
    else throw new Error(`Unknown option ${a}`);
  }
  opts.limit = Number(opts.limit) || 0;
  opts.api = opts.api.replace(/\/$/, "");
  opts.site = opts.site.replace(/\/$/, "");
  if (!["preview", "test", "send", "status"].includes(command) || !slug) {
    throw new Error("Usage: node tools/post.mjs <preview|test|send|status> <slug> [--out DIR] [--limit N] [--yes] [--api URL] [--site URL]");
  }
  return { command, slug, opts };
}

function adminKey() {
  if (process.env.NEWSLETTER_ADMIN_KEY) return process.env.NEWSLETTER_ADMIN_KEY;
  try {
    return execFileSync("security", ["find-generic-password", "-s", "shadynotes-newsletter", "-a", "admin", "-w"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new Error("No admin key: set NEWSLETTER_ADMIN_KEY or add keychain item shadynotes-newsletter / admin");
  }
}

async function api(opts, method, path, body) {
  const res = await fetch(`${opts.api}${path}`, {
    method,
    headers: { authorization: `Bearer ${adminKey()}`, "content-type": "application/json", "user-agent": UA },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

/** The live page must answer 200; returns alt -> image URL from it. */
async function livePage(opts, slug, required) {
  const url = `${opts.site}/blog/${slug}/`;
  const res = await fetch(url, { headers: { "user-agent": UA } }).catch(() => null);
  if (!res || res.status !== 200) {
    if (required) throw new Error(`${url} answers ${res?.status ?? "no response"}: publish and deploy the post first`);
    return new Map();
  }
  return imagesFromPage(await res.text(), opts.site);
}

async function checkImages(html) {
  for (const src of imageUrls(html)) {
    const res = await fetch(src, { headers: { "user-agent": UA } }).catch(() => null);
    if (!res || res.status !== 200) throw new Error(`Image ${src} answers ${res?.status ?? "no response"}`);
  }
}

async function prepare(slug, opts, { live }) {
  const post = loadPost(BLOG_DIR, slug);
  if (live) {
    if (post.data.status !== "published") throw new Error(`${slug} is status: ${post.data.status}; publish it first`);
    if (post.data.email !== true) throw new Error(`${slug} has email: false; it is blog-only`);
  }
  const images = await livePage(opts, slug, live);
  const email = renderEmail(post, { site: opts.site, images });
  if (live) await checkImages(email.html);
  return { post, email };
}

const localHash = (e) =>
  createHash("sha256").update(JSON.stringify([e.subject, e.html, e.text, e.topics])).digest("hex");

const issueBody = (e) => ({ slug: e.slug, subject: e.subject, html: e.html, text: e.text, topics: e.topics });

async function main() {
  const { command, slug, opts } = parseArgs(process.argv.slice(2));

  if (command === "preview") {
    const { email } = await prepare(slug, opts, { live: false });
    const out = resolve(opts.out || join(process.env.TMPDIR ?? "/tmp", `newsletter-${slug}`));
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "email.html"), email.html);
    writeFileSync(join(out, "email.txt"), email.text);
    console.log(`Subject: ${email.subject}\nTopics:  ${email.topics.join(", ")}\nHash:    ${localHash(email)}`);
    console.log(`Wrote ${join(out, "email.html")} and ${join(out, "email.txt")}. Nothing was sent.`);
    return;
  }

  if (command === "status") {
    const { email } = await prepare(slug, opts, { live: false });
    const { status, data } = await api(opts, "POST", "/v1/admin/issues/status", { slug, topics: email.topics });
    if (status !== 200) throw new Error(`status failed: ${status} ${JSON.stringify(data)}`);
    const current = data.tested_hash === localHash(email);
    console.log(`Tested:    ${data.tested ? `yes, ${data.tested_at}${current ? "" : " (the rendering has changed since)"}` : "no"}`);
    console.log(`Sent:      ${data.sent}`);
    console.log(`In flight: ${data.claimed}`);
    console.log(`Remaining: ${data.remaining}`);
    return;
  }

  const { email } = await prepare(slug, opts, { live: true });

  if (command === "test") {
    const { status, data } = await api(opts, "POST", "/v1/admin/issues/test", issueBody(email));
    if (status === 409) throw new Error("Sending has already started for this post; a new test cannot replace it.");
    if (status !== 200) throw new Error(`test failed: ${status} ${JSON.stringify(data)}`);
    console.log(`Sent a test copy to ${data.sent_to} address(es). Hash ${data.hash}.`);
    console.log("Check it in Gmail and Apple Mail, light and dark, then run `send`.");
    return;
  }

  // send
  const { data: before } = await api(opts, "POST", "/v1/admin/issues/status", { slug, topics: email.topics });
  if (!before.tested || before.tested_hash !== localHash(email)) {
    throw new Error("This exact rendering has not been test-sent. Run `test` first (again, if you changed anything).");
  }
  const audience = opts.limit ? Math.min(opts.limit, before.remaining) : before.remaining;
  if (before.remaining === 0 && before.claimed === 0) {
    console.log(`Nothing to send: ${before.sent} sent, nobody left.`);
    return;
  }
  console.log(`"${email.subject}" to ${audience} subscriber(s) (topics: ${email.topics.join(", ")}). Already sent: ${before.sent}.`);
  if (!opts.yes) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question("Send now? Type yes: ");
    rl.close();
    if (answer.trim() !== "yes") {
      console.log("Not sent.");
      return;
    }
  }

  let total = 0;
  for (;;) {
    const left = opts.limit ? opts.limit - total : 100;
    if (left <= 0) break;
    const { status, data } = await api(opts, "POST", "/v1/admin/issues/send", { ...issueBody(email), limit: Math.min(left, 100) });
    if (status === 429) {
      console.log(`Resend's sending limit was reached after ${total} this run. Run the same command again later; nobody gets it twice.`);
      process.exitCode = 2;
      return;
    }
    if (status !== 200) throw new Error(`send failed after ${total} this run: ${status} ${JSON.stringify(data)}. Re-run to retry.`);
    total += data.sent;
    console.log(`Sent ${data.sent} (total ${total}), ${data.remaining} remaining.`);
    if (data.done) break;
  }
  console.log(`Done: ${total} sent this run.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
