# shadynotes.app

Source of the Shady Notes marketing site and blog: Astro 5 + Tailwind 4, static
output, served by GitHub Pages behind Cloudflare.

## Run locally

```bash
npm install
npm run dev      # http://localhost:4321 (blog drafts visible here only)
npm run build    # writes dist/
npm run preview  # serves dist/
```

Sign-in in dev needs a gitignored `.env` with the Clerk development keys
(`PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `PUBLIC_CLERK_SIGN_IN_URL`,
`PUBLIC_CLERK_SIGN_UP_URL`). Production builds use the committed
`.env.production`, which holds only public values. Never commit an `sk_` key.

## Deploy

Push to `main`. The **Deploy site** workflow (`.github/workflows/deploy.yml`)
runs `npm ci`, `astro check` and `npm run build`, then publishes `dist/` to
Pages. Pull requests run the build without deploying.

## Everything else this repo deploys

This repo replaced the private `shadynotes-hostinger` repo on 2026-11-10, when the
Hostinger VPS shut down. Each service is a Cloudflare Worker with its own folder;
`make help` lists the ops targets (deploys and live checks).

| Host | Folder | Deploy |
|---|---|---|
| `api.shadynotes.app` — entitlement backend the macOS app calls | `api/` | `make api-deploy` |
| `docs.shadynotes.app` — Starlight docs | `docs-site/` | `make docs-deploy` |
| `downloads.shadynotes.app` — DMGs, Sparkle appcast, brand film | `downloads/` | the app repo's `make publish` |
| `subscribe.shadynotes.app` — newsletter sign-up | `newsletter/` | `cd newsletter && npx wrangler deploy` |

The ops targets expect the app repo next to this one at `../shadynotes`, and the brand
media and launch plans at `docs/brand/`. That folder is git-ignored: this repo is
public, so it stays on your machine only.

Also here: `homebrew/` (the Homebrew cask). The old repo's feature history, the
community Discord bot (retired with the VPS) and the internal ops guides stay in
the private `shadynotes-hostinger` repo, archived read-only — this repo is public.

## Layout

- `src/pages/` — one file per URL.
- `src/layouts/` — `Base.astro` (the `<html>` shell, meta and link-preview tags), `Site.astro` (nav + footer).
- `src/components/` — Nav, Footer, Button, NewsletterSignup, …
- `src/config/site.ts` — download version, billing, newsletter switch. `src/config/blog.ts` — topics, feed ids.
- `src/content/blog/` — posts (`YYYY-MM-DD-slug/index.md`), the post format (`README.md`) and the writing guide (`STYLE.md`).
- `src/data/blog-addresses.ts` — every public blog address (the build enforces it).
- `src/styles/global.css` — Tailwind entry and design tokens; rules in `DESIGN.md`.
- `public/` — copied as-is (`CNAME`, favicon, OG image, robots.txt).
- `docs/` — the website, blog and newsletter playbook.

This repo is public: committed blog drafts are readable on GitHub even though
they are never built. Keep them local until they are ready.
