// `npm run media:fetch`: manifest -> H.264/AAC MP4 (faststart), poster frame,
// one MATERIALS.md row per asset, and linear loudness normalisation. The source
// is generated here (ffmpeg lavfi), so the test never depends on a talk's media.
import { test, expect } from "@playwright/test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ffmpegStderr = (args: string[]) => spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...args], { encoding: "utf8" }).stderr;

/** Integrated loudness (LUFS) of a file's audio, via ffmpeg's ebur128 filter. */
function loudness(file: string): number {
  return Number(ffmpegStderr(["-i", file, "-af", "ebur128", "-f", "null", "-"]).match(/I:\s+(-?[\d.]+) LUFS/g)!.pop()!.match(/-?[\d.]+/)![0]);
}

/** RMS level (dBFS) of 2 s of a file's audio starting at `at` seconds. */
function rms(file: string, at: number): number {
  const out = ffmpegStderr(["-ss", String(at), "-t", "2", "-i", file, "-vn", "-af", "astats=measure_overall=RMS_level:measure_perchannel=none", "-f", "null", "-"]);
  return Number(out.match(/RMS level dB: (-?[\d.]+)/)![1]);
}

const HEADER =
  "| Material or asset (file) | For beat (and ask #) | Source (URL) | Author or owner | Licence | Credit on screen? | How made (tool, prompt, model, date) | Status |";

test("fetches, trims, encodes, makes a poster, and records each asset once", async ({}, info) => {
  test.setTimeout(120_000);
  const dir = info.outputPath();
  mkdirSync(dir, { recursive: true });
  const out = resolve(dir, "media");
  const materials = resolve(dir, "MATERIALS.md");
  const manifest = resolve(dir, "media.json");
  // 8 s at 44.1 kHz: a quiet passage (0-4 s) next to one 14 dB louder (4-8 s).
  // Wide enough that dynamic loudnorm squeezes the gap; within LRA 20, so the
  // linear second pass keeps it.
  const src = resolve(dir, "source.mp4");
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=25:duration=8",
    "-f", "lavfi", "-i", "aevalsrc='if(lt(t,4),0.05,0.25)*sin(2*PI*440*t)':s=44100:d=8",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", src,
  ]);
  writeFileSync(
    manifest,
    JSON.stringify([
      {
        name: "tone", url: `file://${src}`, direct: true, from: 1, to: 7,
        audio: true, credit: "Test Author", licence: "CC BY 4.0", beat: "some-beat", onScreen: true,
      },
    ]),
  );
  const run = () => execFileSync("node", ["scripts/media-fetch.ts", "--manifest", manifest, "--out", out, "--materials", materials], { encoding: "utf8" });
  run();
  const mp4 = resolve(out, "tone.mp4");
  expect(existsSync(mp4)).toBe(true);
  expect(existsSync(resolve(out, "tone.jpg"))).toBe(true);
  const probe = JSON.parse(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,sample_rate:format=duration", "-of", "json", mp4], { encoding: "utf8" }),
  );
  expect(probe.streams.map((s: any) => s.codec_name).sort()).toEqual(["aac", "h264"]);
  expect(probe.streams.find((s: any) => s.codec_name === "aac").sample_rate).toBe("48000");
  expect(Number(probe.format.duration)).toBeCloseTo(6, 0);
  // one loudness target (EBU R128 integrated, -16 LUFS) ...
  expect(Math.abs(loudness(mp4) + 16)).toBeLessThan(1);
  // ... reached linearly: the quiet passage stays as far below the loud one as in the source
  const gapIn = rms(src, 4.5) - rms(src, 1.5);
  const gapOut = rms(mp4, 3.5) - rms(mp4, 0.5);
  expect(Math.abs(gapOut - gapIn), `quiet-to-loud gap ${gapIn.toFixed(1)} dB became ${gapOut.toFixed(1)} dB`).toBeLessThan(1);
  const bytes = readFileSync(mp4);
  expect(bytes.indexOf("moov")).toBeLessThan(bytes.indexOf("mdat")); // +faststart
  run(); // a second run adds no second row
  const lines = readFileSync(materials, "utf8").trim().split("\n");
  expect(lines[0]).toBe(HEADER);
  const rows = lines.filter((l) => l.includes("tone.mp4"));
  expect(rows).toHaveLength(1);
  expect(rows[0]).toContain("| some-beat |");
  expect(rows[0]).toContain("| Test Author | CC BY 4.0 | yes |");
  expect(rows[0]).toMatch(/\| fetched \|$/);
});
