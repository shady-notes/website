# Shady Notes documentation site

Astro 7 + Starlight, static export, light-only. Serves `docs.shadynotes.app`.
Deploys to Cloudflare as the **`shadynotes-docs`** Worker (static assets from
`dist/`, configured in `wrangler.jsonc`). It moved here from the retired
`shadynotes-hostinger` repo on 2026-11-10; the Hostinger VPS copy is gone.

## Why this is not part of the site

Starlight 0.41 requires `astro ^7.0.2`. the site (repo root) pins `astro ^5.1.0` and
`@clerk/astro ^3.4.16`. Folding the docs into the site would mean upgrading the
revenue-path sign-in flow — `/app/connect`, which the macOS app depends on —
through two majors, for a documentation change. It also keeps a broken docs
build from being able to take down `shadynotes.app`.

There is deliberately **no Clerk integration here**. Docs need no auth.

See `changes/007-DOCS-SITE/007.02-INITIAL-PLAN.md` §Decision 1.

## Run locally

```bash
cd docs-site
npm install
npm run dev      # http://localhost:4321
```

> On npm 11+, `sharp` and `esbuild` postinstall scripts are gated. The
> `allowScripts` block in `package.json` covers them; if a fresh install warns
> about pending scripts, run `npm approve-scripts --allow-scripts-pending`.
> node:22 in the Docker build uses npm 10, which has no such gate.

## Build

```bash
make docs-build      # from the repo root -> docs-site/dist
npm run check        # astro check (expects 0 errors)
```

The build emits `dist/`, a Pagefind search index at `dist/pagefind/`, and
`sitemap-index.xml`.

## Deploy

From the repo root (NOT from `docs-site/`):

```bash
make docs-check      # build + links + screenshot budget + version freshness
make docs-deploy     # builds origin/main in a temp worktree, then `wrangler deploy`
make verify-docs     # asserts the live shape + no regression on the site
```

`make docs-deploy` needs a logged-in Wrangler (`wrangler login`). See
`changes/009-CLOUDFLARE-HOSTING/` and `changes/007-DOCS-SITE/` in the private
`shadynotes-hostinger` repo (archived) for the move to Cloudflare and the original build.

## Layout

- `src/content/docs/` — one Markdown/MDX file per page; the route tree.
- `src/content.config.ts` — Starlight's docs collection.
- `astro.config.mjs` — Starlight config, including the sidebar (the IA).
- `src/styles/docs.css` — brand tokens mapped onto Starlight's `--sl-color-*`.
- `src/components/SiteTitle.astro` — header wordmark, links back to the site.
- `src/config/docs.ts` — `DOCUMENTED_VERSION` and shared outbound URLs.
- `src/assets/screenshots/` — committed, optimised screenshots (300 KB/file,
  20 MB total; `make docs-shots-budget` enforces it). Raw captures go to
  `.captures/`, which is gitignored.
- `fixtures/demo-vault/` — the vault seeded into the screenshot sandbox.
- `public/_headers` — cache rules per path.

## Brand tokens are duplicated on purpose

The brand hex values in `src/styles/docs.css` are copied from
`site/src/styles/global.css`. Two independent workspaces on different Astro
majors with independent deploys should not share a package for a handful of constants.
If the brand changes, change it in both.
