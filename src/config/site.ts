// The macOS build the download button serves. BUMP THIS ON EVERY RELEASE.
//
// The URL is versioned on purpose. The unversioned alias it replaced
// (ShadyNotes.dmg) was served with `Cache-Control: immutable, max-age=31536000`,
// so browsers that fetched it while it held an old build cached that build for a
// year and never revalidated — fixing the file on the server could not reach
// them. A versioned filename is genuinely immutable, so that caching is correct,
// and each release gets a URL no browser has seen before.
//
// The cost is that this constant can go stale. `make verify-download` checks it
// against the live Sparkle appcast and fails if they disagree — run it after a
// release (or wire it into CI) rather than trusting memory.
const DMG_VERSION = "4.1.19";

export const siteConfig = {
  name: "Shady Notes",
  shortName: "ShadyNotes",
  company: "Round Rect",
  legalEntity: "ROUNDRECT PTY LTD",
  domain: "shadynotes.app",
  contactEmail: "hello@shadynotes.app",
  // Display version stays coarse on purpose — the app ships faster than the
  // site; don't hard-assert a patch number that drifts.
  version: "4.x",
  buildYearRange: "2026–2026",

  socials: {
    discord: "https://discord.gg/2TT9Mm9Uzf",
  },

  newsletter: {
    // The double opt-in sign-up Worker (playbook §3.6). EMPTY = OFF: the form
    // is not rendered anywhere and the privacy page omits its newsletter
    // section. To turn it on, all three of these change in the same deploy:
    //   1. `endpoint`  -> e.g. "https://subscribe.shadynotes.app/v1/signup",
    //      after the Worker is deployed and its CORS allows https://shadynotes.app
    //      (test the OPTIONS preflight from this origin — playbook §5).
    //   2. `policyVersion` -> the date you go live (YYYY-MM-DD). The privacy
    //      page shows it as "Last updated" and the Worker must store the same
    //      value as POLICY_VERSION with every confirmed sign-up.
    //   3. The Worker's CONSENT_WORDING -> exactly `consentWording` below.
    endpoint: "https://subscribe.shadynotes.app/v1/signup",
    policyVersion: "2026-11-08",
    consentWording:
      "Email me new Shady Notes posts on the topics I picked. I'll confirm by the link you send, and I can unsubscribe from any email.",
  },

  download: {
    // macOS — versioned download URL, derived from DMG_VERSION above.
    //
    // ONE URL COVERS BOTH CHIPS. The DMG is a universal binary (arm64 +
    // x86_64), so there is deliberately no Intel-specific link to add here.
    // That is a property of how the app is built, not of this file: the app
    // repo's `make build` passes `--arch arm64 --arch x86_64`. Drop those flags
    // and the release Mac (Apple Silicon) silently ships an arm64-only DMG
    // again, which is what shut Intel users out before. `make verify-download`
    // catches that regression by asserting the appcast carries no
    // sparkle:hardwareRequirements.
    // Verify with `make verify-download` after every release.
    dmgVersion: DMG_VERSION,
    dmgUrl: `https://downloads.shadynotes.app/macos/ShadyNotes-${DMG_VERSION}.dmg`,
    // The public site offers the Mac app only. Do not add another platform
    // here until a build is actually published.
    homebrewCommand: "",
  },

  // The brand film on the homepage (feature 008). Renditions live on the
  // downloads host, outside git, under content-hashed names served immutable.
  // A re-render means: `make film-encode` → `make film-publish` → paste the two
  // new names here → deploy. `make verify-film` checks what these point at.
  film: {
    base: "https://downloads.shadynotes.app/media",
    src1080: "brand-film-2min.98b7714b.1080p.mp4",
    src720: "brand-film-2min.2bb098b7.720p.mp4",
    duration: "2:00",
  },

  billing: {
    // Clerk Billing (Stripe under the hood; Round Rect is the seller of record and
    // handles tax). Subscription-only — no one-time "Lifetime" plan. When
    // `billingLive` is false the pricing page shows the price on a disabled CTA
    // and opens no Clerk checkout.
    //
    // ON as of 2026-09-02. The three things it waits on are all in place:
    // Billing is enabled on the production instance, `planIds` below holds that
    // instance's cplan_ IDs (set 2026-08-31), and Stripe is now connected in the
    // Clerk dashboard — that last step is a Stripe Connect OAuth flow with no
    // API, so it cannot be asserted from here. Turning this on without it would
    // render a normal-looking checkout that fails at the payment step; if
    // Stripe is ever disconnected, flip this back to false rather than leaving
    // a button that takes a card and drops it. See
    // changes/006-LICENSING-CLERK/006.04-CLERK-PRODUCTION-MIGRATION.md.
    billingLive: true,
    // Clerk plan slugs (from the dashboard) that grant premium. Must match the
    // backend's PREMIUM_PLANS and the app's plan→tier map.
    plans: {
      personal: "personal",
      supporter: "supporter",
    },
    // Clerk plan IDs (cplan_…) — the custom pricing cards' Subscribe buttons need
    // the ID (not the slug) to open Clerk checkout. From `clerk api /billing/plans`.
    //
    // PRODUCTION instance IDs, set 2026-08-31 when Billing was enabled on
    // ins_3HjN0LuI8dcEgAQIsJTlLZMuaFw. Plan IDs are instance-scoped; these do not
    // exist in the dev instance. Re-read them with
    // `clerk api /billing/plans --instance prod`.
    planIds: {
      personal: "cplan_3HjN0J1EvInNpscxREIQMuatCOK",
      supporter: "cplan_3HjN0OXno3mrYFao4EwudId4R4S",
    },
    // Entitlement backend base URL — /app/connect POSTs here to mint the desktop
    // app token; the macOS app calls /entitlement here.
    backendUrl: "https://api.shadynotes.app",
    // Subscription management is Clerk-hosted (via <UserButton/> / UserProfile).
    customerPortalUrl: "",
  },
} as const;
