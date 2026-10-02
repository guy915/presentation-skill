#!/usr/bin/env bash
# Tests study-video.sh run from inside a talk with no out-dir: the notes go to
# the talk's docs/benchmark/<slug>/ (kept in git) and the video and sheets to
# out/study/<slug>/ (ignored by the runtime's gitignore). Needs ffmpeg and git.
#   bash scripts/study-video.test.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }

# a talk: package.json and src/beats.ts at its root, the runtime's gitignore
talk="$tmp/talk"
mkdir -p "$talk/src/deep"
echo '{}' > "$talk/package.json"
echo 'export const beats = [];' > "$talk/src/beats.ts"
cp "$here/../assets/runtime/gitignore" "$talk/.gitignore"
git -C "$talk" init -q

clip="$tmp/Great Talk.mp4"
ffmpeg -v error -y -f lavfi -i testsrc=size=320x180:rate=10:duration=12 -pix_fmt yuv420p "$clip"
# run from a folder inside the talk: the talk's root is found upward
(cd "$talk/src/deep" && bash "$here/study-video.sh" "$clip" > /dev/null)

[[ "$(ls "$talk/docs/benchmark/great-talk")" == "summary.txt" ]] || fail "docs/benchmark/great-talk/ holds only summary.txt"
[[ -f "$talk/out/study/great-talk/sheet-01.png" ]] || fail "out/study/great-talk/sheet-01.png"
[[ -z "$(ls -A "$talk/src/deep")" ]] || fail "nothing is left where it ran"
git -C "$talk" check-ignore -q out/study/great-talk/sheet-01.png || fail "the study's bulk is ignored"
! git -C "$talk" check-ignore -q docs/benchmark/great-talk/summary.txt || fail "the study's notes are kept"
echo "ok: study-video.sh"
