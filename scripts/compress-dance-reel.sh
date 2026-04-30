#!/usr/bin/env bash
# High-quality H.264 + AAC, two-pass, total output ~95 MiB (under GitHub 100 MiB cap).
# Requires: ffmpeg (brew install ffmpeg)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IN="${1:-media/dance-reel-0417.mov}"
OUT="${2:-media/dance-reel-0417-web.mp4}"
# Target *container* size in bytes (~95 MiB leaves headroom for mux + variance)
TARGET_BYTES=$((95 * 1024 * 1024))
AUDIO_BPS=192000

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found. Install with: brew install ffmpeg" >&2
  exit 1
fi

if [[ ! -f "$IN" ]]; then
  echo "Input not found: $IN" >&2
  exit 1
fi

DUR="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$IN")"
if [[ -z "$DUR" || "$DUR" == "N/A" ]]; then
  echo "Could not read duration from: $IN" >&2
  exit 1
fi

# Video bitrate (bits/sec) ≈ (target_bytes * 8 / duration) - audio; cap mux overhead ~3%
VIDEO_BPS="$(python3 -c "import math; d=float('$DUR'); t=$TARGET_BYTES; a=$AUDIO_BPS; v=max(int((t*8*0.97)/d - a), 500_000); print(v)")"

echo "Input:  $IN"
echo "Output: $OUT"
echo "Duration: ${DUR}s  →  target video bitrate: ${VIDEO_BPS} bps (AAC ${AUDIO_BPS} bps)"

PASSLOG="/tmp/dance-reel-pass-$$"
trap 'rm -f "${PASSLOG}-0.log" "${PASSLOG}-0.log.mbtree" 2>/dev/null || true' EXIT

# High quality: up to 1080p wide, slow preset, film tune; yuv420p for broad browser support
VF="scale='min(1920,iw)':-2:flags=lanczos,format=yuv420p"

MR=$((VIDEO_BPS * 13 / 10))
BS=$((VIDEO_BPS * 2))

ffmpeg -y -hide_banner -loglevel info -i "$IN" \
  -an -pass 1 -passlogfile "$PASSLOG" \
  -vf "$VF" \
  -c:v libx264 -preset slow -tune film \
  -b:v "${VIDEO_BPS}" -maxrate "${MR}" -bufsize "${BS}" \
  -f mp4 /dev/null

ffmpeg -y -hide_banner -loglevel info -i "$IN" \
  -pass 2 -passlogfile "$PASSLOG" \
  -vf "$VF" \
  -c:v libx264 -preset slow -tune film \
  -b:v "${VIDEO_BPS}" -maxrate "${MR}" -bufsize "${BS}" \
  -c:a aac -b:a "${AUDIO_BPS}" \
  -movflags +faststart \
  "$OUT"

SIZE="$(wc -c < "$OUT" | tr -d ' ')"
echo "Done: $OUT ($(ls -lh "$OUT" | awk '{print $5}'))"
if [[ "$SIZE" -gt $((100 * 1024 * 1024)) ]]; then
  echo "WARNING: Output is still over 100 MiB. Lower TARGET_BYTES in this script, or change VF to min(1280,iw)." >&2
  exit 2
fi

echo "Ready to commit: $OUT (media.html already points at this file)"
