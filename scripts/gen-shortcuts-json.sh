#!/bin/bash
# Regenerate docs-site/src/data/shortcuts.json from the app's own source.
#
# IMPORTANT: this reads the app repo checked out NEXT TO this one (../shadynotes/), and is
# NOT present in CI. It is therefore a LOCAL developer tool only — never invoke
# it from a make target that CI runs. The generated JSON is committed; that is what the docs
# site actually reads.
#
#   ./scripts/gen-shortcuts-json.sh
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/../shadynotes/Sources/ShadyNotesCore/EditorShortcuts.swift"
OUT="$ROOT/docs-site/src/data/shortcuts.json"

if [ ! -f "$SRC" ]; then
  echo "✗ $SRC not found."
  echo "  The app source is a separate, gitignored checkout. Clone it beside this"
  echo "  repo next to this one (../shadynotes/) to regenerate. The committed JSON is still valid."
  exit 1
fi

echo "▶ Reading $SRC"
python3 "$ROOT/scripts/gen_shortcuts.py" "$SRC" "$OUT"
echo "✓ wrote $OUT"
