// The talk suite's checks, checked: each catches what it should and passes
// what it should, on made-up input or on probes put on the first beat.
import { test, expect } from "@playwright/test";
import { open, jump, snapshot } from "../helpers/deck";
import { leaks } from "../helpers/notes";
import { verdict } from "../helpers/motion";
import { inject, overflows, smallText, textBoxes, typeStats, unbundledText } from "../helpers/stage";
import { BLEED } from "../allow";
import { beats as manifest } from "../helpers/manifest";

test.describe("notes: build history", () => {
  const repo = { tags: ["dress-rehearsal"], commits: ["a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"] };

  test("legitimate script lines pass", () => {
    const legit = [
      "We pinned Python 3.12.1 and pandas 2.2.0.",
      "It shipped in iOS 26.1.2, and issue #412 tracks the rest.",
      "He was committed to the village school for forty years.",
      "PR #88 on their repo added the flag. [TODO confirm the number]",
      "Round the corner, past gate B, the version of events changes.",
    ];
    expect(legit.flatMap((l) => leaks(l, repo))).toEqual([]);
  });

  test("build history is caught, and a phrase in the allow list is exempt", () => {
    const history = [
      "This is v2 of this slide.",
      "The second draft of this beat was longer.",
      "Since gate 1 the chart is smaller.",
      "Critique round 3 flagged the colours.",
      "As ADR-0003 records, we cut it.",
      "The changelog has the details.",
      "See PROGRESS.md for why.",
      "Fixed in a1b2c3d, the lobby moved.",
      "Back at dress-rehearsal the title was red.",
    ];
    expect(history.filter((l) => leaks(l, repo).length === 0)).toEqual([]);
    expect(leaks("Boarding at gate 12 closes early.", repo, { "gate 12": "the airport's gate, not a build gate" })).toEqual([]);
  });
});

