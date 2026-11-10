#!/bin/bash
# Publish the Starlight docs (docs-site/) to Cloudflare Workers static assets:
# build origin/main, then `wrangler deploy` the Worker `shadynotes-docs`, which
# serves docs.shadynotes.app through a route on the proxied zone.
#
# WHY THIS IS THE SHAPE IT IS
# ---------------------------
# Same contract as the old Dokploy webhook: it builds
# origin/main in a throwaway worktree, never the working tree, so local edits and
# unpushed commits are never published. Push first, then deploy.
#
# Building inside a git worktree also gives Starlight the history it needs for
# `lastUpdated` — the Dokploy Docker build had no .git, so the "Last updated" line
# never rendered on the VPS.
#
# Needs `wrangler login` on this machine (guide: docs/CLOUDFLARE-DNS-PROXY-SETUP.md in the private shadynotes-hostinger repo).
# Config: docs-site/wrangler.jsonc. Cache policy: docs-site/public/_headers.
# History: changes/009-CLOUDFLARE-HOSTING/ in the private shadynotes-hostinger repo (archived).
set -euo pipefail

root=$(git rev-parse --show-toplevel)
work=$(mktemp -d)
trap 'git -C "$root" worktree remove --force "$work/src" >/dev/null 2>&1 || true; rm -rf "$work"' EXIT

echo "▶ Fetching origin/main…"
git -C "$root" fetch -q origin main
rev=$(git -C "$root" rev-parse --short origin/main)
git -C "$root" worktree add -q --detach "$work/src" origin/main

echo "▶ Building docs-site/ at ${rev}…"
(cd "$work/src/docs-site" && npm ci --silent && npm run build --silent)

echo "▶ Deploying shadynotes-docs…"
(cd "$work/src/docs-site" && wrangler deploy --message "docs: website@${rev}")
echo "✓ Deployed ${rev}. Run 'make verify-docs'."
