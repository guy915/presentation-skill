// What the room sees, on every settled beat: nothing outside the safe area,
// no text under the floor, text that contrasts with the pixels behind it,
// no more words, line length or type sizes than a glance can take, no
// unfinished placeholders on screen, and canvases as sharp as the screen.
import { test, expect, type Page } from "@playwright/test";
import { open, eachBeat, jump, beats, hashOf } from "./helpers/deck";
import { pixelsAt } from "./helpers/pixels";
import { overflows, smallText, textBoxes, visibleText, typeStats, unbundledText, remoteFaces, SAFE_SHARE } from "./helpers/stage";
import { BLEED, SMALL_TEXT, LOW_CONTRAST, DENSE_TEXT } from "./allow";
import { beats as manifest, talk } from "./helpers/manifest";
import { stageSize } from "../src/runtime/manifest.ts";

const { width: W, height: H } = stageSize(talk);

const SAFE: [number, number] = [W * SAFE_SHARE, H * SAFE_SHARE]; // action-safe inset, stage px (96, 54 at 16:9)
const FLOOR = 24; // px on the 1080-line stage; a talk may raise it with --type-floor, never lower it
const MIN_CONTRAST = 4.5;
const GOOD_CONTRAST = 7;
// Ceilings for what one glance takes in (directing.md §3 and §5). Only DOM text
// on the stage counts: text a camera move has pushed off the stage, canvas and
// WebGL text, notation (pre, code, .katex: NOTATION in helpers/stage.ts) and
// text in DENSE_TEXT are not measured; credits beats are exempt. KaTeX's sub-
// and superscripts are exempt from the floor; the main size of maths is not.
const MAX_WORDS = 25; // a heading of ~6 words, one number, and a handful of one- or two-word labels
const MAX_LINE = 60; // characters per rendered line; past this the room is reading, not glancing
const MAX_SIZES = 4; // distinct type sizes per beat, as the room sees them (within 5%)

