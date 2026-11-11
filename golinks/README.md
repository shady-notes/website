# go.shadynotes.app — campaign short links

`go.shadynotes.app/<source>[/<content>]` answers with a 302 to shadynotes.app carrying the launch
UTMs, and adds 1 to a per-day click count. Link previews still show the real page, because preview
fetchers follow the redirect. Those fetchers are not counted.

**What is stored:** one row per UTC day, source and content, holding a number. No IP address,
user agent, referrer or cookie is stored, and request logs are off. That is why this is the only
per-channel number available without the cookie banner. Downloads and purchases per channel come
from the Google tag, and only for visitors who click "Allow".

## Links for the planned posts

| Post | Link |
|---|---|
| Reddit r/macapps launch (Dec 1) | `go.shadynotes.app/reddit/macapps` |
| Reddit, other subs / helpful comments | `go.shadynotes.app/reddit/<sub-or-thread>` |
| Show HN (Dec 8) | `go.shadynotes.app/hn` |
| Product Hunt (Dec 15) | `go.shadynotes.app/ph` |
| Newsletter issues | `go.shadynotes.app/news/dec-1`, `go.shadynotes.app/news/dec-15` |
| Profile bios | `go.shadynotes.app/x/bio`, `/yt/bio`, `/bsky/bio`, `/mastodon/bio`, `/threads/bio`, `/ig/bio`, `/tiktok/bio` |
| X clip posts | `go.shadynotes.app/x/<clip>`, e.g. `/x/gesture`, `/x/tables`, `/x/kanban` (clip names from `docs/brand/promo-videos/social/`) |
| YouTube Shorts | `go.shadynotes.app/yt/short-gesture`, `/yt/short-lockin` |
| Discord pinned message | `go.shadynotes.app/discord/pin` |
| AlternativeTo listing | `go.shadynotes.app/alt` |
| awesome-mac style lists | `go.shadynotes.app/gh/<list-name>` |

Sources: `reddit hn ph discord x yt tiktok ig threads bsky mastodon alt gh news` (see `src/links.js`).
The content slug is free-form: lowercase letters, digits and dashes, up to 40 characters, so a new
post never needs a deploy. `.../pricing` and `.../download` land on those pages instead of the home page.
An unknown source or a mistyped path still goes to the homepage, but isn't counted.

Google Ads does not use these links: it tags its own clicks.

## Read the numbers

```bash
cd golinks
npm run stats    # total clicks per link, with first and last day
npm run daily    # clicks per day per source, newest first
```

Copy the day's numbers into the metrics sheet's `Clicks (go links)` column.

## Deploy

```bash
npm test && npx wrangler deploy
```

Account, custom domain and the D1 database (`golinks`, region OC, created 2026-11-11) are pinned
in `wrangler.toml`. Schema changes go in `migrations/` and are applied with
`npx wrangler d1 migrations apply golinks --remote`.
