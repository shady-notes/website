-- Clicks per campaign link per UTC day. Nothing about the visitor is stored.
CREATE TABLE clicks (
  day     TEXT    NOT NULL,  -- YYYY-MM-DD (UTC)
  source  TEXT    NOT NULL,  -- the short-link source slug: hn, reddit, x, ...
  content TEXT    NOT NULL,  -- the post slug: post, macapps, tables, ...
  n       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, source, content)
);
