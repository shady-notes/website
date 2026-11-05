// Turn a blog post into the newsletter email: HTML with inline styles (mail
// clients drop <style>), a plain-text part, and `{{unsubscribe_url}}` for the
// Worker to fill in per reader. Every link and image is absolute, because
// relative URLs break in email.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { Marked } from "marked";

export const UNSUBSCRIBE_PLACEHOLDER = "{{unsubscribe_url}}";
const TOPIC_LABELS = { "release-news": "Release news", "how-to": "How-to", "behind-the-scenes": "Behind the scenes" };
const DATED = /^(\d{4}-\d{2}-\d{2})-(.+)$/;

/** Find and parse `src/content/blog/YYYY-MM-DD-<slug>/index.md`. */
export function loadPost(blogDir, slug) {
  const matches = readdirSync(blogDir, { withFileTypes: true }).filter(
    (d) => d.isDirectory() && DATED.exec(d.name)?.[2] === slug,
  );
  if (matches.length !== 1) throw new Error(`No post folder for slug "${slug}" in ${blogDir}`);
  const folder = matches[0].name;
  const source = readFileSync(join(blogDir, folder, "index.md"), "utf8");
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  if (!m) throw new Error(`${folder}/index.md has no front matter`);
  const data = parseYaml(m[1]);
  return { slug, folder, data: { ...data, date: String(data.date) }, body: m[2] };
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/** "2026-11-06" -> "6 November 2026" (STYLE.md date format). */
export function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

const FENCE = /(^```[^\n]*\n[\s\S]*?^```[ \t]*$)/m;

/** Apply `fn` to the Markdown outside fenced code blocks only. */
const outsideFences = (md, fn) =>
  md
    .split(FENCE)
    .map((part, i) => (i % 2 === 1 ? part : fn(part)))
    .join("");

/** `> [!TIP] Optional title` -> `> **Tip**` (email clients cannot render callouts). */
const flattenCallouts = (md) =>
  outsideFences(md, (prose) =>
    prose.replace(/^>\s*\[!([A-Za-z]+)\][+-]?[ \t]*(.*)$/gm, (_, type, title) => {
      const label = title.trim() || type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
      return `> **${label}**`;
    }),
  );

/**
 * Absolute URL for a link or image in the post.
 * @param {string} href @param {{site:string,pageUrl:string,images?:Map<string,string>,alt?:string,image?:boolean}} ctx
 */
function absolute(href, ctx) {
  if (/^(https?:|mailto:)/i.test(href)) return href;
  if (href.startsWith("#")) return `${ctx.pageUrl}${href}`;
  if (href.startsWith("/")) return `${ctx.site}${href}`;
  if (ctx.image) {
    // Astro fingerprints post images (/_astro/<hash>.webp), so take the URL
    // from the live page, matched by alt text.
    const live = ctx.images?.get(ctx.alt ?? "");
    if (live) return live;
    throw new Error(`Image "${href}" (alt "${ctx.alt}") is not on the live page; publish and deploy first`);
  }
  throw new Error(`Relative link "${href}": links in posts must be absolute (STYLE.md)`);
}

const STYLE = {
  h2: "font-size:21px;line-height:1.25;letter-spacing:-0.01em;margin:32px 0 12px;color:#000000;",
  h3: "font-size:18px;line-height:1.3;margin:24px 0 8px;color:#000000;",
  p: "margin:0 0 16px;",
  ul: "margin:0 0 16px;padding-left:24px;",
  ol: "margin:0 0 16px;padding-left:24px;",
  li: "margin:0 0 6px;",
  blockquote: "margin:0 0 16px;padding:12px 16px;border-left:4px solid #ffd60a;background:#fff9dc;",
  pre: "margin:0 0 16px;padding:12px 14px;background:#f4f4f4;border-radius:8px;overflow-x:auto;font-size:14px;line-height:1.45;",
  code: "font-family:SFMono-Regular,Menlo,Consolas,monospace;font-size:0.9em;",
  a: "color:#000000;text-decoration:underline;",
  img: "max-width:100%;height:auto;border:0;",
  hr: "border:0;border-top:1px solid #dddddd;margin:24px 0;",
};

/** Add inline styles to the plain tags marked emits. */
function inlineStyles(html) {
  let out = html;
  for (const tag of ["h2", "h3", "p", "ul", "ol", "li", "blockquote", "pre"]) {
    out = out.replace(new RegExp(`<${tag}>`, "g"), `<${tag} style="${STYLE[tag]}">`);
  }
  out = out.replace(/<ol start="(\d+)">/g, `<ol start="$1" style="${STYLE.ol}">`);
  out = out.replace(/<code(\s[^>]*)?>/g, (_, attrs = "") => `<code${attrs} style="${STYLE.code}">`);
  out = out.replace(/<a /g, `<a style="${STYLE.a}" `);
  out = out.replace(/<img /g, `<img style="${STYLE.img}" `);
  out = out.replace(/<hr>/g, `<hr style="${STYLE.hr}">`);
  return out;
}

function proseToText(prose, ctx) {
  let t = prose.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt) => `[Image: ${alt}]`);
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const url = absolute(href, ctx);
    return url === label ? url : `${label} (${url})`;
  });
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/(^|[^`])`([^`\n]+)`/g, "$1$2");
  return t.replace(/^#{2,6}[ \t]+(.+)$/gm, (_, h) => `${h}\n${"-".repeat(h.length)}`);
}

function toText(md, ctx) {
  const t = flattenCallouts(md)
    .split(FENCE)
    .map((part, i) =>
      i % 2 === 1
        ? part
            .replace(/^```[^\n]*\n/, "")
            .replace(/\n?```[ \t]*$/, "")
            .replace(/^/gm, "    ")
        : proseToText(part, ctx),
    )
    .join("");
  return t.replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").replace(/\s+$/, "");
}

/**
 * @param {{slug:string,data:any,body:string}} post
 * @param {{site:string, images?:Map<string,string>}} options images: alt -> absolute URL from the live page
 */
export function renderEmail(post, { site, images = new Map() }) {
  const { title, summary, date, topics } = post.data;
  const pageUrl = `${site}/blog/${post.slug}/`;
  const ctx = { site, pageUrl, images };

  const marked = new Marked({ gfm: true, async: false });
  marked.use({
    walkTokens(token) {
      if (token.type === "link") token.href = absolute(token.href, ctx);
      if (token.type === "image") token.href = absolute(token.href, { ...ctx, image: true, alt: token.text });
    },
  });
  const bodyHtml = inlineStyles(/** @type {string} */ (marked.parse(flattenCallouts(post.body))));
  const topicLabels = topics.map((t) => TOPIC_LABELS[t] ?? t).join(", ");
  const when = formatDate(date);

  const html = `<!doctype html>
<html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light dark"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(summary)}</div>
<div style="max-width:600px;margin:0 auto;padding:32px 20px;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#000000;">
<p style="margin:0 0 4px;font-size:13px;color:#555555;"><strong style="color:#000000;">Shady Notes</strong> · ${esc(when)} · ${esc(topicLabels)}</p>
<h1 style="margin:8px 0 20px;font-size:28px;line-height:1.2;letter-spacing:-0.02em;color:#000000;">${esc(title)}</h1>
${bodyHtml}
<hr style="${STYLE.hr}">
<p style="margin:0 0 8px;font-size:13px;color:#555555;">Read this post on the web: <a href="${esc(pageUrl)}" style="color:#555555;">${esc(pageUrl)}</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#555555;">You get this email because you subscribed to new Shady Notes posts at shadynotes.app. <a href="${UNSUBSCRIBE_PLACEHOLDER}" style="color:#555555;">Unsubscribe</a> in one click.</p>
<p style="margin:0;font-size:13px;color:#555555;">Round Rect (ROUNDRECT PTY LTD) · hello@shadynotes.app</p>
</div></body></html>`;

  const text = `${title}
${when} · ${topicLabels}

${toText(post.body, ctx)}

--
Read this post on the web: ${pageUrl}
You get this email because you subscribed to new Shady Notes posts at shadynotes.app.
Unsubscribe in one click: ${UNSUBSCRIBE_PLACEHOLDER}
Round Rect (ROUNDRECT PTY LTD) · hello@shadynotes.app
`;

  return { slug: post.slug, subject: title, html, text, topics: [...topics], pageUrl };
}

/** Map alt text -> absolute src for every <img> on a page. */
export function imagesFromPage(pageHtml, site) {
  const map = new Map();
  for (const tag of pageHtml.match(/<img\b[^>]*>/gi) ?? []) {
    const src = /\ssrc="([^"]+)"/i.exec(tag)?.[1];
    const alt = /\salt="([^"]*)"/i.exec(tag)?.[1];
    if (!src || alt === undefined) continue;
    const decoded = alt.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    map.set(decoded, src.startsWith("http") ? src : `${site}${src.startsWith("/") ? "" : "/"}${src}`);
  }
  return map;
}

/** Every image URL used in the rendered HTML (for the live 200 check). */
export const imageUrls = (html) => [...html.matchAll(/<img\b[^>]*\ssrc="([^"]+)"/gi)].map((m) => m[1]);
