// npm run media:fetch [-- name...] [--manifest media.json] [--out public/media] [--materials MATERIALS.md]
// Downloads every clip in media.json once, so the talk never needs the
// venue's network. Needs yt-dlp and ffmpeg. Output is gitignored; deploy ships
// it. Each entry:
//   { name, url, from?, to?, audio?: true, credit, licence, beat?, onScreen?, direct? }
// url: any page yt-dlp understands, or a direct file (direct: true; curl, file:// works).
// Encoding: H.264 + AAC MP4, CRF 18, +faststart, best source up to 1440p
// (plays in Chrome, Edge, Safari and Firefox), audio normalised linearly to -16 LUFS at 48 kHz,
// a trimmed clip's audio faded in and out over 50 ms. A source that is already H.264 at <= 1440p
// and not trimmed is copied, not re-encoded.
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs } from "node:util";

const { values: o, positionals: only } = parseArgs({
  allowPositionals: true,
  options: { manifest: { type: "string", default: "media.json" }, out: { type: "string", default: "public/media" }, materials: { type: "string", default: "MATERIALS.md" } },
});
const HEADER =
  "| Material or asset (file) | For beat (and ask #) | Source (URL) | Author or owner | Licence | Credit on screen? | How made (tool, prompt, model, date) | Status |\n" +
  "|---|---|---|---|---|---|---|---|\n";
// Every clip at one loudness, so no clip is a surprise in the room: EBU R128
// integrated -16 LUFS, true peak -1.5 dBTP. Two passes: single-pass loudnorm
// is dynamic and compresses music and speech with a wide range; pass 1
// measures, pass 2 applies one gain (linear=true). Where that gain would break
// the true-peak or LRA target, ffmpeg falls back to dynamic on its own; the
// script says so.
const LOUDNORM = "loudnorm=I=-16:TP=-1.5:LRA=20";
const FADE = 0.05; // s, so a cut doesn't click
/** One entry of media.json. */
interface Clip { name: string; url: string; direct?: boolean; from?: number; to?: number; audio?: boolean; credit?: string; licence?: string; beat?: string; onScreen?: boolean }
const clips: Clip[] = JSON.parse(readFileSync(o.manifest, "utf8"));
mkdirSync(o.out, { recursive: true });

const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
const probe = (file: string, stream = "v:0") =>
  JSON.parse(run("ffprobe", ["-v", "error", "-select_streams", stream, "-show_entries", "stream=codec_name,height:format=duration", "-of", "json", file]));
/** Runs ffmpeg and returns loudnorm's JSON report, which it prints to stderr at info level. */
function loudnormRun(args: string[]) {
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-nostats", ...args], { encoding: "utf8", maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error(`ffmpeg ${args.join(" ")}\n${r.stderr}`);
  const i = r.stderr.lastIndexOf("{");
  return i < 0 ? {} : JSON.parse(r.stderr.slice(i, r.stderr.indexOf("}", i) + 1));
}

function fetchOne({ name, url, direct, from, to, audio = true }: Clip) {
  const dest = join(o.out, `${name}.mp4`);
  const tmp = mkdtempSync(join(tmpdir(), "talk-media-"));
  try {
    console.log(`${name}: downloading ${url}`);
    let src: string;
    if (direct) {
      src = join(tmp, "raw");
      run("curl", ["-sSfL", "-o", src, url]);
    } else {
      run("yt-dlp", ["--no-warnings", "-q", "-f", "bv*[height<=1440]+ba/b[height<=1440]/bv*+ba/b", "-S", "res,vbr,abr", "-o", join(tmp, "raw.%(ext)s"), url]);
      src = join(tmp, readdirSync(tmp).find((f) => f.startsWith("raw."))!);
    }
    const { streams: [v], format } = probe(src);
    const trimmed = from !== undefined || to !== undefined;
    const copy = v.codec_name === "h264" && v.height <= 1440 && !trimmed;
    const cut = [...(from !== undefined ? ["-ss", String(from)] : []), ...(to !== undefined ? ["-to", String(to)] : []), "-i", src];
    const sound = audio && probe(src, "a:0").streams.length > 0;
    let af = "";
    if (sound) {
      const m = loudnormRun([...cut, "-map", "0:a:0", "-af", `${LOUDNORM}:print_format=json`, "-f", "null", "-"]);
      // loudnorm works at 192 kHz internally: back to 48 kHz after it
      af = `${LOUDNORM}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true:print_format=json,aresample=48000`;
      if (trimmed) {
        const len = Math.min(to ?? Infinity, Number(format.duration)) - (from ?? 0);
        af += `,afade=t=in:d=${FADE},afade=t=out:st=${Math.max(0, len - FADE)}:d=${FADE}`;
      }
    }
    const applied = loudnormRun([
      ...cut, "-map", "0:v:0", ...(sound ? ["-map", "0:a:0"] : []),
      ...(copy ? ["-c:v", "copy"] : ["-c:v", "libx264", "-crf", "18", "-preset", "slow", "-pix_fmt", "yuv420p", "-vf", "scale=-2:'min(1440,ih)'"]),
      ...(sound ? ["-af", af, "-c:a", "aac", "-b:a", "192k"] : ["-an"]),
      "-movflags", "+faststart", dest,
    ]);
    if (sound && applied.normalization_type !== "linear")
      console.log(`${name}: note: -16 LUFS not reachable with one gain (true peak or loudness range), loudnorm fell back to dynamic`);
    run("ffmpeg", ["-y", "-loglevel", "error", "-i", dest, "-frames:v", "1", "-q:v", "3", join(o.out, `${name}.jpg`)]);
    console.log(`${name}: -> ${dest} (${copy ? "copied" : "H.264 CRF 18"}) + poster`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** One MATERIALS.md row per clip, status fetched; a second run adds none. */
function record(c: Clip) {
  if (!existsSync(o.materials)) writeFileSync(o.materials, HEADER);
  const file = `media/${c.name}.mp4`;
  if (readFileSync(o.materials, "utf8").includes(`| ${file} |`)) return;
  const range = c.from !== undefined || c.to !== undefined ? ` ${c.from ?? 0}-${c.to ?? "end"} s` : "";
  const how = `yt-dlp + ffmpeg${range}, H.264 CRF 18, ${new Date().toISOString().slice(0, 10)}`;
  appendFileSync(o.materials, `| ${file} | ${c.beat ?? ""} | ${c.url} | ${c.credit ?? ""} | ${c.licence ?? ""} | ${c.onScreen ? "yes" : "no"} | ${how} | fetched |\n`);
}

for (const c of clips) if (!only.length || only.includes(c.name)) (fetchOne(c), record(c));
console.log(`done: ${resolve(o.out)}`);
