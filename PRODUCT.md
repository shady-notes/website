# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Scope: this repo's web presence only. That is the marketing site (`site/`, shadynotes.app), the docs (`docs-site/`, docs.shadynotes.app), and brand media (`brand/promo-videos/`, `brand/slides/`). The native macOS app lives in its own repo (`/shadynotes/`). Here it is the product being sold and documented. Its UI is not designed from this repo.

## Users

Mac users who live in markdown and want their notes one gesture away without dedicating a window to them:

- Developers and technical writers who also open the same files in VS Code or grep them.
- Obsidian users who want a quick-capture surface on their existing vault.

They distrust lock-in and subscriptions that hold data hostage. They arrive either cold (Google Ads, organic search, social) or warm (from the app, docs links, the community Discord). They are deciding whether the app is worth installing, then whether it is worth paying for.

## Product Purpose

Shady Notes is a macOS markdown notepad that slides down from the menu bar like a window shade. Scroll near the top of the screen, or press Ctrl+Opt+Cmd+↓, and the notes appear. Scroll up and they're gone. The web surfaces exist to:

1. Turn cold traffic into downloads that start the 14-day full trial.
2. Convert trial users into paid subscribers through pricing, docs, sign-in/sign-up (Clerk) and the license flows.

Success follows that order: downloads first, then paid conversion.

## Positioning

- **Mechanism:** notes live just above the screen, one scroll away. No dock icon or window to manage.
- **Ownership:** every note is a plain `.md` file in a vault on the user's own disk (default `~/Documents/ShadyNotes/`), compatible with Obsidian. "No lock-in. Just markdown." "Pay for the app. Never for your notes."

## Operating Context

- Distribution happens outside the Mac App Store: a notarised DMG from the site, plus Homebrew. The app requires macOS 13+ and is native Swift.
- Pricing has three tiers: Free, Personal at $4/mo and Supporter at $8/mo, with a 14-day full trial. Billing runs through Clerk Billing, which replaced the earlier Lemon Squeezy and Paddle setups.
- Site routes include home, pricing, download, changelog, sign-in, sign-up, app connect, license pending, thanks, legal pages and 404.
- Acquisition follows the organic, social and Google Ads plans in `brand/`, with Vietnamese versions in `brand/vi/`.
- Support comes from docs.shadynotes.app and the Shadybot community Discord bot. Its knowledge is curated from the docs only.
- Maker: Round Rect (ROUNDRECT PTY LTD).

## Capabilities and Constraints

- **Shipped app features that may be described:** live WYSIWYG markdown; checkboxes; real tables; slash commands; callouts; wikilinks; tabs; vault search; plugins (Daily Notes, Kanban, Tasks); external-edit reload; pin, window and minimize modes; the amber pull tab; a rebindable global hotkey. A `shadynotes` CLI also exists.
- **Truth discipline:** surfaces only claim verified, shipped facts, traced through the claim ledger in `changes/001-SHADYNOTES-LANDING-PAGES/001.03-COPY-DRAFT.md`. Say "v4.x" and never an exact patch version.
- **Never claim:** sync, iOS or mobile, Windows, accounts as a feature, a formal "no telemetry" promise, or "zero dependencies" (the app ships Sparkle; say "pure Swift" or "native" instead).
- **Stack:** the site and docs are Astro 5 + Tailwind 4 (`site/` also uses `@clerk/astro`), deployed as Docker/nginx. Videos are HyperFrames compositions at 1920×1080, 30 fps, and must render deterministically (see `CLAUDE.md`).

## Brand Commitments

`brand/brand-brief.md` remains binding for native product identity, brand films and slide decks; the source files it cites win over it. The user-selected Dozer reference supersedes its older web visual commitments for `site/` and `docs-site/`. The implemented web system is recorded in `DESIGN.md`.

- **Name and wordmark:** "Shady Notes", two capitalised words, set beside the actual umbrella artwork. Never redraw the mark or place text over it.
- **Slogan:** "Your notes, one scroll away." Short form: "The menu-bar markdown notepad for your Mac."
- **Voice:** calm, dry, a little warm. Short sentences. No exclamation marks or hype words. The shade metaphor carries the flavour.
- **Web visual commitments:** white ground, black text and structure, yellow emphasis and pale yellow tints; system sans reading and controls; mono code and data; black frames, pill controls and rounded panels. Marketing and docs share this system.
- **Native app and existing brand media:** retain the dark cyber/Matrix palette, amber primary action and mono/sans pairing where their own source defines them. Their colours remain authentic product evidence when embedded in web pages.
- **Video rules in `CLAUDE.md`:** titles ≥ 64px, body ≥ 36px, contrast ≥ 4.5:1.

## Evidence on Hand

- Product screenshots and docs captures: `docs-site/src/assets/screenshots/` and site assets in `site/src/assets/`.
- Logo artwork: `shadynotes-app-logo.png`, `site/src/assets/logo-mark.png`, `site/src/assets/hero-beach-neon.webp`.
- Brand films, including vertical cuts: `brand/promo-videos/`.
- Launch-plan decks: `brand/slides/`.
- **Absent and must not be fabricated:** testimonials, user or download counts, customer logos, ratings, press coverage and listings.

## Product Principles

1. **Earn the click without inflating the claim.** Every statement traces to shipped, documented behaviour.
2. **Show the gesture.** The scroll-down shade is the differentiator. Demonstrate it rather than describe it.
3. **Respect the user's ownership.** Lead with plain files and no lock-in. Pricing pays for the app, never for access to notes.
4. **Absence of friction is the tone.** Surfaces should feel as quick and quiet as the app: few steps to download, a clear single action.
5. **Download first, then convert.** Cold surfaces optimise for trying the app. Warm surfaces (pricing, docs, license) optimise for subscribing.
