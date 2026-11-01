# Playbook: shadynotes.app website, blog and newsletter

How the Shady Notes web presence is built and published, and what is left to do for the blog and the
newsletter. Adapted on 2026-11-01 from the Dozable playbook (a static site, a Markdown blog with drafts,
edge analytics and a double opt-in newsletter on Cloudflare) to the Shady Notes setup, which differs in one
big way: **the site is an Astro project, built and deployed by GitHub Actions from this repo.**

Since 2026-11-01 this repo (`shady-notes/website`) holds the site's source. Before that it held only
built output pushed by `make deploy` from the private `shadynotes-hostinger` repo, whose `site/` folder
is now retired for the landing page. Post format: `src/content/blog/README.md`; writing guide:
`src/content/blog/STYLE.md`. Cloudflare background: `docs/CLOUDFLARE-DNS-PROXY-SETUP.md` and
`docs/CLOUDFLARE-ANALYTICS.md` in `shadynotes-hostinger`.

## 1. The shape

```
                          shadynotes.app  (DNS on Cloudflare, Free plan)
                                 |
      +--------------------------+-----------------------------+-------------------------+
      |                          |                             |                         |
 @, www (proxied CNAME)    subscribe (planned: Worker    send (planned: Resend      docs (Cloudflare Worker,
 -> shady-notes.github.io   custom domain)                DNS, DNS-only)             separate deploy)
      |                          |
 GitHub Pages              Worker "subscribe" + D1  ----> Resend API -> inbox
 (deployment from Actions)  (not built yet)
      ^
      |  GitHub Actions "Deploy site" (.github/workflows/deploy.yml), on every push to main
      |
 shady-notes/website (PUBLIC, this repo): Astro 5 + Tailwind 4 source
   src/content/blog/          posts: YYYY-MM-DD-slug/index.md (drafts never built)
```

Nothing runs on a server for the site itself: GitHub Pages serves static files behind the proxied
Cloudflare zone. The only planned runtime code is the sign-up Worker.

## 2. This repo

- **What it is:** the public source of `shadynotes.app`: an Astro 5 + Tailwind 4 static site.
  `public/CNAME` names the domain. Pages is set to build from **GitHub Actions**, not from a branch.
- **Deploy:** push to `main`. `.github/workflows/deploy.yml` runs `npm ci`, `astro check` and
  `npm run build`, then publishes `dist/`. Pull requests run the same build without deploying, so a
  bad post or type error fails before merge. Watch it with `gh run watch` or the Actions tab.