test.describe("what the room sees", () => {
  test.beforeEach(async ({ page }) => open(page));

  test("the face check catches a character no bundled face covers, and passes it once one does or it is notation", async ({ page }) => {
    const css = "position:absolute;left:200px;top:600px;font-size:40px";
    const flagged = async () => (await unbundledText(page)).filter((f) => f.el.startsWith("p.probe-text") || f.el.startsWith("code"));
    await inject(page, `<p class="probe-text">rate λ ≈ k₂</p>`, css); // the Latin subsets hold none of λ, ≈, ₂
    const [miss] = await flagged();
    expect(miss?.why, "λ, ≈ and ₂ fall through to a system font").toMatch(/U\+03BB.*U\+2248.*U\+2082/);
    await inject(page, `<p class="probe-text">rate k</p><code style="font-family: inherit">λ ≈ k₂</code>`, css); // notation: its own faces
    expect(await flagged()).toEqual([]);
    // a bundled face whose unicode-range covers them, next in the stack
    await page.evaluate(async () => {
      // any file the talk bundles will do: the browser trusts unicode-range
      const [url] = [...document.styleSheets].flatMap((s) =>
        [...s.cssRules].flatMap((r) => (r instanceof CSSFontFaceRule ? [new URL(r.style.getPropertyValue("src").match(/url\(["']?([^"')]+)/)![1], s.href ?? location.href).href] : [])),
      );
      const face = new FontFace("Probe Symbols", `url(${url})`, { unicodeRange: "U+03BB, U+2248, U+2080-209C" });
      document.fonts.add(await face.load());
    });
    const text = (await page.evaluate(() => getComputedStyle(document.getElementById("stage")!).fontFamily)).split(",")[0];
    await inject(page, `<p class="probe-text" style="font-family: ${text.replaceAll('"', "'")}, 'Probe Symbols'">rate λ ≈ k₂</p>`, css);
    expect((await flagged()).map((f) => f.why)).toEqual([]);
  });

  test("the face check exempts placeholder boxes, which come before the talk picks its face, and holds every other text to a bundled one", async ({ page }) => {
    const fallback = "font-family: system-ui, sans-serif"; // what --font-text falls back to before src/theme.css sets it
    await inject(page, `<p class="probe-text" style="${fallback}">Finished text</p><div class="rt-placeholder" style="width:800px;height:200px;${fallback}">Placeholder</div>`, "position:absolute;left:200px;top:600px");
    const flagged = (await unbundledText(page)).filter((f) => f.el.startsWith("p.probe-text") || f.el.startsWith("div.rt-placeholder"));
    expect(flagged.map((f) => f.el)).toEqual(["p.probe-text"]);
    expect(flagged[0].why).toMatch(/system-ui \(generic\)/);
  });

  test("the safe-area check skips boxes with zero width or height (KaTeX's struts)", async ({ page }) => {
    const outside = (w: number, h: number) => inject(page, "", `position:absolute;left:20px;top:1060px;width:${w}px;height:${h}px;background:#000`);
    const probes = async () => (await overflows(page, [96, 54], {})).filter((o) => o.el === "div.probe");
    await outside(10, 10);
    expect(await probes(), "a painted box outside the safe area").toHaveLength(1);
    await outside(10, 0);
    expect(await probes()).toEqual([]);
    await outside(0, 10);
    expect(await probes()).toEqual([]);
  });

  test("the safe-area check skips grounds: a textless box over the whole stage, or one with the class ground; everything else stays strict", async ({ page }) => {
    const { width: W, height: H } = await page.evaluate(() => (window as any).__deck.stage);
    const flagged = async (html: string) => {
      await inject(page, html, "position:absolute;left:0;top:0");
      return (await overflows(page, [96, 54], {})).filter((o) => o.el.includes("probe-")).map((o) => o.el);
    };
    const at = (cls: string, css: string, inner = "") => `<div class="${cls}" style="position:absolute;background:#123;${css}">${inner}</div>`;
    const full = `left:0;top:0;width:${W}px;height:${H}px`;
    expect(await flagged(at("probe-full", full))).toEqual([]); // a section ground
    expect(await flagged(at("probe-over", `left:-40px;top:-20px;width:${W + 80}px;height:${H + 40}px`))).toEqual([]); // a photo that overscans
    expect(await flagged(at("probe-part", `left:-40px;top:0;width:600px;height:${H}px`))).toEqual(["div.probe-part"]); // bleeds, not full-stage
    expect(await flagged(at("probe-part ground", `left:-40px;top:0;width:600px;height:${H}px`))).toEqual([]);
    expect(await flagged(at("probe-said", full, "A title on the ground"))).toEqual(["div.probe-said"]); // text of its own
    expect(await flagged(at("probe-said ground", `left:-40px;top:0;width:600px;height:${H}px`, "Text"))).toEqual(["div.probe-said.ground"]);
    expect(await flagged(at("probe-full", full, at("probe-inner", "left:20px;top:20px;width:200px;height:200px")))).toEqual(["div.probe-inner"]); // what a ground holds is checked
  });

  test("a clip exempt from the safe area (BLEED, by its own class) takes its poster with it", async ({ page }) => {
    const clip = manifest.findIndex((b) => b.assets?.some((a) => /\.(mp4|webm)$/.test(a)));
    test.skip(clip < 1, "the fixture talk has no clip after its first beat");
    const src = manifest[clip].assets!.find((a) => /\.(mp4|webm)$/.test(a))!;
    await jump(page, clip - 1);
    // the clip made full-bleed and visible, resting on its poster
    await page.evaluate((src) => {
      const v = document.querySelector(`video[src$="${src}"]`) as HTMLVideoElement;
      v.classList.add("probe-bleed");
      Object.assign(v.style, { left: "0px", top: "0px", width: "100%", height: "100%", opacity: "1", visibility: "visible" });
    }, src);
    await page.evaluate((i) => ((window as any).__deck.seek(i, 1), (window as any).__deck.settled()), clip - 1);
    const found = await overflows(page, [96, 54], { ...BLEED, ".probe-bleed": "full-bleed by design" });
    expect(found.map((f) => f.el)).toEqual([]);
  });

  // Notation is content, not a glance: code (pre, code) and typeset maths
  // (.katex) are exempt from the word, line-length and type-size ceilings. The
  // floor holds for the main size of maths, not for its sub- and superscripts.
  const katex = (px: number) =>
    `<span class="katex" style="font-size:${px}px"><span class="katex-mathml">x squared as MathML for screen readers</span>` +
    `<span class="katex-html"><span class="base"><span class="mord">x</span><span class="msupsub"><span class="sizing" style="font-size:${Math.round(px * 0.7)}px">2</span></span></span></span></span>`;
  const box = "position:absolute;left:200px;top:200px;width:1400px;font-size:32px;color:#111;background:#fff";

  test("code blocks, inline code and maths don't count against the glance ceilings", async ({ page }) => {
    const before = await typeStats(page, {});
    const words = Array.from({ length: 40 }, (_, i) => `token${i}`).join(" ");
    await inject(page, `<pre style="font-size:28px;white-space:pre-wrap">${words}</pre><p>Run <code style="font-size:22px">${words}</code></p>${katex(40)}`, box);
    const after = await typeStats(page, {});
    expect(after.words, "words: only the one plain word, Run").toBe(before.words + 1);
    expect(after.longest?.chars ?? 0, "line length").toBeLessThanOrEqual(Math.max(before.longest?.chars ?? 0, 3));
    expect(after.sizes.length, "type sizes: only the paragraph's").toBeLessThanOrEqual(before.sizes.length + 1);
  });

  test("the type floor holds for the main size of maths, not for its sub- and superscripts; its screen-reader MathML is not text on stage", async ({ page }) => {
    await inject(page, `<div class="big">${katex(40)}</div><div class="small">${katex(20)}</div>`, box);
    const small = (await smallText(page, 24, {})).map((f) => `${f.el} ${f.text} ${f.value[0]}`);
    expect(small.filter((s) => s.includes("sizing")), "a 28 px superscript under a 40 px base").toEqual([]);
    expect(small.some((s) => /mord.* x 20/.test(s)), `maths at 20 px is under the floor: ${JSON.stringify(small)}`).toBe(true);
    expect(small.filter((s) => s.includes("katex-mathml"))).toEqual([]);
    expect((await textBoxes(page, {})).filter((b) => b.el.includes("katex-mathml"))).toEqual([]);
  });

  test("snapshot reads a WebGL canvas without crashing, and never claims a context on an untouched one", async ({ page }) => {
    await inject(page, `<canvas class="probe-gl"></canvas><canvas class="probe-blank"></canvas>`);
    await page.evaluate(() => {
      const ctx = document.querySelector<HTMLCanvasElement>(".probe-gl")!.getContext("webgl")!;
      ctx.clearColor(0, 0.5, 0, 1);
      ctx.clear(ctx.COLOR_BUFFER_BIT);
    });
    expect((await snapshot(page)).dom).toContain("probe-gl");
    expect(await page.evaluate(() => !!document.querySelector<HTMLCanvasElement>(".probe-blank")!.getContext("webgl")), "the untouched canvas still takes WebGL").toBe(true);
  });
});

test("the motion bar: unthrottled, long frames fail; throttled, only stalls do", () => {
  const at = (ms: number, n: number) => Array(n).fill(ms);
  const plain = { throttled: false, frame: 16.7 };
  const slow = { throttled: true, frame: 16.7 };
  // a 24 Hz display (4K over old HDMI): every frame 41.7 ms is the display's pace, not a long frame
  expect(verdict(at(41.7, 60), { ...plain, frame: 41.7 })).toBeNull();
  expect(verdict([...at(41.7, 80), ...at(83.3, 20)], { ...plain, frame: 41.7 })).toBe("long frames");
  // 120 Hz: a frame that misses a vsync is long at 12.5 ms
  expect(verdict([...at(8.3, 80), ...at(16.7, 20)], { ...plain, frame: 8.3 })).toBe("long frames");
  expect(verdict([...at(16.7, 90), ...at(33, 10)], plain)).toBeNull();
  expect(verdict([...at(16.7, 84), ...at(35, 16)], plain)).toBe("long frames");
  expect(verdict([...at(16.7, 99), 120], plain)).toBe("stall");
  // 4x throttled: long frames pass, a stall still fails
  expect(verdict([...at(16.7, 84), ...at(35, 16)], slow)).toBeNull();
  expect(verdict(at(60, 30), slow)).toBeNull();
  expect(verdict([...at(16.7, 99), 120], slow)).toBe("stall");
});
