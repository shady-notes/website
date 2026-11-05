-- Sign-ups and newsletter delivery records. Everything stored here is listed in
-- the Newsletter section of /privacy; change both together.

CREATE TABLE signups (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  email              TEXT NOT NULL UNIQUE,      -- lowercased
  interests          TEXT NOT NULL,             -- JSON array of topic ids
  source             TEXT NOT NULL,             -- which form: blog-index, post:<slug>
  created_at         TEXT NOT NULL,             -- signed up (restarts on a new sign-up after unsubscribing)
  confirm_token_hash TEXT,                      -- SHA-256 of the confirm token; NULL once used
  confirm_sent_at    TEXT,
  confirmed_at       TEXT,
  unsubscribed_at    TEXT,
  suppressed_at      TEXT,                      -- bounced or marked as spam: never mail again
  suppressed_reason  TEXT,
  policy_version     TEXT,                      -- consent record, set on confirm
  consent_wording    TEXT
);
CREATE INDEX signups_confirm_token ON signups (confirm_token_hash);
CREATE INDEX signups_confirm_sent ON signups (confirm_sent_at);

CREATE TABLE issues (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,            -- the blog post
  subject      TEXT NOT NULL,
  topics       TEXT NOT NULL,                   -- JSON array
  tested_hash  TEXT NOT NULL,                   -- the exact rendering that was test-sent
  tested_at    TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE TABLE send_batches (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id        INTEGER NOT NULL REFERENCES issues (id),
  idempotency_key TEXT NOT NULL UNIQUE,         -- reused on retry so Resend never sends twice
  status          TEXT NOT NULL CHECK (status IN ('pending', 'sent')),
  created_at      TEXT NOT NULL,
  sent_at         TEXT,
  error           TEXT
);

CREATE TABLE deliveries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id   INTEGER NOT NULL REFERENCES issues (id),
  signup_id  INTEGER NOT NULL REFERENCES signups (id) ON DELETE CASCADE,
  batch_id   INTEGER NOT NULL REFERENCES send_batches (id),
  status     TEXT NOT NULL CHECK (status IN ('claimed', 'sent')),
  resend_id  TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (issue_id, signup_id)                  -- one copy of an issue per person, ever
);
CREATE INDEX deliveries_batch ON deliveries (batch_id);
