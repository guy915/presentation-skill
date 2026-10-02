// npm run screening [-- --base <url>]: does each picture land with its words?
// Rest frames and strips can't show a payoff that finishes drawing seconds
// before the sentence about it. Per content beat, this captures the frame at
// the click, at the planned start of each spoken sentence (the talk's wpm;
// sentences() in manifest.ts, which timing shares: brackets aren't spoken) and
// at rest, captioned with the time and the sentence starting there.
//   out/screening/NN-<id>.png   one sheet per content beat
//   out/screening.pdf           all sheets, one per page
// A beat's `hold` sits where the script puts it (placeHold() in manifest.ts):
// the sheet shows it as a band and starts the sentences after it that much
// later, so the beat runs as long as timing plans it. --base drives a deck
// already served there (the test does).
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { withDeck, openDeck, deckBeats, seek, fileUrl, htmlPdf, renderHtml, STAGE, type DeckBeat } from "./lib/deck.ts";
import { placeHold, restLine, sentences, WPM } from "../src/runtime/manifest.ts";
import { beats as manifest, talk } from "./lib/talk.ts";

type Frame = { src: string; when: string; text: string; band?: boolean };
type Sheet = DeckBeat & { job?: string; hold?: { t: number; s: number } };

const OUT = resolve("out/screening");
const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ENTITIES[c]);
const secs = (t: number) => `+${t.toFixed(1)} s`;

const sheet = (n: number, beat: Sheet, frames: Frame[], rest: string) => `<!doctype html><meta charset="utf-8"><body style="margin:0;padding:24px;background:#1b1b1b;color:#eee;font:20px/1.35 system-ui,sans-serif;width:${Math.min(frames.length, 3) * 580 + 8}px">
  <h1 style="font-size:28px;margin:0 0 4px">${n} · ${esc(beat.id)} · ${esc(beat.label)}</h1>
  <p style="margin:0 0 16px;color:#aaa">${esc(beat.job ?? "")} &nbsp;·&nbsp; transition ${beat.transition ? `${beat.transition.toFixed(1)} s` : "none (a cut)"} &nbsp;·&nbsp; planned ${beat.duration.toFixed(1)} s${beat.hold ? ` &nbsp;·&nbsp; hold ${beat.hold.s} s at ${secs(beat.hold.t)}` : ""} &nbsp;·&nbsp; <b style="color:#fff">${rest}</b></p>
  <div style="display:grid;grid-template-columns:repeat(${Math.min(frames.length, 3)},560px);gap:28px 20px">
  ${frames.map((f) => `<figure style="margin:0"><img src="${fileUrl(f.src)}" width="560" height="${Math.round((560 * STAGE.height) / STAGE.width)}" style="display:block;outline:1px solid #444">
    <figcaption style="padding:8px 0 0${f.band ? ";margin-top:8px;padding:6px 10px;background:#6b4a00" : ""}"><b style="color:#fff">${esc(f.when)}</b><br>${esc(f.text)}</figcaption></figure>`).join("")}
  </div></body>`;

const { values: o } = parseArgs({ options: { base: { type: "string" } } });
const wpm = talk.wpm ?? WPM;
rmSync(OUT, { recursive: true, force: true });
rmSync(`${OUT}.pdf`, { force: true });
mkdirSync(resolve(OUT, "frames"), { recursive: true });
await withDeck(
  async ({ browser, base }) => {
    const page = await openDeck(browser, base);
    const beats = await deckBeats(page);
    const sheets: string[] = [];
    for (let i = 0; i < beats.length; i++) {
      const m = manifest[i];
      if ((m.kind ?? "content") !== "content") continue;
      const pause = placeHold(m);
      const held = pause.s ? { t: +((pause.at / wpm) * 60).toFixed(2), s: pause.s } : undefined;
      const beat: Sheet = { ...beats[i], job: m.job, hold: held };
      const name = `${String(i + 1).padStart(2, "0")}-${beat.id}`;
      // progress at t seconds after the click: a cut, or a finished transition, rests
      const at = (t: number) => (beat.transition > 0 ? Math.min(1, t / beat.transition) : 1);
      const shots = new Map<number, string>(); // one screenshot per distinct progress
      const shot = async (p: number) => {
        if (!shots.has(p)) {
          const src = resolve(OUT, `frames/${name}-${shots.size}.png`);
          await seek(page, i, p);
          await page.screenshot({ path: src });
          shots.set(p, src);
        }
        return shots.get(p)!;
      };
      const said = sentences(m.notes, wpm, pause);
      // the click, the hold (before a sentence at the same moment) and each sentence, in time order
      const moments = [...(held ? [{ t: held.t, text: "", band: true }] : []), ...said].sort((a, b) => a.t - b.t);
      if (moments[0]?.t !== 0) moments.unshift({ t: 0, text: "" });
      const frames: Frame[] = [];
      for (const s of moments) {
        const when = "band" in s ? `${s.t ? "" : "click · "}hold ${held!.s} s · ${secs(s.t)} → ${secs(s.t + held!.s)}` : s.t ? `${secs(s.t)}${at(s.t) === 1 ? " · picture already at rest" : ""}` : "click · +0.0 s";
        frames.push({ src: await shot(at(s.t)), when, text: s.text, band: "band" in s });
      }
      frames.push({ src: await shot(1), when: beat.transition ? `rest · transition ends ${secs(beat.transition)}` : "rest", text: "" });
      const out = resolve(OUT, `${name}.png`);
      await renderHtml(browser, sheet(i + 1, beat, frames, restLine(said, beat.transition)), out, { width: 1780 });
      sheets.push(out);
    }
    await htmlPdf(
      browser,
      `<!doctype html><style>@page{margin:0}body{margin:0;background:#1b1b1b}img{display:block;width:1780px;height:1200px;object-fit:contain;break-after:page}</style>${sheets.map((s) => `<img src="${fileUrl(s)}">`).join("")}`,
      `${OUT}.pdf`,
      { width: 1780, height: 1200 },
      { width: "1780px", height: "1200px" },
    );
  },
  { base: o.base },
);
rmSync(resolve(OUT, "frames"), { recursive: true });
console.log(`screening -> ${OUT}/ and ${OUT}.pdf`);
