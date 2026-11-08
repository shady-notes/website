// Names and limits. Everything a domain move touches lives here (playbook §5,
// "hard-coded names"): after a move, update these, redeploy, and re-test the
// CORS preflight from the new site origin.

export const SITE = "https://shadynotes.app";
/** Origins allowed to POST /v1/signup. Add more per environment with EXTRA_ORIGINS. */
export const SITE_ORIGINS = ["https://shadynotes.app"];

// Sender. Decision pending (playbook §6.3): this is the subdomain option, which
// keeps Resend off the apex zone that carries Clerk's mail records.
export const FROM = "Shady Notes <hello@send.shadynotes.app>";
export const REPLY_TO = "hello@shadynotes.app";
export const CONTACT = "hello@shadynotes.app";
export const SENDER_IDENTITY = "Round Rect (ROUNDRECT PTY LTD)";

/** Must match the keys of TOPICS in src/config/blog.ts (test/sync.test.js). Never rename, only add. */
export const TOPICS = {
  "release-news": "Release news",
  "how-to": "How-to",
  "behind-the-scenes": "Behind the scenes",
};
export const TOPIC_IDS = Object.keys(TOPICS);

export const CONFIRM_RESEND_MINUTES = 10;
export const CONFIRM_TOKEN_DAYS = 30;
export const RETENTION_DAYS = 30;
// Sign-ups allowed per hashed IP per window (counted in D1, see migrations/0002).
export const SIGNUP_LIMIT = 5;
export const SIGNUP_LIMIT_WINDOW_SECONDS = 60;
export const BATCH_SIZE = 100; // Resend's batch maximum
export const RESEND_API_BASE = "https://api.resend.com";
export const UNSUBSCRIBE_PLACEHOLDER = "{{unsubscribe_url}}";
