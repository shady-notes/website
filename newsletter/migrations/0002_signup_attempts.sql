-- Sign-up rate limit, kept in D1 because the Workers rate-limit binding is
-- approximate per location (it let 27 sign-ups a minute through in production).
-- `key` is SHA-256(LIMITER_SALT | UTC day | IP): the IP itself is never stored.
-- Rows older than an hour are deleted on every sign-up and by the daily cron.
CREATE TABLE signup_attempts (
  key TEXT NOT NULL,
  at  TEXT NOT NULL
);
CREATE INDEX signup_attempts_key_at ON signup_attempts (key, at);
CREATE INDEX signup_attempts_at ON signup_attempts (at);
