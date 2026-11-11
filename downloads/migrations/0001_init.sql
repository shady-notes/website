-- DMG downloads per UTC day. Nothing about the visitor is stored.
CREATE TABLE downloads (
  day  TEXT    NOT NULL,  -- YYYY-MM-DD (UTC)
  file TEXT    NOT NULL,  -- ShadyNotes-4.1.19.dmg, ShadyNotes.dmg (unversioned alias)
  kind TEXT    NOT NULL,  -- site (browser) | update (Sparkle) | homebrew | other (curl, scripts)
  n    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, file, kind)
);
