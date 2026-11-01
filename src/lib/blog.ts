import { getCollection, type CollectionEntry } from "astro:content";
import { blogAddresses } from "~/data/blog-addresses";

export type Post = CollectionEntry<"blog"> & { slug: string; isDraft: boolean };

const FOLDER = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/**
 * Drafts are visible in `npm run dev` only (with a banner) — that is the local
 * preview. `npm run build` reads only `status: published`, so a draft never
 * reaches dist/ or the live site. (Committed drafts are still readable on GitHub:
 * this repo is public.)
 */
const includeDrafts = import.meta.env.DEV;

let cache: Promise<Post[]> | undefined;

/** Posts, newest first. Throws (failing the build) on any rule violation. */
export function getPosts(): Promise<Post[]> {
  cache ??= load();
  return cache;
}

async function load(): Promise<Post[]> {
  const entries = await getCollection("blog");
  const errors: string[] = [];
  const posts: Post[] = [];

  for (const entry of entries) {
    const where = `src/content/blog/${entry.id}/index.md`;
    const m = FOLDER.exec(entry.id);
    if (!m) {
      errors.push(`${where}: folder must be YYYY-MM-DD-slug (lowercase letters, digits, hyphens)`);
      continue;
    }
    const [, folderDate, slug] = m;
    const fmDate = entry.data.date.toISOString().slice(0, 10);
    if (fmDate !== folderDate) {
      errors.push(`${where}: date ${fmDate} does not match the folder date ${folderDate}`);
    }
    const isDraft = entry.data.status === "draft";
    if (isDraft && !includeDrafts) continue;
    posts.push({ ...entry, slug, isDraft });
  }

  const published = posts.filter((p) => !p.isDraft);
  const slugs = new Map<string, string>();
  for (const p of posts) {
    const other = slugs.get(p.slug);
    if (other) errors.push(`slug "${p.slug}" is used by both ${other} and ${p.id}`);
    slugs.set(p.slug, p.id);
  }

  // The address ledger (data/blog-addresses.ts).
  const { addresses, renamed, retired } = blogAddresses;
  const live = new Set(published.map((p) => p.slug));
  for (const p of posts) {
    if (retired.includes(p.slug)) {
      errors.push(`"${p.slug}" is a retired address and cannot be re-used — pick another slug`);
    }
  }
  for (const p of published) {
    if (!addresses.includes(p.slug)) {
      errors.push(
        `"${p.slug}" is published but not in src/data/blog-addresses.ts — add it to \`addresses\` (an address is permanent once public)`,
      );
    }
  }
  for (const a of addresses) {
    if (live.has(a) || retired.includes(a)) continue;
    if (a in renamed) {
      if (!live.has(renamed[a])) errors.push(`"${a}" is renamed to "${renamed[a]}", which is not a published post`);
      continue;
    }
    errors.push(
      `"${a}" was public but no published post has it any more — add it to \`renamed\` or \`retired\` in src/data/blog-addresses.ts`,
    );
  }

  if (errors.length) {
    throw new Error(`Blog build refused:\n  - ${errors.join("\n  - ")}`);
  }

  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime() || a.slug.localeCompare(b.slug));
}

export function postUrl(slug: string): string {
  return `/blog/${slug}/`;
}

/** "1 November 2026" — the date format the policy pages already use. */
export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
