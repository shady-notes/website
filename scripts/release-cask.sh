#!/usr/bin/env bash
# release-cask.sh — full ShadyNotes Homebrew release loop:
#   make release (app repo, auto-bumps VERSION) → upload DMG to GitHub Releases
#   → bump version/sha256 in the tap cask → verify upgrade path.
#
# Requirements on the machine running this:
#   - the app repo checked out next to this repo (../shadynotes from the repo root) with Makefile.config (Developer ID
#     cert in Keychain + NOTARY_PROFILE stored)
#   - gh authenticated with push access to $RELEASES_REPO and $TAP_REPO
#
# The app-repo git commit + tag of the VERSION bump stays manual, per that
# repo's workflow. This script only builds, uploads, and updates the cask.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../../shadynotes" && pwd)"
RELEASES_REPO="juliusnguyen/shadynotes-releases"
TAP_REPO="juliusnguyen/homebrew-tap"
CASK_PATH="Casks/shadynotes.rb"

SKIP_BUILD="${SKIP_BUILD:-}"   # SKIP_BUILD=1 → reuse existing DMG for current VERSION

if [ -z "$SKIP_BUILD" ]; then
  ( cd "$APP_DIR" && make release )          # bumps VERSION itself
fi

VERSION="$(cat "$APP_DIR/VERSION")"          # read AFTER the bump
DMG="$APP_DIR/ShadyNotes-$VERSION.dmg"
[ -f "$DMG" ] || { echo "✘ missing $DMG"; exit 1; }

echo "━━━ Verifying artifact before upload ━━━"
xcrun stapler validate "$DMG"
spctl --assess --type open --context context:primary-signature "$DMG"

SHA="$(shasum -a 256 "$DMG" | awk '{print $1}')"
echo "  v$VERSION  sha256=$SHA"

echo "━━━ Uploading to $RELEASES_REPO ━━━"
if gh release view "v$VERSION" -R "$RELEASES_REPO" >/dev/null 2>&1; then
  echo "  release v$VERSION exists — uploading asset (clobber)"
  gh release upload "v$VERSION" "$DMG" -R "$RELEASES_REPO" --clobber
else
  gh release create "v$VERSION" "$DMG" -R "$RELEASES_REPO" \
    -t "Shady Notes $VERSION" -n "See https://shadynotes.app"
fi

echo "━━━ Bumping cask in $TAP_REPO ━━━"
CUR="$(gh api "repos/$TAP_REPO/contents/$CASK_PATH")"
NEW="$(printf '%s' "$CUR" | jq -r .content | base64 -d \
  | sed -E "s/version \"[0-9.]+\"/version \"$VERSION\"/; s/sha256 \"[0-9a-f]+\"/sha256 \"$SHA\"/")"
gh api -X PUT "repos/$TAP_REPO/contents/$CASK_PATH" \
  -f message="shadynotes $VERSION" \
  -f sha="$(printf '%s' "$CUR" | jq -r .sha)" \
  -f content="$(printf '%s' "$NEW" | base64)" >/dev/null
echo "  cask now at v$VERSION"

echo "━━━ Self-verifying upgrade path ━━━"
if brew list --cask shadynotes >/dev/null 2>&1; then
  brew update
  brew upgrade --cask shadynotes || brew reinstall --cask shadynotes
  echo "✓ brew upgraded to $(brew list --cask --versions shadynotes)"
else
  echo "  (shadynotes cask not installed locally — skipping brew upgrade check)"
fi

echo ""
echo "══════════════════════════════════════════════"
echo "  Shady Notes v$VERSION released to Homebrew"
echo "  Remember: commit + tag the VERSION bump in the app repo"
echo "══════════════════════════════════════════════"

# The docs carry a "Documented against <version>" claim in their footer, and it
# goes stale silently the moment a release ships. Say so here rather than
# letting the site quietly describe an older build.
DOCS_CFG="$(cd "$(dirname "$0")/.." && pwd)/docs-site/src/config/docs.ts"
if [ -f "$DOCS_CFG" ]; then
  DOCUMENTED=$(grep -oE 'DOCUMENTED_VERSION = "[^"]+"' "$DOCS_CFG" | sed -E 's/.*"([^"]+)".*/\1/')
  if [ "$DOCUMENTED" != "$VERSION" ]; then
    echo ""
    echo "──────────────────────────────────────────────"
    echo "  DOCS: docs.shadynotes.app still says $DOCUMENTED"
    echo ""
    echo "  If this release changed anything user-visible:"
    echo "    1. re-check the affected pages against the new build"
    echo "    2. re-capture any screenshot that has changed  (make docs-shots)"
    echo "    3. bump DOCUMENTED_VERSION in docs-site/src/config/docs.ts"
    echo "    4. make docs-check && make docs-deploy"
    echo ""
    echo "  Bump the number only AFTER re-checking — an honest old"
    echo "  version beats a wrong new one."
    echo "──────────────────────────────────────────────"
  fi
fi
