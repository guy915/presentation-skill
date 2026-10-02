// The fixture talk's media, made with ffmpeg at test time so the skill commits
// no binaries: a 2.4 s 1280x720 clip (a dark square crossing a grey field, over
// a 440 Hz tone) as WebM (VP9 + Opus, which headless Chromium plays), its first
// frame as the poster, and a 1920x1080 fallback still (the canvas's outline on
// grey). Written to out/fixture-media/, which `npm run test:runtime` ships as
// TALK_PUBLIC (playwright.config.ts); files newer than this script are kept.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURE_MEDIA = "out/fixture-media";

const ffmpeg = (args: string[]) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: ["ignore", "ignore", "inherit"] });

/** Each file (under FIXTURE_MEDIA) and how to make it at `out`. */
const media: Record<string, (out: string) => void> = {
  "fixture/clip.webm": (out) =>
    ffmpeg([
      ...["-f", "lavfi", "-i", "color=c=0x797b78:s=1280x720:r=30:d=2.4"],
      ...["-f", "lavfi", "-i", "color=c=0x393b38:s=200x200:r=30:d=2.4"],
      ...["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2.4"],
      ...["-filter_complex", "[0][1]overlay=x='min(1080,t*1080/(2.4-1/30))':y=260:eval=frame,format=yuv420p[v]"],
      ...["-map", "[v]", "-map", "2:a", "-ac", "1"],
      ...["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1"],
      ...["-c:a", "libopus", "-b:a", "64k", "-t", "2.4", out],
    ]),
  "fixture/clip-poster.jpg": (out) => ffmpeg(["-i", resolve(FIXTURE_MEDIA, "fixture/clip.webm"), "-frames:v", "1", "-q:v", "3", out]),
  "fixture/fallback.png": (out) =>
    ffmpeg(["-f", "lavfi", "-i", "color=c=0x989898:s=1920x1080:d=1", "-vf", "drawbox=x=160:y=300:w=760:h=420:color=0x656565:t=8,format=rgb24", "-frames:v", "1", out]),
};

/** Makes any missing or stale fixture media; throws a clear error without ffmpeg. */
export function fixtureMedia() {
  const made = statSync(fileURLToPath(import.meta.url)).mtimeMs;
  const stale = Object.keys(media).filter((f) => {
    const p = resolve(FIXTURE_MEDIA, f);
    return !existsSync(p) || statSync(p).mtimeMs < made;
  });
  if (!stale.length) return;
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    throw new Error("the runtime's self-tests need ffmpeg (they make the fixture talk's clip, poster and fallback still with it): install it and put it on PATH");
  }
  // in order: the poster is cut from the clip
  for (const [f, make] of Object.entries(media)) {
    if (!stale.includes(f) && !(f.endsWith("poster.jpg") && stale.includes("fixture/clip.webm"))) continue;
    const p = resolve(FIXTURE_MEDIA, f);
    mkdirSync(dirname(p), { recursive: true });
    const tmp = p.replace(/(\.\w+)$/, ".tmp$1"); // written whole, then moved in: a reader never sees half a file
    make(tmp);
    renameSync(tmp, p);
  }
}
