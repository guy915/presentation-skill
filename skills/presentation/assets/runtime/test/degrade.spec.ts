// The talk degrades, never breaks. A beat's fallback (a still image) shows
// when its section is forced (?fallback=<id>|<section>|all). A section whose code
// fails (?break=<section>:mount|ready|render) shows each beat's fallback (or
// its rest still, or its `sees` text), and the deck still advances. With the
// OS asking for reduced motion the talk still plays: transitions run, gentler
// where a section chose a gentler variant, and clips play.
import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { open, settled, index, jump, beats, fallbacksShown, firstPlayed } from "./helpers/deck";
import { beats as manifest, needs } from "./helpers/manifest";

const withFallback = manifest.findIndex((b) => b.fallback);

test.describe("fallbacks", () => {
  test.beforeEach(() => test.skip(withFallback < 0, "no beat declares a fallback"));

  test("?fallback=all, =<section> and =<id> show the still; without it, the live scene shows", async ({ page }) => {
    const b = manifest[Math.max(0, withFallback)];
    for (const q of ["all", b.section, b.id]) {
      await open(page, `/?fallback=${q}`);
      await jump(page, withFallback);
      expect(await fallbacksShown(page), q).toBe(1);
    }
    await open(page);
    await jump(page, withFallback);
    expect(await fallbacksShown(page)).toBe(0);
  });

  test("a degraded section stops rendering its live scene while its fallback shows", async ({ page }) => {
    // a fallback beat after a beat of the same section
    const k = manifest.findIndex((b, k) => b.fallback && k > 0 && manifest[k - 1].section === b.section);
    test.skip(k < 0, "no fallback beat follows a beat of its own section");
    // every draw call into a 2D or WebGL canvas, counted
    await page.addInitScript(() => {
      (window as any).__draws = 0;
      const count = (proto: any, names: string[]) => {
        for (const n of names) {
          const f = proto?.[n];
          if (f) proto[n] = function (this: unknown, ...a: unknown[]) { (window as any).__draws++; return f.apply(this, a); };
        }
      };
      count(CanvasRenderingContext2D.prototype, ["clearRect", "fillRect", "strokeRect", "fill", "stroke", "drawImage", "fillText", "putImageData"]);
      for (const gl of [(window as any).WebGLRenderingContext, (window as any).WebGL2RenderingContext]) count(gl?.prototype, ["clear", "drawArrays", "drawElements"]);
    });
    await open(page, `/?fallback=${manifest[k].section}`);
    await jump(page, k - 1);
    await page.evaluate(() => ((window as any).__draws = 0));
    await page.keyboard.press("PageDown");
    await settled(page);
    expect(await fallbacksShown(page)).toBe(1);
    expect(await page.evaluate(() => (window as any).__draws), "draw calls under the fallback").toBe(0);
  });
});

test.describe("a section whose code fails", () => {
  async function load(page: Page, knob: string) {
    await page.goto(`/?break=${knob}`);
    await page.waitForFunction(() => (window as any).__deck, null, { timeout: 15_000 });
    await settled(page);
  }

  test("failing in mount or in ready, it shows its stand-ins, and the talk goes on", async ({ page }) => {
    needs(1);
    const section = manifest[0].section;
    for (const how of ["mount", "ready"]) {
      await load(page, `${section}:${how}`);
      expect(await page.evaluate(() => getComputedStyle(document.getElementById("stage")!).opacity), how).toBe("1");
      for (const [i, b] of manifest.entries()) {
        if (b.section !== section) continue;
        await jump(page, i);
        expect(await fallbacksShown(page), `${how}: beat ${i}`).toBeGreaterThan(0);
      }
    }
  });

  test("a render that throws mid-transition swaps in the stand-ins, and the next click still advances", async ({ page }) => {
    await open(page);
    const k = firstPlayed(await beats(page), 0.01, { beforeLast: true });
    test.skip(k < 0, "no beat before the last has a played transition");
    await load(page, `${manifest[k].section}:render`);
    await jump(page, k - 1);
    await page.keyboard.press("PageDown"); // played: the knob throws in the live render
    await settled(page);
    expect(await fallbacksShown(page)).toBeGreaterThan(0);
    await page.keyboard.press("PageDown");
    await settled(page);
    expect(await index(page)).toBe(k + 1);
  });
});

// Reduced motion: Windows' "Show animations" off, common on managed lecture-hall PCs.
test.describe("with reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  /** Distinct pictures the page puts on screen while `fn` runs, until the deck
   *  settles. The screencast is the composited output, so DOM, canvas and WebGL
   *  motion all count (the section's markup alone misses a pure-canvas beat). */
  async function frames(page: Page, fn: () => Promise<void>) {
    const seen = new Set<string>();
    await page.screencast.start({ size: { width: 480, height: 480 }, onFrame: async ({ data }) => void seen.add(createHash("sha1").update(data).digest("hex")) });
    try {
      await fn();
      await settled(page);
    } finally {
      await page.screencast.stop();
    }
    return seen.size;
  }

  test("the talk says so, and every played transition shows in-between pictures, not a cut", async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => document.documentElement.dataset.motion)).toBe("reduced");
    const list = await beats(page);
    const played = list.flatMap((b, k) => (k > 0 && b.transition >= 0.3 && !manifest[k].assets?.length ? [k] : []));
    test.skip(!played.length, "no beat has a played transition of 0.3 s or more");
    const cuts: string[] = [];
    for (const i of played) {
      await jump(page, i - 1);
      const distinct = await frames(page, () => page.keyboard.press("PageDown"));
      expect(await index(page)).toBe(i);
      if (distinct <= 3) cuts.push(`${list[i].id}: ${distinct} distinct pictures`);
    }
    expect(cuts, "beats that looked like a cut").toEqual([]);
  });

  test("clips play forward", async ({ page }) => {
    const clip = manifest.findIndex((b) => b.assets?.some((a) => /\.(mp4|webm)$/.test(a)));
    test.skip(clip < 1, "no beat after the first has a clip");
    const src = manifest[clip].assets!.find((a) => /\.(mp4|webm)$/.test(a))!;
    await open(page);
    await jump(page, clip - 1);
    await page.keyboard.press("PageDown");
    const playing = () =>
      page.evaluate((src) => {
        const v = document.querySelector(`video[src$="${src}"]`) as HTMLVideoElement;
        return !v.paused && v.currentTime > 0.1;
      }, src);
    await expect.poll(playing, { timeout: 5000 }).toBe(true);
  });
});
