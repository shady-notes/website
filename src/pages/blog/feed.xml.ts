import type { APIRoute } from "astro";
import { getPosts, postUrl } from "~/lib/blog";
import { FEED_ID_BASE, FEED_SUBTITLE, FEED_TITLE, TOPICS } from "~/config/blog";

// Atom feed of published posts. Entry <id>s are FEED_ID_BASE + slug and must
// never change (config/blog.ts). Entries carry the summary and a link rather
// than the full body: the post page is the canonical reading surface.

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const GET: APIRoute = async ({ site }) => {
  const posts = (await getPosts()).filter((p) => !p.isDraft);
  const base = site!;
  const self = new URL("/blog/feed.xml", base).href;
  const home = new URL("/blog/", base).href;
  const updated = (posts[0]?.data.date ?? new Date("2026-11-01T00:00:00Z")).toISOString();

  const entries = posts
    .map((p) => {
      const url = new URL(postUrl(p.slug), base).href;
      const when = p.data.date.toISOString();
      const cats = p.data.topics
        .map((t) => `    <category term="${t}" label="${esc(TOPICS[t].label)}"/>`)
        .join("\n");
      return `  <entry>
    <id>${FEED_ID_BASE}${p.slug}</id>
    <title>${esc(p.data.title)}</title>
    <link rel="alternate" type="text/html" href="${url}"/>
    <published>${when}</published>
    <updated>${when}</updated>
    <summary>${esc(p.data.summary)}</summary>
${cats}
  </entry>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${FEED_ID_BASE}</id>
  <title>${esc(FEED_TITLE)}</title>
  <subtitle>${esc(FEED_SUBTITLE)}</subtitle>
  <link rel="self" type="application/atom+xml" href="${self}"/>
  <link rel="alternate" type="text/html" href="${home}"/>
  <updated>${updated}</updated>
  <author><name>Round Rect</name></author>
  <icon>${new URL("/favicon.png", base).href}</icon>
${entries}
</feed>
`;
  return new Response(xml, { headers: { "Content-Type": "application/atom+xml; charset=utf-8" } });
};
