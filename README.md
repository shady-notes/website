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

Do not use `make deploy` from `shadynotes-hostinger` for this site any more: it
overwrites this repo with built output.

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
