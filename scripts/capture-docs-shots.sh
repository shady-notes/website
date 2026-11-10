#!/bin/bash
# Capture the documentation screenshots for docs.shadynotes.app.
#
# WHY THIS IS THE SHAPE IT IS
# ---------------------------
# It runs the INSTALLED RELEASE app inside a DEV sandbox:
#
#   SHADY_DEV=1 /Applications/ShadyNotes.app/Contents/MacOS/ShadyNotes
#
# AppPreferences.isDev is read from the environment at startup, so the same
# signed binary switches to the prefs suite dev.jscott.betterunclutter.dev and
# the vault ~/Documents/ShadyNotes-Dev/. The user's real prefs domain
# (dev.jscott.betterunclutter — note the LEGACY name, it is not the bundle id)
# and real vault are never touched by this script.
#
# It seeds shadyTrialStartedAt into the sandbox domain. LicenseManager.trialTier()
# parses that ISO8601 string and returns .trial(daysLeft: 14), which legitimately
# unlocks all three gated features — plugins, allThemes, revisionHistory — with
# no patched build and no fake licence. This is what makes the premium
# screenshots (Kanban, Daily Notes, Tasks, revision history, 13 of 16 themes)
# possible at all; on the free tier they render as LockedFeatureView.
#
# It is SEMI-MANUAL on purpose. Fully driving a borderless floating shade
# through AppleScript/accessibility is a rabbit hole; a checklist that prompts
# for each state is reproducible enough and honest about what it does not do.
#
# TWO THINGS THAT WILL RUIN EVERY SHOT IF IGNORED
#   1. BuildInfoOverlay ships UNGATED in release (ContentView.swift:166) — a
#      "build 0210 · ..." pill sits bottom-right of the shade. Click it to
#      dismiss before the first capture, once per app session.
#   2. In the DEV sandbox the toolbar reads "Shady Notes (DEV)"
#      (ContentView.swift:196). Shots where that label is prominent are marked
#      [RELEASE] below and must be taken in a separate snapshot-and-restore pass
#      (see `--release-pass`), not here.
#
set -euo pipefail

APP="/Applications/ShadyNotes.app"
BIN="$APP/Contents/MacOS/ShadyNotes"
SANDBOX_DOMAIN="dev.jscott.betterunclutter.dev"
REAL_DOMAIN="dev.jscott.betterunclutter"
SANDBOX_VAULT="$HOME/Documents/ShadyNotes-Dev"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FIXTURE="$ROOT/docs-site/fixtures/demo-vault"
RAW="$ROOT/docs-site/.captures"
OUT="$ROOT/docs-site/src/assets/screenshots"

mkdir -p "$RAW" "$OUT"

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------
preflight() {
  local fail=0
  echo "── preflight ──"

  if [ ! -x "$BIN" ]; then
    echo "  ✗ $BIN not found. Install ShadyNotes.app first."; fail=1
  else
    local v; v=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" \
                  "$APP/Contents/Info.plist" 2>/dev/null || echo "?")
    echo "  ✓ app $v"
    if [ -f "$ROOT/../shadynotes/VERSION" ]; then
      local want; want=$(tr -d '[:space:]' < "$ROOT/../shadynotes/VERSION")
      if [ "$v" != "$want" ]; then
        echo "  ✗ installed $v but the source tree says $want — shots would not match the build"
        fail=1
      fi
    fi
    # Keep the docs' stated version honest.
    local documented
    documented=$(grep -oE 'DOCUMENTED_VERSION = "[^"]+"' "$ROOT/docs-site/src/config/docs.ts" \
                 | sed -E 's/.*"([^"]+)".*/\1/')
    if [ "$v" != "$documented" ]; then
      echo "  ✗ docs say $documented but the app is $v — update docs-site/src/config/docs.ts"
      fail=1
    fi
  fi

  # Screen Recording permission. A denied capture still WRITES A FILE — it is
  # just wallpaper with no window content — so testing for file existence is
  # useless. Capture a strip of the menu bar, which is never plain wallpaper,
  # and check it is not a single flat colour.
  local probe="$RAW/_permprobe.png"
  screencapture -x -R0,0,300,24 "$probe" 2>/dev/null || true
  if [ ! -f "$probe" ]; then
    echo "  ✗ screencapture produced nothing"; fail=1
  else
    local colors
    colors=$(sips -g pixelWidth "$probe" >/dev/null 2>&1 && \
             python3 - "$probe" <<'PY'
import sys
try:
    from PIL import Image
    im = Image.open(sys.argv[1]).convert("RGB")
    print(len(set(im.getdata())))
except ImportError:
    print("skip")
PY
)
    if [ "$colors" = "skip" ]; then
      echo "  ~ screen recording: cannot auto-verify (no Pillow). Eyeball the first shot."
    elif [ "$colors" -lt 3 ] 2>/dev/null; then
      echo "  ✗ screen recording permission looks DENIED (captured a flat image)."
      echo "    System Settings > Privacy & Security > Screen Recording > enable your terminal."
      fail=1
    else
      echo "  ✓ screen recording permission"
    fi
    rm -f "$probe"
  fi

  for t in pngquant oxipng; do
    command -v "$t" >/dev/null 2>&1 && echo "  ✓ $t" || echo "  ~ $t not installed (optimisation will be skipped)"
  done

  [ $fail -eq 0 ] || { echo "✗ preflight failed"; exit 1; }
  echo
}

