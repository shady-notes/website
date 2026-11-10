export interface PricingTier {
  id: "free" | "personal" | "supporter";
  name: string;
  subline: string;
  priceMonthly: string;
  priceYearly: string;
  priceUnit: string;
  yearlySavingNote: string;
  features: string[];
  gatingRationale: string;
  ctaLabel: string;
  ctaHrefMonthly: string;
  ctaHrefYearly: string;
  featured?: boolean;
}

// Freemium: permanent free tier, 14-day full trial on first launch, premium
// unlocked by an active Clerk subscription (sign in on the web, the app checks
// entitlement online then works offline within a grace window). Checkout is gated
// behind siteConfig.billing.billingLive, live since 2026-09-02; with it off the
// cards show the price on a disabled CTA instead. These prices are the ones the
// production Clerk plans charge — change them in both places or the page lies.
export const tiers: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    subline: "A complete basic notepad. Yours forever.",
    priceMonthly: "US$0",
    priceYearly: "US$0",
    priceUnit: "forever",
    yearlySavingNote: "",
    features: [
      "The shade gesture, full markdown editor, tables, checkboxes",
      "Your whole vault — unlimited notes, search, tabs",
      "Plain `.md` files, Obsidian-compatible — no lock-in",
      "3 themes (Dark, Light, Nord)",
      "Starts as a 14-day trial of everything",
      "No account or card to start. The app checks for updates",
    ],
    gatingRationale:
      "The free tier is a genuinely good notepad because your notes should never be hostage. The first 14 days unlock everything so you can feel the full app in your own workflow — then it gently drops to Free.",
    ctaLabel: "Download free",
    ctaHrefMonthly: "/download",
    ctaHrefYearly: "/download",
  },
  {
    id: "personal",
    name: "Personal",
    subline: "The full system. Every note, one scroll away.",
    priceMonthly: "US$4",
    priceYearly: "US$36",
    priceUnit: "per month",
    yearlySavingNote: "Save 25% — three months free",
    features: [
      "Everything in Free, plus:",
      "Every theme, light and dark",
      "Plugins: Daily Notes, Kanban, Tasks — plus build your own",
      "Revision history — snapshots of every note, browse and restore",
    ],
    gatingRationale:
      "Personal pays for sustained, careful development of a native Mac app — no Electron. The basics stay free; what you pay for is the system on top: plugins, history, theming. Cancel anytime — your notes keep working everywhere, they were never trapped.",
    ctaLabel: "Get Personal",
    ctaHrefMonthly: "",
    ctaHrefYearly: "",
    featured: true,
  },
  {
    id: "supporter",
    name: "Supporter",
    subline: "For people who want this app to exist for a decade.",
    priceMonthly: "US$8",
    priceYearly: "US$72",
    priceUnit: "per month",
    yearlySavingNote: "Save 25% — three months free",
    features: ["Everything in Personal."],
    gatingRationale:
      "Pay a little more to support independent development. Thank you.",
    ctaLabel: "Become a supporter",
    ctaHrefMonthly: "",
    ctaHrefYearly: "",
  },
];

export interface FaqEntry {
  question: string;
  answer: string;
}

export const pricingFaq: FaqEntry[] = [
  {
    question: "How does the free trial work?",
    answer:
      "Download the app and use everything for 14 days — no card, no account. When the trial ends, the app drops to the Free tier: your notes, the editor, and the shade keep working exactly as before; premium features (extra themes, plugins, revision history) lock until you subscribe. To unlock, you subscribe on the web and then sign in from the app's Preferences.",
  },
  {
    question: "My notes are plain files — what happens if I cancel?",
    answer:
      "Everything keeps working — the app drops back to the Free tier, and your notes are ordinary .md files in a folder you chose (default ~/Documents/ShadyNotes/). Open them in Obsidian, VS Code, or anything else, forever. We can't hold your notes hostage; that's the point of plain files.",
  },
  {
    question: "Is this a subscription for my notes or for the app?",
    answer:
      "For the app — specifically its premium layer. Shady Notes never stores your notes anywhere but your own disk — there's no sync service, no server, no account holding your data. The subscription funds development of a native Mac app.",
  },
  {
    question: "How does unlocking premium work?",
    answer:
      "Premium is tied to your account. You subscribe on the web, then click Sign In in the app's Preferences — that opens your browser, signs you in, and hands the app a token. When the Mac is online, the app re-checks the licence about every 12 hours. Offline, premium keeps working for a 14-day grace period. Update checks leave the Mac too. Notes stay on your Mac. The free tier and the trial need no account at all.",
  },
  {
    question: "Is it a subscription, or can I pay once?",
    answer:
      "It's a subscription — monthly or yearly. Cancel anytime; premium keeps working until the period ends, then the app drops back to Free with all your notes intact.",
  },
  {
    question: "What's your refund policy?",
    answer:
      "14 days, no questions. If you subscribe and decide it isn't for you, email hello@shadynotes.app from the address on your receipt and we'll refund in full. After that, the standard cancellation flow applies — keep using it until the period ends, then it stops renewing.",
  },
  {
    question: "Which payment provider do you use?",
    answer:
      "Checkout and subscriptions run through Clerk Billing. Round Rect is the seller of record. You manage or cancel your subscription anytime from your account.",
  },
  {
    question: "Is it on the Mac App Store?",
    answer:
      "No — Shady Notes ships as a signed, notarised direct download (Developer ID). Same Gatekeeper protections, no App Store sandbox compromises for a menu-bar app that watches scroll gestures.",
  },
];
