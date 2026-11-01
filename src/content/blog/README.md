# Blog posts

Each post is a folder here: `YYYY-MM-DD-slug/index.md`, with its images beside it.
Write against [`STYLE.md`](STYLE.md).

**This repo is public.** A draft is never built into the site, but once it is
pushed anyone can read it on GitHub. Keep unfinished posts on a local branch (or
uncommitted) until they are ready to publish.

## Front matter

All keys are required; an unknown key, a bad topic or a date that does not match
the folder fails the build.

```yaml
---
title: Short plain title          # also the email subject; 60 chars max
date: 2026-11-01                  # must equal the folder's date
topics: [release-news]            # one or more of: release-news, how-to, behind-the-scenes
summary: One sentence.            # blog list, link preview, feed, email preheader; 200 chars max
email: true                       # false = blog only, never mailed
status: draft                     # draft | published
---
```

Topics are defined in `src/config/blog.ts`. Never rename a topic id (subscribers
store them); add new ones.

## Address

`/blog/<slug>/` — the folder name minus the date. Lowercase letters, digits and
hyphens. **Once published, an address never changes.** Every public address is
listed in `src/data/blog-addresses.ts`; the build refuses to publish a slug that
is not listed there, to lose one that is, or to re-use a retired one. To rename,
move the folder, add the new slug, and map `old → new` under `renamed` (that
builds a redirect page; also add a Cloudflare redirect rule for a real 301).

## Images

Put them in the post folder and reference them relatively:
`![What the screenshot shows](./navigator-tabs.png)`. Astro resizes and
fingerprints them. Keep each source under about 300 KB, and always write alt text.

## Flow

1. **Draft.** Create the folder with `status: draft`. `cd site && npm run dev`
   and open <http://localhost:4321/blog/> — drafts show there with a Draft
   banner, and only there. `npm run build` skips them.
2. **Check** the post against `STYLE.md`'s "Before publishing" list.
3. **Publish.** Set `status: published`, add the slug to `addresses` in
   `src/data/blog-addresses.ts`, `npm run build` (it must pass), commit and
   push to `main` (or merge a PR). The "Deploy site" GitHub Action builds and
   publishes it in about a minute; then load
   `https://shadynotes.app/blog/<slug>/` and each image.
4. **Newsletter.** Not wired yet: the sign-up Worker and the sender
   (`post.py test|send` in the playbook) are still to be built. The sign-up
   form stays hidden until `siteConfig.newsletter.endpoint` is set.

The feed is `/blog/feed.xml` (Atom). Entry ids are pinned by `FEED_ID_BASE` in
`src/config/blog.ts` — never change it.
