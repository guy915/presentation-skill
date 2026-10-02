// The stage fills any window, letterboxed and centred on whole pixels, and
// refits on resize; the bars beside it take its ground colour; nothing paints
// before the deck is ready. The fit cases pin a 16:9 stage (?aspect=16:9), so
// they hold for a talk of any shape.
import { test, expect, devices, type Page } from "@playwright/test";
import { open, hashOf } from "./helpers/deck";
import { pixelsAt } from "./helpers/pixels";

const rect = (page: Page) =>
  page.evaluate(() => {
    const r = document.getElementById("stage")!.getBoundingClientRect();
    return [r.left, r.top, r.width, r.height].map((v) => Math.round(v) + 0); // +0: no -0
  });

test("fits any window, letterboxed or pillarboxed, on whole pixels, and refits on resize", async ({ page }) => {
  await open(page, "/?aspect=16:9");
  for (const [w, h, expected] of [
    [1920, 1080, [0, 0, 1920, 1080]],
    [1280, 720, [0, 0, 1280, 720]],
    [1000, 1000, [0, 219, 1000, 563]], // letterboxed top and bottom
    [2000, 900, [200, 0, 1600, 900]], // pillarboxed left and right
    [1024, 768, [0, 96, 1024, 576]], // a 4:3 projector
    [1280, 800, [0, 40, 1280, 720]], // 16:10, a MacBook's shape
    [960, 540, [0, 0, 960, 540]],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await expect.poll(() => rect(page), `${w}x${h}`).toEqual(expected);
  }
  // centring gives a 0.25 px offset here: a fractional offset blurs every line of text
  await page.setViewportSize({ width: 1000, height: 563 });
  await expect.poll(() => rect(page)).toEqual([0, 0, 1000, 563]);
  const t = await page.evaluate(() => document.getElementById("stage")!.style.transform);
  const [x, y] = t.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/)!.slice(1).map(Number);
  expect([x, y], t).toEqual([Math.round(x), Math.round(y)]);
});

test("the bars beside the stage take its ground colour, not black", async ({ page }) => {
  await open(page, "/?aspect=16:9");
  /** A pixel in the bar, and the stage's own ground, as rgb(). */
  const bar = async (x: number, y: number) => {
    const [[r, g, b]] = await pixelsAt(page, await page.screenshot(), [[x, y]]);
    return { bar: `rgb(${r}, ${g}, ${b})`, ground: await page.evaluate(() => getComputedStyle(document.getElementById("stage")!).backgroundColor) };
  };
  const cases = [
    [1024, 768, 512, 20], // letterbox: the bar above
    [1280, 800, 640, 10],
    [2000, 900, 50, 450], // pillarbox: the bar to the left
  ] as const;
  for (const [w, h, x, y] of cases) {
    await page.setViewportSize({ width: w, height: h });
    const plain = await bar(x, y);
    expect(plain.bar, `${w}x${h}`).toBe(plain.ground);
  }
  // a talk that sets its ground gets bars to match
  await page.addStyleTag({ content: ":root { --ground: rgb(20, 60, 110); }" });
  for (const [w, h, x, y] of cases) {
    await page.setViewportSize({ width: w, height: h });
    expect(await bar(x, y), `${w}x${h}`).toEqual({ bar: "rgb(20, 60, 110)", ground: "rgb(20, 60, 110)" });
  }
});

// talk.aspect: a talk for a 4:3 projector or a 21:9 LED wall is designed at
// its own shape. ?aspect= overrides the manifest (a test knob).
test("?aspect= sets the stage's shape: 1080 lines, the width from the aspect", async ({ page }) => {
  for (const [aspect, size, fits] of [
    ["4:3", [1440, 1080], [[1024, 768, [0, 0, 1024, 768]]]], // fills a 4:3 projector: no bars
    ["21:9", [2520, 1080], [[2520, 1080, [0, 0, 2520, 1080]], [1920, 1080, [0, 129, 1920, 823]]]], // on a 16:9 screen, letterboxed
  ] as const) {
    await open(page, `/?aspect=${aspect}`);
    expect(await page.evaluate(() => (window as any).__deck.stage)).toEqual({ width: size[0], height: size[1] });
    for (const [w, h, expected] of fits) {
      await page.setViewportSize({ width: w, height: h });
      await expect.poll(() => rect(page), `${aspect} at ${w}x${h}`).toEqual(expected);
    }
  }
});

// A phone in landscape: the window's size settles after the first script runs
// (the visual viewport, the URL bar), so a fit taken once on load is stale.
test("a phone in landscape fits on load as it does after a resize", async ({ browser }) => {
  const { defaultBrowserType: _, ...phone } = devices["iPhone 13 landscape"];
  const context = await browser.newContext(phone);
  const page = await context.newPage();
  await open(page, "/?aspect=16:9");
  const transform = () => page.evaluate(() => document.getElementById("stage")!.style.transform);
  const onLoad = await transform();
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  expect(onLoad).toBe(await transform());
  await context.close();
});

/** In-page probe: anything visible under #stage before __deck is set
 *  (__leaked), and whether __deck is set when #stage's opacity becomes 1
 *  (__shownBefore). The style's opacity, an own property in Chrome, becomes an
 *  accessor as soon as the parser inserts #stage. */
function watchLoad() {
  const w = window as any;
  w.__leaked = false;
  const check = () => {
    const stage = document.getElementById("stage");
    const ready = !!w.__deck;
    if (
      stage && !ready && getComputedStyle(stage).opacity !== "0" &&
      [...stage.querySelectorAll("*")].some((e) => getComputedStyle(e).visibility === "visible" && e.getBoundingClientRect().width > 0)
    ) w.__leaked = true;
    if (!ready) requestAnimationFrame(check);
  };
  const hook = () => {
    const style = document.getElementById("stage")?.style;
    if (!style || w.__hooked) return;
    Object.defineProperty(style, "opacity", {
      configurable: true,
      get: () => style.getPropertyValue("opacity"),
      set(v: string) {
        if (String(v) === "1") w.__shownBefore = !w.__deck;
        style.setProperty("opacity", v);
      },
    });
    w.__hooked = true;
  };
  requestAnimationFrame(check);
  new MutationObserver(() => (check(), hook())).observe(document, { subtree: true, childList: true, attributes: true });
}

test("nothing under #stage paints before the deck is ready, and __deck exists before the stage shows: a plain load, a cold load deep into the talk, a warm second tab", async ({ page, context }) => {
  const cold = await context.browser()!.newPage(); // its own context: nothing cached
  let deep = "/";
  for (const [p, at] of [[page, "plain"], [cold, "deep"], [await context.newPage(), "deep"]] as const) {
    await p.addInitScript(watchLoad);
    await p.goto(at === "plain" ? "/" : deep);
    await p.waitForFunction(() => (window as any).__deck && getComputedStyle(document.getElementById("stage")!).opacity === "1");
    expect(await p.evaluate(() => (window as any).__leaked), `flash at ${at}`).toBe(false);
    expect(await p.evaluate(() => (window as any).__hooked), "opacity setter hooked").toBe(true);
    expect(await p.evaluate(() => (window as any).__shownBefore), `shown before __deck was set, at ${at}`).toBe(false);
    if (at === "plain") {
      const list = await p.evaluate(() => (window as any).__deck.beats);
      if (list.length) deep = `/${hashOf(list, list.length - 1)}`; // an empty talk: its plain load again
    }
  }
  await cold.close();
});
