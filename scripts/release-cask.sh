#!/usr/bin/env bash
# release-cask.sh — point the Homebrew cask at the current release.
#
# Run AFTER the app repo's `make publish` has put the release on
# downloads.shadynotes.app. It builds nothing and uploads nothing:
#   1. read VERSION from the app repo (../shadynotes, next to this repo)
#   2. check the local DMG is notarised, and that the live versioned DMG on
#      downloads.shadynotes.app is byte-identical to it
#   3. bump version + sha256 in the tap cask (juliusnguyen/homebrew-tap) and in
#      the staged copy here (homebrew/Casks/shadynotes.rb)
#
# The cask downloads https://downloads.shadynotes.app/macos/ShadyNotes-<v>.dmg,
# the same file as the website's download button. Until 2026-11-11 this script
# ran `make release` and uploaded to a GitHub releases repo; that path is gone.
#
# Needs: gh with push access to the tap, jq, curl.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$(cd "$ROOT/../shadynotes" && pwd)"
TAP_REPO="juliusnguyen/homebrew-tap"
CASK_PATH="Casks/shadynotes.rb"
STAGED="$ROOT/homebrew/$CASK_PATH"

VERSION="$(cat "$APP_DIR/VERSION")"
DMG="$APP_DIR/ShadyNotes-$VERSION.dmg"
URL="https://downloads.shadynotes.app/macos/ShadyNotes-$VERSION.dmg"
[ -f "$DMG" ] || { echo "✘ missing $DMG"; exit 1; }

echo "━━━ Checking v$VERSION ━━━"
xcrun stapler validate "$DMG" >/dev/null
spctl --assess --type open --context context:primary-signature "$DMG"
SHA="$(shasum -a 256 "$DMG" | awk '{print $1}')"
LIVE="$(curl -fsSL -A "release-cask" "$URL" | shasum -a 256 | awk '{print $1}')" \
  || { echo "✘ $URL is not live — run the app repo's make publish first"; exit 1; }
[ "$SHA" = "$LIVE" ] || { echo "✘ live DMG differs from $DMG ($LIVE vs $SHA)"; exit 1; }
echo "  ✓ notarised, live, identical  sha256=$SHA"

echo "━━━ Bumping $TAP_REPO ━━━"
CUR="$(gh api "repos/$TAP_REPO/contents/$CASK_PATH")"
OLD="$(printf '%s' "$CUR" | jq -r .content | base64 -d)"
NEW="$(printf '%s\n' "$OLD" | sed -E "s/version \"[0-9.]+\"/version \"$VERSION\"/; s/sha256 \"[0-9a-f]+\"/sha256 \"$SHA\"/")"
if [ "$NEW" = "$OLD" ]; then
  echo "  tap already at v$VERSION"
else
  gh api -X PUT "repos/$TAP_REPO/contents/$CASK_PATH" \
    -f message="shadynotes $VERSION" \
    -f sha="$(printf '%s' "$CUR" | jq -r .sha)" \
    -f content="$(printf '%s\n' "$NEW" | base64)" >/dev/null
  echo "  ✓ tap now at v$VERSION"
fi

sed -i '' -E "s/version \"[0-9.]+\"/version \"$VERSION\"/; s/sha256 \"[0-9a-f]+\"/sha256 \"$SHA\"/" "$STAGED"
echo "  ✓ staged copy updated: commit homebrew/$CASK_PATH"

echo "━━━ Done ━━━"
echo "  Users get it with: brew install --cask juliusnguyen/tap/shadynotes"
echo "  (auto_updates: existing installs update through Sparkle, not brew upgrade)"
