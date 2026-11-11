// Short links for the launch campaign: go.shadynotes.app/<source>[/<content>]
// 302 to the site with UTMs (launch plan 2.3, Appendix D). Add a source here,
// not a one-off link: any content slug works under a known source.
//
//   go.shadynotes.app/hn                 -> utm_source=hn, utm_content=post
//   go.shadynotes.app/x/tables           -> utm_source=x,  utm_content=tables
//   go.shadynotes.app/reddit/macapps     -> utm_source=reddit, utm_content=macapps
export const CAMPAIGN = "launch_2026q4";
export const SITE = "https://shadynotes.app/";

/** source slug (what you type) -> utm_source, utm_medium */
export const SOURCES = {
  reddit: ["reddit", "community"],
  hn: ["hn", "community"],
  ph: ["producthunt", "community"],
  discord: ["discord", "community"],
  x: ["x", "organic_social"],
  yt: ["youtube", "organic_social"],
  tiktok: ["tiktok", "organic_social"],
  ig: ["instagram", "organic_social"],
  threads: ["threads", "organic_social"],
  bsky: ["bluesky", "organic_social"],
  mastodon: ["mastodon", "organic_social"],
  alt: ["alternativeto", "directory"],
  gh: ["github", "directory"],
  news: ["newsletter", "email"],
};

/** Optional landing page per content slug; anything else lands on the homepage. */
export const PAGES = {
  pricing: "pricing",
  download: "download",
};

const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;

/**
 * @param {string} pathname
 * @returns {{ location: string, source: string, content: string } | null}
 *   null = not a campaign link (send to the homepage, count nothing)
 */
export function resolve(pathname) {
  const parts = pathname.toLowerCase().split("/").filter(Boolean);
  if (parts.length < 1 || parts.length > 2) return null;
  const [src, content = "post"] = parts;
  const source = SOURCES[src];
  if (!source || !SLUG.test(content)) return null;
  const url = new URL(PAGES[content] ?? "", SITE);
  url.searchParams.set("utm_source", source[0]);
  url.searchParams.set("utm_medium", source[1]);
  url.searchParams.set("utm_campaign", CAMPAIGN);
  url.searchParams.set("utm_content", content);
  return { location: url.href, source: src, content };
}

// Link-preview fetchers and crawlers. They follow every posted link once (or
// often), so counting them would inflate exactly the posts with the most shares.
const BOT = /bot|crawl|spider|preview|facebookexternalhit|embedly|slack|discord|whatsapp|telegram|skype|vkshare|bluesky|mastodon|lighthouse|headless|curl|wget|python|go-http|okhttp|java\//i;

/** @param {string | null} ua */
export function isBot(ua) {
  return !ua || BOT.test(ua);
}
