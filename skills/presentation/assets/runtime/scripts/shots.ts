// npm run shots: what a visual reviewer looks at, from the production build.
//   out/shots/rest/NN-<id>.png        every beat at rest (the stage's size, from talk.aspect)
//   out/shots/contact.png             labelled contact sheet
//   out/shots/contact-washed.png      the same, as a washed-out projector shows it
//   out/shots/contact-<deficiency>.png  under emulated colour-vision deficiencies
//   out/shots/strips/NN-<id>.png      8 frames of each transition, via seek(i, p)
//   public/rest/<id>.jpg              every beat at rest, shipped as the stand-in a
//                                     section shows if its code fails at the venue
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { withDeck, openDeck, deckBeats, seek, fileUrl, renderHtml, STAGE, type DeckBeat } from "./lib/deck.ts";

const OUT = resolve("out/shots");
const STRIP = 8;
// Projector with a raised black level and less contrast: blacks lift to about
// 18% grey, whites drop to about 90%.
const WASHED = "contrast(0.72) brightness(1.08) saturate(0.85)";
const DEFICIENCIES = ["deuteranopia", "protanopia", "tritanopia"];

const tall = (w: number) => Math.round((w * STAGE.height) / STAGE.width); // a thumbnail's height at the stage's aspect
const name = (i: number, b: DeckBeat) => `${String(i + 1).padStart(2, "0")}-${b.id}`;
const sheet = (items: { src: string; label: string }[]) => `<!doctype html><meta charset="utf-8"><body style="margin:10px;background:#222;font:18px system-ui;color:#eee;display:grid;grid-template-columns:repeat(4,480px);gap:10px">
  ${items.map(({ src, label }) => `<figure style="margin:0"><img src="${fileUrl(src)}" width="480" height="${tall(480)}" style="display:block"><figcaption style="padding:4px 0">${label}</figcaption></figure>`).join("")}</body>`;
const strip = (frames: { src: string; p: number }[]) => `<!doctype html><meta charset="utf-8"><body style="margin:10px;background:#222;font:16px system-ui;color:#eee;display:flex;gap:6px">
  ${frames.map(({ src, p }) => `<figure style="margin:0"><img src="${fileUrl(src)}" width="384" height="${tall(384)}" style="display:block"><figcaption>p = ${p}</figcaption></figure>`).join("")}</body>`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(resolve(OUT, "rest"), { recursive: true });
await withDeck(async ({ browser, base }) => {
  const page = await openDeck(browser, base);
  rmSync(resolve("public/rest"), { recursive: true, force: true });
  mkdirSync(resolve("public/rest"), { recursive: true });
  const beats = await deckBeats(page);
  const rest: { path: string; beat: DeckBeat }[] = [];
  for (let i = 0; i < beats.length; i++) {
    await seek(page, i, 1);
    const path = resolve(OUT, "rest", `${name(i, beats[i])}.png`);
    await page.screenshot({ path });
    await page.screenshot({ path: resolve("public/rest", `${beats[i].id}.jpg`), type: "jpeg", quality: 85 });
    rest.push({ path, beat: beats[i] });
  }
  const items = rest.map(({ path, beat }, i) => ({ src: path, label: `${i + 1} · ${beat.id} · ${beat.label}` }));
  await renderHtml(browser, sheet(items), resolve(OUT, "contact.png"));
  await renderHtml(browser, sheet(items), resolve(OUT, "contact-washed.png"), { filter: WASHED });
  for (const d of DEFICIENCIES) await renderHtml(browser, sheet(items), resolve(OUT, `contact-${d}.png`), { deficiency: d });

  mkdirSync(resolve(OUT, "strips/frames"), { recursive: true });
  for (let i = 0; i < rest.length; i++) {
    if (!rest[i].beat.transition) continue; // a cut: nothing to strip
    const frames: { src: string; p: number }[] = [];
    for (let k = 0; k < STRIP; k++) {
      const p = +(k / (STRIP - 1)).toFixed(3);
      const src = resolve(OUT, `strips/frames/${name(i, rest[i].beat)}-${k}.png`);
      await seek(page, i, p);
      await page.screenshot({ path: src });
      frames.push({ src, p });
    }
    await renderHtml(browser, strip(frames), resolve(OUT, `strips/${name(i, rest[i].beat)}.png`), { width: 3160 });
  }
  rmSync(resolve(OUT, "strips/frames"), { recursive: true });
});
console.log(`shots -> ${OUT}`);
