#!/usr/bin/env bash
# Study an exemplar or a recording of the speaker: frame contact sheets, cut rate, transcript and speaking rate.
#
#   study-video.sh [--transcript-only] <url-or-file> [out-dir] [seconds-between-frames] [section]
#
# --transcript-only (URLs): captions and metadata only, no video. section (URLs): a yt-dlp
# --download-sections range such as "*0:00-10:00". A local file reads <name>.srt beside it.
# Writes sheet-NN.png (6×5 tiles), transcript.txt and summary.txt. With no out-dir, inside a talk
# (a folder above holds package.json and src/beats.ts), notes go to docs/benchmark/<slug>/ and the
# video, captions and sheets to out/study/<slug>/; outside a talk, to ./study/<slug>/.
# SUB_LANGS picks caption languages (default "en,en-orig"). Needs ffmpeg, ffprobe, python3; yt-dlp for URLs.
set -euo pipefail

transcript_only=false
if [[ "${1:-}" == "--transcript-only" ]]; then transcript_only=true; shift; fi
src="${1:?usage: study-video.sh [--transcript-only] <url-or-file> [out-dir] [seconds-between-frames] [section]}"
out="${2:-}"
notes="$out"
if [[ -z "$out" ]]; then
  # slug: a file's name, or a URL's video id (v=...) or last path segment
  base="$src"; [[ "$src" =~ [?\&]v=([^\&]+) ]] && base="${BASH_REMATCH[1]}"
  base="${base%%\?*}"; base="${base%/}"; base="$(basename "$base")"; [[ -f "$src" ]] && base="${base%.*}"
  slug="$(printf '%s' "$base" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')"
  slug="${slug:-$(date +%Y%m%d-%H%M%S)}"
  talk="$PWD"; while [[ "$talk" != "/" && ! ( -f "$talk/package.json" && -f "$talk/src/beats.ts" ) ]]; do talk="$(dirname "$talk")"; done
  if [[ "$talk" == "/" ]]; then out="study/$slug"; notes="$out"
  else out="$talk/out/study/$slug"; notes="$talk/docs/benchmark/$slug"; fi
fi
every="${3:-5}"
section="${4:-}"
mkdir -p "$out" "$notes"

count_words() {  # Auto-captions repeat each line as it scrolls; keep each distinct line once.
  grep -vE '^[0-9]+$|-->|^[[:space:]]*$' "$1" | sed -E 's/<[^>]+>//g' | awk '!seen[$0]++' > "$notes/transcript.txt"
  wc -w < "$notes/transcript.txt" | tr -d ' '
}

# summary <duration> <captions-or-empty> [<every> <cuts> <sheets>]: writes and prints summary.txt.
summary() {
  local words=0
  [[ -n "$2" ]] && words=$(count_words "$2")
  python3 - "$1" "$words" "${@:3}" > "$notes/summary.txt" <<'PY'
import sys
duration, words = float(sys.argv[1]), int(sys.argv[2])
minutes = duration / 60
print(f"duration: {int(duration // 60)}:{int(duration % 60):02d} ({duration:.0f} s)")
if len(sys.argv) > 3:
    every, cuts, sheets = float(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
    print(f"frames: one every {every:g} s on {sheets} sheet(s); tile i of sheet k is at ((k-1)*30+i)*{every:g} s")
    shot = f"; mean shot {duration / (cuts + 1):.1f} s" if cuts else ""
    print(f"cuts: {cuts} ({cuts / minutes:.1f} per minute{shot})")
print(f"transcript: {words} words, ~{words / minutes:.0f} words per minute over the whole video" if words else "transcript: none found")
PY
  cat "$notes/summary.txt"
}

# yt-dlp: captions (SUB_LANGS) and metadata, into out-dir as video.*
fetch=(-q --no-warnings --no-playlist --write-subs --write-auto-subs --sub-langs "${SUB_LANGS:-en,en-orig}"
       --convert-subs srt --write-info-json -o "$out/video.%(ext)s")

if $transcript_only; then
  # A missing or rate-limited caption track shouldn't abort the study; the summary says so.
  yt-dlp "${fetch[@]}" --skip-download "$src" || true
  [[ -f "$out/video.info.json" ]] || { echo "could not read $src" >&2; exit 1; }
  duration=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["duration"])' "$out/video.info.json")
  summary "$duration" "$(ls "$out"/video*.srt 2>/dev/null | head -1 || true)"
  exit 0
fi

if [[ -f "$src" ]]; then
  video="$src"
  captions=$(ls "${src%.*}".srt "${src%.*}".en*.srt 2>/dev/null | head -1 || true)
else
  # 480p is plenty for studying composition and pacing, and keeps long keynotes small.
  args=("${fetch[@]}" -f 'bv*[height<=480]+ba/b[height<=480]/b' --merge-output-format mp4)
  [[ -n "$section" ]] && args+=(--download-sections "$section")
  yt-dlp "${args[@]}" "$src" || true
  video="$out/video.mp4"
  [[ -f "$video" ]] || { echo "could not download $src" >&2; exit 1; }
  captions=$(ls "$out"/video*.srt 2>/dev/null | head -1 || true)
fi

duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$video")

# One frame every $every seconds, 30 per sheet; tile i (row-major, from 0) of sheet k sits at ((k-1)*30+i)*every s.
ffmpeg -v error -y -i "$video" -vf "fps=1/$every,scale=320:-2,tile=6x5" "$out/sheet-%02d.png"

# Hard cuts via scene-change detection on a small copy of the picture.
cuts=$(ffmpeg -v info -nostats -i "$video" -an -vf "scale=160:-2,select='gt(scene,0.3)',showinfo" -f null - 2>&1 \
  | grep -c 'pts_time:' || true)

summary "$duration" "$captions" "$every" "$cuts" "$(ls "$out"/sheet-*.png | wc -l | tr -d ' ')"
if [[ "$notes" != "$out" ]]; then echo "notes -> $notes; video and sheets -> $out"; fi
