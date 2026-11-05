# Newsletter: sign-up Worker and sender

The double opt-in sign-up for the Shady Notes blog, and the tool that sends a
published post as an email. Background and the go-live checklist:
[`docs/WEBSITE-BLOG-NEWSLETTER-PLAYBOOK.md`](../docs/WEBSITE-BLOG-NEWSLETTER-PLAYBOOK.md) §6.

**Status:** written and tested locally; **not deployed**. Nothing here runs or
mails anyone until the setup below is done.

```
blog form ──POST /v1/signup──▶ Worker "subscribe" (subscribe.shadynotes.app) ──▶ Resend ──▶ inbox
                                   │  D1 "signups"
tools/post.mjs ──/v1/admin/*──────┘  (ADMIN_KEY)          Resend ──webhook──▶ /v1/resend/webhook
```

| Path | What |
|---|---|
| `src/worker.js` | routes; `src/signup.js` sign-up, confirm, unsubscribe, webhook, retention; `src/newsletter.js` admin and sending |
| `src/config.js` | domains, sender, topics, limits (everything a domain move touches) |
| `migrations/` | D1 schema |
| `tools/post.mjs` | `preview`, `test`, `send`, `status` a post; `tools/render.js` turns a post into the email |
| `test/` | `npm test`: the Worker against SQLite and a fake Resend, the renderer, and site/Worker sync checks |
| `scripts/local-e2e.sh` | the whole flow in the real Workers runtime on this Mac, with a fake Resend |

## Behaviour

- `POST /v1/signup` takes exactly `{email, interests, source}`; CORS only for `https://shadynotes.app`.
  It answers 503 until `POLICY_VERSION` is set.
- **Double opt-in.** Only the confirmation mail is sent before a confirm. Links in mail open a
  page with a button (`GET` never changes anything, because mail scanners prefetch links); the
  button `POST`s. Same for unsubscribe (`/u/`) and subscribe again (`/r/`).
- **One-click unsubscribe** (RFC 8058): every newsletter has `List-Unsubscribe` and
  `List-Unsubscribe-Post`. Unsubscribe links are derived from `TOKEN_SECRET` and never expire.
- **Repeats:** a confirmed address gets `already-confirmed` and no mail; an unconfirmed one gets
  a new mail at most every 10 minutes. Bounced or complained addresses are never mailed again.
- **Limits:** 5 sign-ups a minute per `SHA-256(LIMITER_SALT + UTC day + IP)` (the IP is never
  stored), and `DAILY_CONFIRM_CAP` confirmation mails a day in total.
- **Retention** (daily cron): unconfirmed sign-ups 30 days after their last confirmation mail,
  unsubscribed addresses 30 days after unsubscribing, with their delivery records.
- **Consent record:** each confirm stores `POLICY_VERSION` and `CONSENT_WORDING`.
- **No tracking:** no request logs (`observability` off), no open or click tracking.

This is what the Newsletter section of `/privacy` promises. Change both together.

## Local

```
npm install --ignore-scripts
npm test
scripts/local-e2e.sh
node tools/post.mjs preview <slug>
```

`local-e2e.sh` needs `wrangler` on the PATH (Homebrew's works). It uses a throwaway D1 and the
fake Resend, and never touches the live list.

## Setup (once)

Steps marked **you** need your accounts; run them yourself (`! command` in Claude Code works).

1. **you:** `npx wrangler login` (Cloudflare account that holds `shadynotes.app`).
2. `npx wrangler d1 create signups`, put the printed id in `wrangler.toml` as `database_id`,
   then `npx wrangler d1 migrations apply signups --remote`.
3. **you, Resend:** add the domain `send.shadynotes.app` (records **DNS-only** in Cloudflare;
   never touch the Clerk records at the apex), wait for Verified, turn **open and click tracking
   off** for it, and create a **sending-only** API key for that domain.
4. Secrets, each by stdin:
   ```
   printf %s "$KEY" | npx wrangler secret put RESEND_API_KEY
   openssl rand -hex 32 | tr -d '\n' | npx wrangler secret put LIMITER_SALT
   openssl rand -hex 32 | tr -d '\n' | npx wrangler secret put TOKEN_SECRET
   ```
   `ADMIN_KEY`: generate it into the keychain first, then send it to the Worker from there:
   ```
   security add-generic-password -s shadynotes-newsletter -a admin -w "$(openssl rand -hex 32)"
   security find-generic-password -s shadynotes-newsletter -a admin -w | tr -d '\n' | npx wrangler secret put ADMIN_KEY
   ```
   `LIMITER_SALT` and `TOKEN_SECRET` are set once: a new `TOKEN_SECRET` breaks every
   unsubscribe link already sent.
5. Set `TEST_RECIPIENTS` in `wrangler.toml` to the inbox(es) for test sends.
6. `npx wrangler deploy` (creates `subscribe.shadynotes.app`). Check the preflight:
   ```
   curl -si -X OPTIONS -H "Origin: https://shadynotes.app" -H "Access-Control-Request-Method: POST" https://subscribe.shadynotes.app/v1/signup | head -1
   ```
   must say 204. Sign-ups still answer 503: `POLICY_VERSION` is empty.
7. **you, Resend:** webhook to `https://subscribe.shadynotes.app/v1/resend/webhook`, events
   `email.bounced` and `email.complained`; put its signing secret in with
   `npx wrangler secret put RESEND_WEBHOOK_SECRET`. Send a test to `bounced@resend.dev` while
   `npx wrangler tail subscribe` runs; expect the webhook `POST` to answer 200.

## Go live (one change)

In the same commit and deploy:

1. `wrangler.toml`: `POLICY_VERSION = "<today>"`, then `npx wrangler deploy`.
2. `src/config/site.ts`: `newsletter.endpoint = "https://subscribe.shadynotes.app/v1/signup"` and
   `newsletter.policyVersion = "<today>"` (the same date). Push to `main`.

Then, from the live form: sign up, confirm, check `Unsubscribe` from a test send, sign up twice
fast (no second mail), and six times in a minute (429).

## Send a post

```
node tools/post.mjs preview <slug>     # writes HTML and text, sends nothing
node tools/post.mjs test <slug>        # one copy to TEST_RECIPIENTS; check Gmail and Apple Mail, light and dark
node tools/post.mjs send <slug>        # shows the audience, asks, sends in batches of 100
node tools/post.mjs status <slug>      # counts only
```

`send` refuses unless the post is published with `email: true`, its page and images answer 200,
and this exact rendering was test-sent (change a word: test again). It is safe to re-run after an
error or Resend's daily limit (100 a day on the Free plan): recipients are claimed before each
batch and the batch keeps its idempotency key, so nobody gets a post twice. Re-run a failed batch
within 24 hours, Resend's idempotency window.

Privacy requests: `POST /v1/admin/lookup` and `/v1/admin/delete` with `{"email": "..."}` and the
admin key.
