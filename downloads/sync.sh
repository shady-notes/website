#!/bin/bash
# Stage the downloads host's files into public/ for `npx wrangler deploy`.
# Mirrors the old VPS layout: /macos/* (Sparkle feed + DMGs), /media/* (brand film).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
# The folder holding website/, shadynotes/ (app repo) and brand/ side by side.
ROOT="$(cd "$HERE/../.." && pwd)"
[ -d "$ROOT/shadynotes/dist" ] || { echo "✗ no app repo dist/ at $ROOT/shadynotes/dist"; exit 1; }
[ -d "$ROOT/brand/promo-videos/web" ] || { echo "✗ no brand film renditions at $ROOT/brand/promo-videos/web"; exit 1; }
APP_DIST="$ROOT/shadynotes/dist"
FILM_DIR="$ROOT/brand/promo-videos/web"
PUB="$HERE/public"
VERSION="$(cat "$ROOT/shadynotes/VERSION")"

rm -rf "$PUB"; mkdir -p "$PUB/macos" "$PUB/media"
shopt -s nullglob
cp "$APP_DIST"/ShadyNotes-*.dmg "$APP_DIST"/*.delta "$APP_DIST"/appcast.xml "$PUB/macos/"
shopt -u nullglob
# Unversioned "latest" alias, kept for old links (see shadynotes/scripts/publish.sh step 5).
cp "$PUB/macos/ShadyNotes-$VERSION.dmg" "$PUB/macos/ShadyNotes.dmg"
cp "$FILM_DIR"/brand-film-*.mp4 "$PUB/media/"
printf 'ok\n' > "$PUB/healthz"

cat > "$PUB/_headers" <<'H'
/macos/*.dmg
  Content-Type: application/x-apple-diskimage
  Cache-Control: public, max-age=31536000, immutable

/macos/ShadyNotes.dmg
  ! Cache-Control
  Cache-Control: public, max-age=300, must-revalidate

/macos/appcast.xml
  Cache-Control: public, max-age=300

/media/*
  Cache-Control: public, max-age=31536000, immutable
H

find "$PUB" -type f -size +25M -print | sed 's/^/✗ over 25 MiB: /' | grep . && exit 1
echo "✓ staged $(find "$PUB" -type f | wc -l | tr -d ' ') files ($(du -sh "$PUB" | cut -f1)) for v$VERSION"