# ---------------------------------------------------------------------------
# Sandbox lifecycle
# ---------------------------------------------------------------------------
seed_sandbox() {
  echo "── seeding the DEV sandbox ──"
  echo "  domain : $SANDBOX_DOMAIN   (your real '$REAL_DOMAIN' is untouched)"
  echo "  vault  : $SANDBOX_VAULT"

  pkill -f "SHADY_DEV=1" 2>/dev/null || true
  osascript -e 'quit app "ShadyNotes"' 2>/dev/null || true
  sleep 1

  rm -rf "$SANDBOX_VAULT"
  mkdir -p "$SANDBOX_VAULT"
  cp -R "$FIXTURE"/. "$SANDBOX_VAULT"/
  echo "  ✓ vault seeded with $(find "$SANDBOX_VAULT" -name '*.md' | wc -l | tr -d ' ') notes"

  # A fresh trial start unlocks plugins / all themes / revision history for 14
  # days. See LicenseManager.trialTier().
  defaults write "$SANDBOX_DOMAIN" shadyTrialStartedAt -string "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  # Point the sandbox's first file tree at the demo vault.
  defaults write "$SANDBOX_DOMAIN" vaultPath -string "$SANDBOX_VAULT"
  defaults write "$SANDBOX_DOMAIN" theme -string "dark"
  echo "  ✓ 14-day trial seeded (unlocks the three gated features)"
  echo
}

launch_sandbox() {
  echo "▶ launching the release binary in DEV mode…"
  SHADY_DEV=1 "$BIN" >/dev/null 2>&1 &
  sleep 3
  echo "  ✓ running (pull tab will be RED — that is the dev build marker)"
  echo
  cat <<'NOTE'
  ── session hygiene, do these once, now ──
    1. Click the "build ####" pill at the bottom-right of the shade to dismiss it.
       It ships ungated in release and will otherwise be in every screenshot.
    2. Hide the Dock (⌥⌘D) so it never intrudes.
    3. Put a plain, neutral window behind the shade — NOT mail, chat, or anything
       with personal content. The shade is translucent; whatever is behind shows.
    4. Size the shade to ~1400-1600pt wide. Shots are taken large and rendered
       at =<760 CSS px, which is what buys back sharpness on Retina screens.

NOTE
  read -r -p "  Press Return when the session is set up… " _
}

# ---------------------------------------------------------------------------
# Capture helpers
# ---------------------------------------------------------------------------
# shot <name> <description>
#   Prompts for the state, then lets the operator drag a region.
shot() {
  local name="$1" desc="$2"
  local raw="$RAW/$name.png"
  echo "── $name ──"
  echo "   $desc"
  read -r -p "   Return to select the region (s = skip): " ans
  [ "$ans" = "s" ] && { echo "   skipped"; echo; return; }
  # -i interactive region select, -o no window shadow, -x no shutter sound
  screencapture -i -o -x "$raw" || true
  if [ ! -f "$raw" ]; then echo "   ✗ nothing captured"; echo; return; fi
  optimise "$raw" "$OUT/$name.png"
  echo
}

optimise() {
  local src="$1" dst="$2"
  cp "$src" "$dst"
  # Cap the long edge; shots are taken large but need not be enormous.
  sips -Z 1600 "$dst" >/dev/null 2>&1 || true
  if command -v pngquant >/dev/null 2>&1; then
    pngquant --quality 70-90 --force --output "$dst" "$dst" 2>/dev/null || true
  elif command -v oxipng >/dev/null 2>&1; then
    oxipng -o4 --strip safe "$dst" >/dev/null 2>&1 || true
  fi
  local kb=$(( $(stat -f%z "$dst") / 1024 ))
  if [ "$kb" -gt 300 ]; then
    echo "   ⚠ ${kb}KB — over the 300KB budget, re-crop or optimise further"
  else
    echo "   ✓ ${kb}KB -> $dst"
  fi
}

restore_real() {
  echo
  echo "── restoring ──"
  pkill -f "SHADY_DEV=1" 2>/dev/null || true
  echo "  ✓ sandbox app stopped"
  echo "  Your real prefs domain was never modified by this script."
}
trap restore_real EXIT

