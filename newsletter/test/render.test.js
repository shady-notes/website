import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadPost, renderEmail, imagesFromPage, imageUrls, formatDate } from "../tools/render.js";

const BLOG = join(dirname(fileURLToPath(import.meta.url)), "../../src/content/blog");
const SITE = "https://shadynotes.app";

const post = (body, data = {}) => ({
  slug: "example",
  data: { title: "Example", summary: "One sentence.", date: "2026-11-06", topics: ["how-to"], ...data },
  body,
});

test("every published post renders, with absolute links and the unsubscribe placeholder", () => {
  for (const slug of ["hello-blog", "plain-markdown-files", "open-the-shade", "navigator-tabs", "callouts", "images-in-notes", "themes"]) {
    const email = renderEmail(loadPost(BLOG, slug), { site: SITE });
    assert.ok(email.html.includes("{{unsubscribe_url}}"), slug);
    assert.ok(email.text.includes("{{unsubscribe_url}}"), slug);
    for (const [, href] of email.html.matchAll(/href="([^"]+)"/g)) {
      assert.match(href, /^(https:\/\/|mailto:|\{\{unsubscribe_url\}\})/, `${slug}: ${href}`);
    }
    assert.ok(email.text.includes(`${SITE}/blog/${slug}/`));
  }
});

test("subject, preheader, date and topics come from the front matter", () => {
  const email = renderEmail(post("Body."), { site: SITE });
  assert.equal(email.subject, "Example");
  assert.deepEqual(email.topics, ["how-to"]);
  assert.match(email.html, /6 November 2026/);
  assert.match(email.html, /display:none[^>]*>One sentence\./);
});

test("site-relative links become absolute; relative links are refused", () => {
  const email = renderEmail(post("See [pricing](/pricing) and [below](#faq)."), { site: SITE });
  assert.ok(email.html.includes('href="https://shadynotes.app/pricing"'));
  assert.ok(email.html.includes('href="https://shadynotes.app/blog/example/#faq"'));
  assert.ok(email.text.includes("pricing (https://shadynotes.app/pricing)"));
  assert.throws(() => renderEmail(post("[x](./other)"), { site: SITE }), /must be absolute/);
});

test("post images take their fingerprinted URL from the live page", () => {
  const page = '<img src="/_astro/shot.abc123.webp" alt="The theme picker" width="800">';
  const images = imagesFromPage(page, SITE);
  const email = renderEmail(post("![The theme picker](./shot.png)"), { site: SITE, images });
  assert.deepEqual(imageUrls(email.html), ["https://shadynotes.app/_astro/shot.abc123.webp"]);
  assert.match(email.text, /\[Image: The theme picker\]/);
  assert.throws(() => renderEmail(post("![Missing](./nope.png)"), { site: SITE }), /not on the live page/);
});

test("callouts flatten to a bold label; code keeps its text", () => {
  const email = renderEmail(post("> [!WARNING]\n> Careful.\n\n```\nnpm run build\n```"), { site: SITE });
  assert.match(email.html, /<blockquote style="[^"]+">\s*<p style="[^"]+"><strong>Warning<\/strong>/);
  assert.ok(!email.html.includes("[!WARNING]"));
  assert.match(email.html, /<pre style="[^"]+"><code style="[^"]+">npm run build/);
  assert.match(email.text, /Warning/);
  assert.match(email.text, /^ {4}npm run build$/m);
});

test("code blocks are left exactly as written", () => {
  const md = "```\n> [!TIP]\n> **bold** [x](./rel)\n```\n\nAfter.";
  const email = renderEmail(post(md), { site: SITE });
  assert.ok(email.html.includes("&gt; [!TIP]\n&gt; **bold** [x](./rel)"));
  assert.match(email.text, /^ {4}> \[!TIP\]$/m);
  assert.match(email.text, /^ {4}> \*\*bold\*\* \[x\]\(\.\/rel\)$/m);
});

test("formatDate uses the STYLE.md format", () => {
  assert.equal(formatDate("2026-11-01"), "1 November 2026");
});
