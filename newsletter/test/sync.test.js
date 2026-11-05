// The Worker and the site must agree on the consent wording and the topic ids.
// If either drifts, a sign-up would record wording the visitor never saw, or
// reject a topic the form offers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { TOPIC_IDS, TOPICS } from "../src/config.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(HERE, p), "utf8");

test("CONSENT_WORDING in wrangler.toml equals the site's consentWording", () => {
  const site = /consentWording:\s*\n?\s*"((?:[^"\\]|\\.)*)"/.exec(read("../../src/config/site.ts"))?.[1];
  const worker = /^CONSENT_WORDING\s*=\s*"((?:[^"\\]|\\.)*)"/m.exec(read("../wrangler.toml"))?.[1];
  assert.ok(site && worker);
  assert.equal(worker, site);
});

test("topic ids match src/config/blog.ts", () => {
  const blog = read("../../src/config/blog.ts");
  const block = /export const TOPICS = \{([\s\S]*?)\n\} as const;/.exec(blog)?.[1] ?? "";
  const ids = [...block.matchAll(/^ {2}"([a-z-]+)": \{/gm)].map((m) => m[1]);
  assert.deepEqual(TOPIC_IDS, ids);
  const labels = [...block.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(Object.values(TOPICS), labels);
});

test("tools/render.js uses the same topic labels", () => {
  const render = read("../tools/render.js");
  for (const [id, label] of Object.entries(TOPICS)) assert.ok(render.includes(`"${id}": "${label}"`), id);
});