- **Local:** `npm install`, `npm run dev` (http://localhost:4321), `npm run build`. Dev sign-in needs a
  gitignored `.env` with the Clerk *development* keys; production uses the committed
  `.env.production` (publishable key only).
- **It is public.** Never commit secrets (the Clerk `sk_…` key stays in the gitignored `.env`).
  Committed blog drafts are readable on GitHub even though they are never built.
- **`make deploy` in `shadynotes-hostinger` must not be used for the site any more:** it would replace
  this repo's source with built output. The Actions build would then fail and the live site would stay
  on its last deployment, but the repo would need a revert.

## 3. Status against the Dozable playbook

| Playbook step | Shady Notes | Status |
|---|---|---|
| 1a Writing guide (`STYLE.md`) | `src/content/blog/STYLE.md` | done |
| 1a Design guide | `DESIGN.md` + tokens in `src/styles/global.css` | done (already existed) |
| 3.1 DNS on Cloudflare, proxied `@`/`www` | since 2026-10-12 | done |
| 3.2 Site repo + Pages | this repo, deployed by GitHub Actions | done |
| 3.2 `stamp.sh` cache-busting | not needed: Astro fingerprints `/_astro/*` assets | n/a |
| 3.3 Blog build | Astro content collection instead of `blog-build.py` | done (no posts published yet) |
| 3.4 Private preview (Pages + Access) | drafts preview in `npm run dev` only | not built |
| 3.5 Analytics | Cloudflare edge counts, no script on pages | done |
| 3.6 Subscribe Worker + D1 | form ready, Worker not written | to do |
| 3.7 Resend | — | to do |
| 3.8 Send a post as a newsletter | — | to do (needs 3.6, 3.7) |
| 3.9 Privacy policy | `/privacy` — analytics wording updated; newsletter section ready, shown only when the form is on | partly done |

## 4. The blog (done)

Source: this repo.

| Piece | Where |
|---|---|
| Posts | `src/content/blog/YYYY-MM-DD-slug/index.md`, images beside them |
| Schema (strict front matter) | `src/content.config.ts` |
| Rules: folder/date match, slug format, address ledger | `src/lib/blog.ts` |
| Address ledger | `src/data/blog-addresses.ts` |
| Topics, feed id base | `src/config/blog.ts` |
| Pages | `src/pages/blog/index.astro`, `src/pages/blog/[slug].astro` |
| Atom feed | `src/pages/blog/feed.xml.ts` → `/blog/feed.xml` |
| Styles | "Blog" block at the end of `src/styles/global.css` |

Front matter (all required; an unknown key fails the build):

```yaml
---
title: Short plain title          # also the email subject; 60 chars max
date: 2026-11-01                  # must equal the folder's date
topics: [release-news]            # release-news | how-to | behind-the-scenes
summary: One sentence.            # list, link preview, feed, email preheader
email: true                       # false = blog only
status: draft                     # draft | published
---
```

Behaviour:

- **Address** is `/blog/<slug>/` (folder name minus the date). Once published it never changes.
- **Drafts** are shown only by `npm run dev`, with a Draft banner. `npm run build` skips them, so they
  never reach this public repo.
- **Address ledger:** the build refuses to publish a slug not listed in `addresses`, to drop a listed
  address, or to re-use a `retired` one. A rename maps `old → new` under `renamed`, which builds a
  redirect page; add a Cloudflare redirect rule too for a real 301 (Pages cannot send one).
- **Feed ids** are `tag:shadynotes.app,2026:blog/<slug>` and must never change.
- **Empty blog:** until a post is published, `/blog/` is `noindex`, left out of the sitemap, and not
  linked from the nav or footer.
- **Images** are referenced relatively (`./shot.png`); Astro optimises and fingerprints them.
- **Code blocks** are monochrome (`markdown.syntaxHighlight: false`), per `DESIGN.md`.

Publish a post:

1. Write `src/content/blog/YYYY-MM-DD-slug/index.md` with `status: draft`; read it in `npm run dev`.
2. Check it against `STYLE.md`'s "Before publishing" list.
3. Set `status: published`, add the slug to `addresses` in `src/data/blog-addresses.ts`,
   run `npm run build` (must pass), commit, and push to `main` (or merge a PR).
4. When the "Deploy site" action finishes, load `https://shadynotes.app/blog/<slug>/` and each image.

## 5. Analytics (done)

No analytics script and no analytics cookies on the pages. Requests are counted at Cloudflare's edge
because `@`/`www` are proxied; read them in the dashboard or with the GraphQL script described in
`docs/CLOUDFLARE-ANALYTICS.md`. As of 2026-11-01 the live HTML loads no Cloudflare Web Analytics
beacon (only Cloudflare's email-decode script, from Email Address Obfuscation). If a beacon is ever
turned on, update section 5 of `/privacy` in the same change.

## 6. Newsletter (to do)

### 6.1 The form (done, off)

`src/components/NewsletterSignup.astro` renders on `/blog/` and under each post, **only when
`siteConfig.newsletter.endpoint` is set** (`src/config/site.ts`). It POSTs JSON
`{email, interests, source}` — exactly those three keys — and handles 2xx (`status:
"already-confirmed"` means already subscribed), 400, 429 and network errors.

Turning it on is one deploy that changes three things together:

1. `newsletter.endpoint` → `https://subscribe.shadynotes.app/v1/signup`, after the Worker is live.
2. `newsletter.policyVersion` → the go-live date (`YYYY-MM-DD`). `/privacy` shows it as "Last
   updated" and gains its Newsletter section; the build fails if the endpoint is set without it.
3. The Worker's `CONSENT_WORDING` → exactly `newsletter.consentWording`, and its `POLICY_VERSION` →
   the same date as `policyVersion`.

### 6.2 The subscribe Worker

Follow Dozable playbook §3.6, with these names:

- Worker `subscribe`, custom domain `subscribe.shadynotes.app` (created by `wrangler deploy`).
- D1 database `signups`; tables `signups`, `issues`, `deliveries`, `send_batches`.
- CORS allows only `https://shadynotes.app` (and `http://localhost:4321` for dev if wanted). Keep the
  origin list, mail link base and sender names as constants at the top of the code. After deploying,
  the preflight must answer 204:
  `curl -X OPTIONS -H "Origin: https://shadynotes.app" -H "Access-Control-Request-Method: POST" https://subscribe.shadynotes.app/v1/signup`
- Keep the playbook's behaviour: double opt-in (`GET /c/<token>` shows a button, `POST` confirms),
  one-click unsubscribe (RFC 8058), rate limit keyed on `SHA-256(salt + UTC day + IP)`, 30-day
  retention for unconfirmed and unsubscribed, no request logs, no open/click tracking. The privacy
  text in 6.1 describes exactly this; change both together.
- Secrets via stdin only: `RESEND_API_KEY` (sending-only), `STATS_KEY`, `RESEND_WEBHOOK_SECRET`,
  `LIMITER_SALT`.

### 6.3 Resend

- Sending domain `send.shadynotes.app`, records **DNS-only**. Use the subdomain: the apex zone already
  carries Clerk's mail records (`clkmail`, `clk._domainkey`, `clk2._domainkey`), which must stay
  untouched and DNS-only.
- Turn open and click tracking off for the domain.
- Webhook → `https://subscribe.shadynotes.app/v1/resend/webhook`, events `email.bounced` and
  `email.complained`.
- Sender `hello@shadynotes.app` needs a decision: either verify the root domain in Resend (check it
  does not conflict with the existing mail setup) or send from `hello@send.shadynotes.app` with
  `Reply-To: hello@shadynotes.app`.

### 6.4 Sending a post

Not built. Port the playbook's `post.py preview|test|send|status` (3.8): it reads a published post,
refuses to send unless the page and images answer 200 and the exact rendering was test-sent, mails
only confirmed, unsuppressed subscribers whose interests overlap the post's `topics`, and only posts
with `email: true`. Post links in emails must be absolute (`STYLE.md` requires this already).

## 7. Private preview (not built, optional)

Drafts are currently previewed locally with `npm run dev`. If someone else needs to read a draft
before publishing, add the playbook's §3.4 setup: a Cloudflare Pages project `preview` with
`preview.shadynotes.app`, protected by a Cloudflare Access app covering the custom host **and** both
`pages.dev` names, uploaded by a script that builds with drafts included into a directory outside
both repos. Note that the old `preview.shadynotes.app` (the VPS alias) was deleted on 2026-10-19.

## 8. Gotchas that apply here

- **Never run `make deploy` from `shadynotes-hostinger`** for the site: it overwrites this repo (section 2).
- **Deploy builds `origin/main`**, not your working tree: merge first, then deploy.
- **Clerk records stay DNS-only** (`clerk`, `accounts`, `clkmail`, `clk._domainkey`,
  `clk2._domainkey`); proxying them breaks sign-in and mail.
- **A Cloudflare ruleset PUT replaces every rule in that phase** — GET, merge, then PUT. The zone
  already has Redirect Rules (`www` → apex, `/coming-soon` → `/`) and a WAF skip for `api`.
- **Browser cache TTL** is "respect origin"; Astro's fingerprinted `/_astro/*` files make that safe.
- **Bump `policyVersion`** whenever `/privacy`'s newsletter terms change, and the Worker's
  `POLICY_VERSION` with it.
- **Cloudflare bot protection may 403 scripts** using a default user agent; send a named one.

## 9. Checklist

- [x] Writing guide (`STYLE.md`) and design guide (`DESIGN.md`, tokens, OG tags with a 1200x630 image)
- [x] Domain on Cloudflare; `@`/`www` proxied to GitHub Pages; HTTPS
- [x] Blog builds; drafts excluded; address ledger; Atom feed; sitemap
- [x] Analytics position stated truthfully in `/privacy`
- [ ] First post published (Action green, page and images 200, feed lists it)
- [ ] `shady-notes` org domain verified in GitHub (needs an org owner)
- [ ] D1 created, migrations applied, secrets set, `subscribe` Worker deployed, preflight 204
- [ ] Resend `send.shadynotes.app` verified (DNS-only), tracking off, webhook set, bounce test 200
- [ ] Newsletter switched on (endpoint + `policyVersion` + Worker consent wording in one deploy)
- [ ] Confirm, unsubscribe, resubscribe and rate limit (429) tested from the live form
- [ ] Sender script ported; first `test` and `send`
- [ ] Decide: private preview (section 7), Workers Paid, Resend plan, Access on admin routes
- [ ] Legal review of the newsletter privacy text and sender identity
