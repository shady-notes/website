#!/usr/bin/env bash
# Encode the brand film master into the two web renditions the landing page
# plays, named by content hash so they can be cached as immutable.
#
#   scripts/encode-film.sh [SRC] [OUT]
#
# SRC defaults to the 2-minute master, OUT to brand/promo-videos/web (gitignored;
# the renditions are published to downloads.shadynotes.app/media/ by
# `make film-publish`, never committed). See changes/008-BRAND-FILM-ON-LANDING.
#
# -g 60 -sc_threshold 0: a fixed 2 s GOP, so resuming after a pause and seeking
# land fast. aq-mode=3 biases bits toward dark areas, which keeps the
# green-black backgrounds from banding.
set -euo pipefail

# brand/ lives next to this repo (not in git): ../brand from the repo root.
BRAND="$(cd "$(dirname "$0")/../.." && pwd)/brand"
SRC="${1:-$BRAND/promo-videos/shadynotes-brand-film-2min.mp4}"
OUT="${2:-$BRAND/promo-videos/web}"
mkdir -p "$OUT"

common_v=(-profile:v high -pix_fmt yuv420p
  -g 60 -keyint_min 60 -sc_threshold 0 -x264-params aq-mode=3
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)

ffmpeg -hide_banner -loglevel error -y -i "$SRC" -map 0:v:0 -map 0:a:0 -map_metadata -1 \
  -c:v libx264 -preset slower -crf 22 -maxrate 2800k -bufsize 5600k -level:v 4.1 "${common_v[@]}" \
  -c:a aac -b:a 128k -ac 2 -movflags +faststart "$OUT/tmp-1080p.mp4"

ffmpeg -hide_banner -loglevel error -y -i "$SRC" -map 0:v:0 -map 0:a:0 -map_metadata -1 \
  -vf "scale=1280:720:flags=lanczos" \
  -c:v libx264 -preset slower -crf 23 -maxrate 1500k -bufsize 3000k -level:v 3.1 "${common_v[@]}" \
  -c:a aac -b:a 96k -ac 2 -movflags +faststart "$OUT/tmp-720p.mp4"

for r in 1080p 720p; do
  h=$(shasum -a 256 "$OUT/tmp-$r.mp4" | cut -c1-8)
  name="brand-film-2min.$h.$r.mp4"
  mv "$OUT/tmp-$r.mp4" "$OUT/$name"
  size=$(stat -f%z "$OUT/$name" 2>/dev/null || stat -c%s "$OUT/$name")
  echo "$r: $name ($((size / 1024 / 1024)) MB)"
done