# ---------------------------------------------------------------------------
# The shot list. Mirrors the "Shots" column of 007.02 Phase 3.
# [RELEASE] = the dev build would give itself away — the "(DEV)" toolbar suffix,
#             or the red accent AppPreferences.swift:1339 hardcodes when isDev,
#             which colours the pull tab. Take these on the real release build.
# ---------------------------------------------------------------------------
run_shots() {
  shot shade-open-hero        "[RELEASE] Shade open, Welcome.md, sidebar visible. The hero shot."
  shot shade-closed           "Shade fully closed; only the pull tab under the menu bar."
  shot shade-opening          "[RELEASE] Shade held partway open — DRAG the pull tab down and release; it stays put. Do not chase the 0.32s animation."
  shot pull-tab-idle          "Pull tab collapsed to its small dot (move the mouse away, wait)."
  shot pull-tab-hover         "Pull tab expanded under the cursor."
  shot menubar-icon           "The menu bar umbrella icon, tight crop."
  shot toolbar-map            "[RELEASE] Toolbar only, tight crop across the full width."
  shot sidebar-file-tree      "Sidebar showing Projects/ Reference/ Snippets/ expanded."
  shot sidebar-search         "Sidebar with a search term typed and results listed."
  shot sidebar-starred        "Starred tab with at least two starred notes."
  shot tab-bar                "Three or four tabs open, one active."
  shot editor-wysiwyg         "Markdown Reference.md rendered (cursor outside any marker)."
  shot editor-raw-mode        "Same note in raw mode (⌃E)."
  shot markdown-kitchen-sink  "The /kitchensink output, or Create from Sample."
  shot checkboxes-list        "Launch Checklist.md — mixed list and standalone checkboxes."
  shot table-rendered         "Roadmap.md table, rendered with borders."
  shot table-toolbar          "Table toolbar panel visible (cursor inside a table)."
  shot callouts-gallery       "A note with several callout types (/callout)."
  shot callout-type-panel     "The /callout type picker open."
  shot image-inline           "A note with an inline image at a set width."
  shot image-preview-window   "The image preview window open."
  shot slash-command-panel    "Slash command picker open on a blank line."
  shot find-replace-bar       "Find and replace bar with a term and a match highlighted."
  shot theme-picker           "Theme picker overlay (⌥⌘T)."
  shot theme-gallery          "Sidebar Themes tab with swatches visible."
  shot workspace-dots         "Workspace strip with two or three coloured pills."
  shot navigator-window       "Navigator window, files listed."
  shot navigator-filters      "Navigator workspace filter pills."
  shot navigator-diff         "Navigator diff panel showing a change."
  shot sticky-note            "A sticky note floating over a neutral desktop."
  shot revision-history-overlay "Revision history timeline overlay (premium — trial is active)."
  shot conflict-diff          "Merge Conflict window. Type CONTINUOUSLY on one line, rewrite that same line on disk, then View diff."
  shot plugins-sidebar        "Sidebar puzzle tab listing the built-in plugins."
  shot plugin-scope-picker    "Plugin scope picker."
  shot plugin-daily-notes     "Daily Notes plugin view."
  shot plugin-kanban          "Kanban board with cards in columns."
  shot plugin-tasks           "Tasks plugin aggregating checkboxes."
  shot plugin-definition-viewer "A plugin's View Definition."
  shot prefs-appearance       "Preferences > Appearance."
  shot prefs-workspaces       "Preferences > Workspaces."
  shot prefs-editor           "Preferences > Editor."
  shot prefs-shortcuts        "Preferences > Shortcuts (the 32 remappable actions)."
  shot prefs-checkbox-styles  "Preferences > Editor, checkbox style picker open."
  shot prefs-history          "Preferences > History."
  shot prefs-vault            "Preferences > Vault (conflict resolution mode lives here)."
  shot prefs-plugins          "Preferences > Plugins."
  shot prefs-premium-free     "Preferences > Premium showing the trial state."
  shot prefs-premium-signed-in "[RELEASE] Preferences > Premium, signed in. CHECK: no real email visible — use a test account."
  shot signin-connect-page    "shadynotes.app/app/connect in a browser mid sign-in."
  shot shortcuts-overlay      "The in-app shortcuts overlay (⌘/)."
  shot toolbar-menu           "Toolbar ellipsis menu open."
  shot statusbar-menu         "Menu bar status item menu open."
  shot sparkle-update-dialog  "Sparkle 'Check for Updates' dialog."
  shot install-dmg-window     "The mounted DMG window with the drag-to-Applications layout."
  shot finder-vault           "Finder showing the vault folder of .md files."
}

# ---------------------------------------------------------------------------
case "${1:-}" in
  --preflight) preflight ;;
  --seed)      preflight; seed_sandbox ;;
  --release-pass)
    cat <<'MSG'
The release pass captures the shots marked [RELEASE], where the "(DEV)" toolbar
suffix would otherwise be visible.

It MODIFIES YOUR REAL PREFS DOMAIN (dev.jscott.betterunclutter) and restores it
afterwards. It is deliberately not wired up to run unattended — see
changes/007-DOCS-SITE/007.02-INITIAL-PLAN.md Decision 2 option (a), and confirm
before running it.
MSG
    ;;
  *)
    preflight
    seed_sandbox
    launch_sandbox
    run_shots
    echo "── done ──"
    echo "  Raw captures : $RAW"
    echo "  Optimised    : $OUT"
    echo "  Now run: make docs-shots-budget"
    ;;
esac