// The stage's own size, and 1024x768, a 4:3 projector (the stage letterboxes into any other shape).
for (const [width, height] of [[W, H], [1024, 768]]) {
  test(`nothing leaves the safe area at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    const found: string[] = [];
    await eachBeat(page, async (_, beat) => {
      for (const o of await overflows(page, SAFE, BLEED)) found.push(`${beat.id}: ${o.el} "${o.text}" [${o.value}]`);
    });
    expect(found).toEqual([]);
  });
}

test(`no visible text under the type floor (max of ${FLOOR}px and --type-floor)`, async ({ page }) => {
  await open(page);
  const token = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--type-floor")));
  expect(token, "--type-floor is defined").toBeGreaterThan(0);
  const floor = Math.max(FLOOR, token);
  const found: string[] = [];
  await eachBeat(page, async (_, beat) => {
    for (const o of await smallText(page, floor, SMALL_TEXT)) found.push(`${beat.id}: ${o.el} "${o.text}" ${o.value[0].toFixed(1)}px`);
  });
  expect(found).toEqual([]);
});

// The venue machine has other fonts than the build machine: a system face
// breaks lines elsewhere, and text that fit here overflows there.
// Placeholder boxes are exempt: they come before the talk picks its face.
test("every text on stage is set in a bundled face that has loaded, from files shipped with the talk", async ({ page }) => {
  await open(page);
  expect(await remoteFaces(page), "@font-face sources that are local() or remote").toEqual([]);
  const found: string[] = [];
  await eachBeat(page, async (_, beat) => {
    for (const o of await unbundledText(page)) found.push(`${beat.id}: ${o.el} "${o.text}" ${o.why}`);
  });
  expect(found).toEqual([]);
});

const glanceable = (id: string) => manifest.find((b) => b.id === id)?.kind !== "credits";

test(`at most ${MAX_WORDS} words on stage per beat`, async ({ page }) => {
  await open(page);
  const found: string[] = [];
  await eachBeat(page, async (_, beat) => {
    const { words } = await typeStats(page, DENSE_TEXT);
    if (glanceable(beat.id) && words > MAX_WORDS) found.push(`${beat.id}: ${words} words`);
  });
  expect(found).toEqual([]);
});

test(`no rendered line over ${MAX_LINE} characters`, async ({ page }) => {
  await open(page);
  const found: string[] = [];
  await eachBeat(page, async (_, beat) => {
    const { longest } = await typeStats(page, DENSE_TEXT);
    if (glanceable(beat.id) && longest && longest.chars > MAX_LINE) found.push(`${beat.id}: ${longest.el} "${longest.text}" ${longest.chars} chars`);
  });
  expect(found).toEqual([]);
});

test(`at most ${MAX_SIZES} type sizes per beat`, async ({ page }) => {
  await open(page);
  const found: string[] = [];
  await eachBeat(page, async (_, beat) => {
    const { sizes } = await typeStats(page, DENSE_TEXT);
    if (glanceable(beat.id) && sizes.length > MAX_SIZES) found.push(`${beat.id}: ${sizes.length} sizes [${sizes.join(", ")}px]`);
  });
  expect(found).toEqual([]);
});

test("no bracketed marker ([FILL …], [CONFIRM …], [TODO …]) visible on stage", async ({ page }) => {
  await open(page);
  const found: string[] = [];
  await eachBeat(page, async (_, beat) => {
    const m = (await visibleText(page)).match(/\[[A-Z]{2,}\b[^\]]*\]?/g);
    if (m) found.push(`${beat.id}: ${m.join(", ")}`);
  });
  expect(found).toEqual([]);
});

/** Contrast of each visible text against the pixels actually behind it:
 *  hide all text, screenshot, sample a grid inside each line box, and take
 *  the worst sample. */
async function contrast(page: Page) {
  const boxes = await textBoxes(page, LOW_CONTRAST);
  if (!boxes.length) return [];
  const style = await page.addStyleTag({
    content: "#stage, #stage * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }",
  });
  const png = await page.screenshot();
  await style.evaluate((s) => (s as Element).remove());
  // a 5x3 grid inside each line box
  const grid = (b: (typeof boxes)[number]) => b.rects.flatMap(([x, y, w, h]) => [0, 1, 2, 3, 4].flatMap((i) => [0, 1, 2].map((j) => [x + ((i + 0.5) * w) / 5, y + ((j + 0.5) * h) / 3])));
  const behind = await pixelsAt(page, png, boxes.flatMap(grid));
  const lum = ([r, g, b]: number[]) => {
    const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  return boxes.map((b) => {
    let worst = Infinity;
    for (const px of behind.splice(0, grid(b).length)) {
      const a = b.color[3];
      const fg = [0, 1, 2].map((k) => a * b.color[k] + (1 - a) * px[k]); // text as composited over this pixel
      const [l1, l2] = [lum(fg), lum(px)].sort((p, q) => q - p);
      worst = Math.min(worst, (l1 + 0.05) / (l2 + 0.05));
    }
    return { el: b.el, text: b.text, ratio: worst };
  });
}

test(`text contrasts with what is behind it (>= ${MIN_CONTRAST}:1, warns under ${GOOD_CONTRAST}:1)`, async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  const failed: string[] = [];
  await eachBeat(page, async (_, beat) => {
    for (const r of await contrast(page)) {
      const line = `${beat.id}: ${r.el} "${r.text}" ${r.ratio.toFixed(2)}:1`;
      if (r.ratio < MIN_CONTRAST) failed.push(line);
      else if (r.ratio < GOOD_CONTRAST) test.info().annotations.push({ type: "warning", description: `contrast under ${GOOD_CONTRAST}:1 ${line}` });
    }
  });
  for (const a of test.info().annotations) console.warn(a.description);
  expect(failed).toEqual([]);
});

// A canvas's backing store covers the pixels it takes on screen: at 4K, and
// after the window moves to another display (a resize).
/** Visible canvases on the present beat whose backing store is smaller than their size on screen, in device px. */
const soft = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLCanvasElement>("#stage > .slides > section.present canvas")]
      .filter((c) => c.checkVisibility({ visibilityProperty: true, opacityProperty: true }))
      .map((c) => {
        const r = c.getBoundingClientRect();
        const need = [r.width * devicePixelRatio, r.height * devicePixelRatio].map(Math.floor);
        return c.width + 1 < need[0] || c.height + 1 < need[1] ? `canvas.${c.className} ${c.width}x${c.height} < ${need.join("x")}` : "";
      })
      .filter(Boolean),
  );

test("every visible canvas is sharp at twice the stage (a 4K screen)", async ({ page }) => {
  await page.setViewportSize({ width: 2 * W, height: 2 * H });
  await open(page);
  const found: string[] = [];
  await eachBeat(page, async (_, beat) => {
    for (const s of await soft(page)) found.push(`${beat.id}: ${s}`);
  });
  expect(found).toEqual([]);
});

/** The visible canvases on the present beat, each named by its classes and
 *  place among the beat's canvases, and whether any of its pixels is painted. */
const canvases = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLCanvasElement>("#stage > .slides > section.present canvas")].flatMap((c, k) => {
      if (!c.checkVisibility({ visibilityProperty: true, opacityProperty: true })) return [];
      let painted = false;
      if (c.width && c.height) {
        const g = new OffscreenCanvas(c.width, c.height).getContext("2d")!;
        g.drawImage(c, 0, 0);
        painted = g.getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v > 0);
      }
      return [{ name: `canvas${[...c.classList].map((x) => "." + x).join("")} (canvas ${k + 1} of the beat)`, painted }];
    }),
  );

test("moved to a 4K display, a canvas resizes its backing store and is drawn again", async ({ page }) => {
  await open(page);
  const list = await beats(page);
  // the first beat whose canvas is drawn at rest in a cold load; a canvas blank there is blank by design
  let at = -1;
  let drawn: string[] = [];
  for (let i = 0; i < list.length && at < 0; i++) {
    await jump(page, i);
    if (!(await canvases(page)).length) continue;
    await open(page, `/${hashOf(list, i)}`);
    drawn = (await canvases(page)).filter((c) => c.painted).map((c) => c.name);
    if (drawn.length) at = i;
  }
  test.skip(at < 0, "no beat shows a canvas drawn at rest");
  const id = list[at].id;
  await page.setViewportSize({ width: 2 * W, height: 2 * H });
  await expect.poll(() => page.evaluate(() => document.getElementById("stage")!.getBoundingClientRect().height)).toBe(2 * H); // refit
  await expect.poll(() => soft(page), { message: `${id}: a canvas kept a backing store smaller than its size on a 4K screen` }).toEqual([]);
  // drawn again, not cleared by the resize: some pixel is painted
  const blank = async () => (await canvases(page)).filter((c) => drawn.includes(c.name) && !c.painted).map((c) => c.name);
  await expect.poll(blank, { message: `${id}: a canvas drawn at rest stayed blank after the move to a 4K screen` }).toEqual([]);
});
