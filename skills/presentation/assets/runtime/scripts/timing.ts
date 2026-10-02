// npm run timing [-- --wpm 150] [--slot <minutes>] [--manifest <path>] [--rehearsal <file>]
// Planned time per beat, per section and in total: the script's words at the
// rate plus each beat's hold (rules in src/runtime/manifest.ts). Rate and
// slot come from the manifest's `talk`; flags override them.
// --rehearsal: planned against actual, from a file the speaker view saved
// ("Save rehearsal"): per beat, per section and in total, and the rate the
// speaker spoke at, with the talk.wpm to set when it differs by more than 5 %.
import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { words, seconds, hold, totals, markers, mmss, sectionRuns, WPM, type Beat, type Talk, type RehearsalFile } from "../src/runtime/manifest.ts";

const { values: o } = parseArgs({
  options: { wpm: { type: "string" }, slot: { type: "string" }, manifest: { type: "string" }, rehearsal: { type: "string" } },
});
const m = (await import(pathToFileURL(resolve(o.manifest ?? "src/beats.ts")).href)) as { beats: Beat[]; talk?: Talk };
const wpm = Number(o.wpm ?? m.talk?.wpm ?? WPM);
const slot = Number(o.slot ?? m.talk?.slot ?? 0);
const { beats } = m;

/** A beat is off plan by more than 30 % and more than 5 s. */
const OFF_SHARE = 0.3;
const OFF_S = 5;
/** A measured rate this far from talk.wpm gets a suggestion. */
const RATE_SHARE = 0.05;

if (o.rehearsal) rehearsal(JSON.parse(readFileSync(o.rehearsal, "utf8")));
else plan();

function plan() {
  const bySection = new Map<string, number>();
  for (const b of beats) {
    const s = seconds(b, wpm);
    bySection.set(b.section, (bySection.get(b.section) ?? 0) + s);
    const what = b.kind && b.kind !== "content" ? `(${b.kind}, not counted)` : `${words(b.notes)} words${b.hold ? ` + ${b.hold} s hold` : ""}`;
    console.log(`${b.id.padEnd(24)} ${what.padEnd(32)} ${mmss(s)}`);
  }
  console.log("");
  for (const [id, s] of bySection) console.log(`section ${id.padEnd(16)} ${mmss(s)}`);
  const t = totals(beats, wpm, slot);
  console.log(`\nspeech ${mmss(t.speech)}\nholds  ${mmss(t.holds)}\ntotal  ${mmss(t.total)} at ${wpm} wpm`);
  if (slot) console.log(`${t.share}% of a ${slot} min slot`);
  const left = markers(beats);
  console.log(`markers: ${left.FILL} FILL, ${left.CONFIRM} CONFIRM, ${left.TODO} TODO`);
}

function rehearsal(r: RehearsalFile) {
  const took = new Map(r.beats.map((b) => [b.id, b]));
  const actual = beats.map((b) => took.get(b.id)?.seconds ?? 0);
  const planned = beats.map((b) => seconds(b, wpm));
  const signed = (s: number) => `${s < 0 ? "-" : "+"}${mmss(Math.abs(s))}`;
  const row = (name: string, p: number, a: number, note = "") => `${name.padEnd(28)} ${mmss(p).padStart(7)} ${mmss(a).padStart(7)} ${signed(a - p).padStart(7)}${note}`;
  console.log(`rehearsal of ${r.started}\n\n${"".padEnd(28)} ${"planned".padStart(7)} ${"actual".padStart(7)} ${"diff".padStart(7)}`);
  beats.forEach((b, i) => {
    const d = actual[i] - planned[i];
    const off = (b.kind ?? "content") === "content" && Math.abs(d) > OFF_S && Math.abs(d) > OFF_SHARE * planned[i];
    const note = !took.has(b.id) ? "  not in the rehearsal" : off ? `  <- off by ${planned[i] ? `${Math.round((100 * d) / planned[i])}%` : `${Math.round(d)} s`}` : "";
    console.log(row(b.id, planned[i], actual[i], note));
  });
  console.log("");
  const sum = (list: number[], from = 0, to = list.length) => list.slice(from, to).reduce((a, b) => a + b, 0);
  for (const run of sectionRuns(beats, wpm)) console.log(row(`section ${run.section}`, run.planned, sum(actual, run.from, run.to)));
  const total = sum(actual);
  console.log(`\n${row("total", sum(planned), total)}${slot ? `  (${Math.round((total / (slot * 60)) * 100)}% of a ${slot} min slot)` : ""}`);

  // The rate: words over the time spent speaking (actual minus hold) on the content beats shown.
  const spoken = beats.flatMap((b, i) => ((b.kind ?? "content") === "content" && actual[i] > 0 ? [{ words: took.get(b.id)?.words ?? words(b.notes), s: Math.max(0, actual[i] - hold(b)) }] : []));
  const n = sum(spoken.map((x) => x.words));
  const s = sum(spoken.map((x) => x.s));
  if (!s) return console.log("\nrate: no content beat was on screen");
  const rate = Math.round((n / s) * 60);
  console.log(`\nrate: ${n} words in ${mmss(s)} of speaking = ${rate} wpm (talk.wpm ${wpm})`);
  if (Math.abs(rate - wpm) > RATE_SHARE * wpm) console.log(`set talk.wpm to ${rate}`);
}
