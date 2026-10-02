// npm run handout [-- --no-notes] [--base <url>]: the talk as one PDF to share
// after it (a course page, an email).
//   out/handout.pdf   each content beat in order: its rest frame, its cue as a
//                     heading and its script as text (printed() in manifest.ts:
//                     no brackets); the credits frames last. Two beats to an A4
//                     landscape page, side by side.
// --no-notes: the frames only, one to a page. --base drives a deck already
// served there (the test does).
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { withDeck, openDeck, seek, fileUrl, htmlPdf, STAGE } from "./lib/deck.ts";
import { cue, printed } from "../src/runtime/manifest.ts";
import { beats, talk } from "./lib/talk.ts";

const OUT = resolve("out/handout");
const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ENTITIES[c]);

const { values: o } = parseArgs({ options: { base: { type: "string" }, "no-notes": { type: "boolean" } } });
const notes = !o["no-notes"];
const kind = (i: number) => beats[i].kind ?? "content";
const order = [...beats.keys()].filter((i) => kind(i) === "content").concat([...beats.keys()].filter((i) => kind(i) === "credits"));
const perPage = notes ? 2 : 1;

const style = `@page { size: A4 landscape; margin: 0 }
  body { margin: 0; color: #1b1b1b; font: 10.5pt/1.45 system-ui, sans-serif }
  .page { box-sizing: border-box; width: 297mm; height: 210mm; padding: 14mm; overflow: hidden; display: grid; grid-template-columns: repeat(${perPage}, minmax(0, 1fr)); gap: 12mm; align-items: start }
  .page + .page { break-before: page }
  img { display: block; width: 100%; aspect-ratio: ${STAGE.width} / ${STAGE.height}; border: 0.3mm solid #ccc; border-radius: 1.5mm }
  .frames img { height: 182mm; object-fit: contain; border: 0 }
  h2 { margin: 5mm 0 2mm; font-size: 13pt; line-height: 1.25 }
  p { margin: 0 0 2mm }`;

const item = (i: number, src: string) =>
  `<article><img src="${fileUrl(src)}">${notes && kind(i) === "content" ? `<h2>${esc(cue(beats[i].notes))}</h2>${printed(beats[i].notes).map((p) => `<p>${esc(p)}</p>`).join("")}` : ""}</article>`;

rmSync(OUT, { recursive: true, force: true });
rmSync(`${OUT}.pdf`, { force: true });
mkdirSync(OUT, { recursive: true });
await withDeck(
  async ({ browser, base }) => {
    const page = await openDeck(browser, base);
    const items: string[] = [];
    for (const i of order) {
      const src = resolve(OUT, `${String(i + 1).padStart(2, "0")}-${beats[i].id}.jpg`);
      await seek(page, i, 1);
      await page.screenshot({ path: src, type: "jpeg", quality: 85 });
      items.push(item(i, src));
    }
    const pages = [];
    for (let k = 0; k < items.length; k += perPage) pages.push(`<section class="page">${items.slice(k, k + perPage).join("")}</section>`);
    const html = `<!doctype html><html lang="${talk.lang ?? "en"}"><meta charset="utf-8"><style>${style}</style><body class="${notes ? "notes" : "frames"}">${pages.join("")}</body>`;
    await htmlPdf(browser, html, `${OUT}.pdf`, { width: 1123, height: 794 }, { preferCSSPageSize: true });
  },
  { base: o.base },
);
rmSync(OUT, { recursive: true });
console.log(`handout -> ${OUT}.pdf`);
