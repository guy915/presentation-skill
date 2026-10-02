// The speaker view and the clock on a talk shaped like a real one
// (test/fixtures/talk-demo.ts), built once: the talk strip, the click pills,
// the pace ahead of plan, a clock that waits through the lobby, and <html lang>
// written by the build. Also the pure rules behind them, and the script's fit.
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { open, settled, index, speakerView, tell } from "../helpers/deck";
import { buildFixture, serveBuild, FIXTURE } from "../helpers/fixture-build";
import { talk } from "../helpers/manifest";
import { seconds, previewMode, segments, pace, sectionName, sectionRuns, AHEAD_S } from "../../src/runtime/manifest.ts";
import { beats as demo, talk as demoTalk } from "../fixtures/talk-demo.ts";

const DEMO = resolve("out/test/demo");
test.beforeAll(() => buildFixture("test/fixtures/talk-demo.ts", DEMO));

/** The demo deck, settled, at `query`. */
async function demoDeck(page: Page, query = "?fallback=all") {
  await serveBuild(page.context(), DEMO);
  await open(page, `${FIXTURE}${query}`);
}
/** The speaker view, once the deck has told it where it is. */
async function viewOf(deck: Page) {
  const view = await speakerView(deck);
  await expect(view.locator("#label")).not.toBeEmpty();
  return view;
}
/** A token's colour as the browser computes it. */
const colourOf = (view: Page, name: string) =>
  view.evaluate((n) => {
    const probe = document.createElement("i");
    probe.style.color = `var(${n})`;
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, name);
const at = (id: string) => demo.findIndex((b) => b.id === id);

test("the rules: pace, preview mode, section names and runs, script segments", () => {
  expect(pace(0, 0, 10, 600, false).state).toBe("idle");
  expect(pace(5, 0, 10, 600, true).state).toBe("on");
  expect(pace(11, 0, 10, 600, true)).toEqual({ state: "behind", by: 1 });
  expect(pace(100, 170, 200, 600, true)).toEqual({ state: "ahead", by: AHEAD_S + 10 });
  expect(pace(120, 170, 200, 600, true).state).toBe("on"); // 50 s early: on plan
  expect(pace(601, 0, 10, 600, true).state).toBe("over");
  // a heavy section previews as a still by default; ?preview= overrides
  const t = { ...talk, heavy: ["globe"] };
  expect(previewMode("globe", t, null)).toBe("still");
  expect(previewMode("globe", t, "live")).toBe("live");
  expect(previewMode("intro", t, null)).toBe("live");
  expect(previewMode("intro", t, "still")).toBe("still");
  // talk.sections, else the id in sentence case
  expect(sectionName("alpha", demoTalk)).toBe("Section alpha");
  expect(sectionName("second-part", demoTalk)).toBe("Second part");
  expect(sectionName("try_it_now")).toBe("Try it now");
  expect(sectionRuns(demo, demoTalk.wpm).map((r) => r.section)).toEqual(["lobby", "opening", "second-part", "alpha", "beta", "gamma", "close", "credits"]);
  const kinds = segments("One [FILL year] two [CONFIRM source] [TODO number] [pause] three [click]").filter((s) => s.kind !== "say");
  expect(kinds.map((s) => s.kind)).toEqual(["mark", "mark", "mark", "dir", "click"]);
});

test("the script never scrolls: a long beat shrinks to fit, down to 28 px, and further only as a last resort", async ({ page }) => {
  await open(page);
  const presenter = await speakerView(page, true);
  await presenter.setViewportSize({ width: 1280, height: 800 });
  const box = presenter.locator("#now");
  const size = () => presenter.locator("#notes").evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  const fits = () => box.evaluate((e) => e.scrollHeight <= e.clientHeight + 1);
  const full = await size();
  expect(await box.evaluate((e) => getComputedStyle(e).overflowY)).toBe("hidden");
  const script = async (n: number) =>
    presenter.evaluate((n) => {
      document.getElementById("notes")!.textContent = "A long line of script for this beat. ".repeat(n);
      (window as any).__presenter.fit();
    }, n);
  await script(12); // about 90 words: smaller, at or above the floor, and all of it on screen
  await expect.poll(fits).toBe(true);
  expect(await size()).toBeLessThan(full);
  expect(await size()).toBeGreaterThanOrEqual(28);
  await expect(box).not.toHaveClass(/is-tight/);
  await script(24); // far too long: it still fits, below the floor, and says so
  await expect.poll(fits).toBe(true);
  await expect(box).toHaveClass(/is-tight/);
});

test("the build writes talk.lang into <html lang>", () => {
  for (const f of ["index.html", "presenter.html"]) expect(readFileSync(`${DEMO}/${f}`, "utf8"), f).toMatch(/<html lang="en-GB"/);
});

test("an advance onto a preshow beat leaves the clock stopped; the first content beat starts it", async ({ page }) => {
  await demoDeck(page, "");
  const started = () => page.evaluate(() => sessionStorage.getItem("talk-clock"));
  await page.keyboard.press("PageDown"); // lobby -> lobby, still
  await settled(page);
  expect(await index(page)).toBe(1);
  expect(await started()).toBeNull();
  await page.keyboard.press("PageDown"); // -> the talk's first content beat
  await settled(page);
  expect(await started()).not.toBeNull();
});

test("a click within a slide is a play mark; a click to the next slide is a solid pill with its number", async ({ page }) => {
  await demoDeck(page);
  const view = await viewOf(page);
  const click = view.locator("#notes .click");
  // b1 and b2 share the opening slide (2); b3 ends it, and its click opens slide 3
  await tell(page, at("b1"), null);
  await expect(click).toHaveCount(1);
  await expect(click).not.toHaveClass(/is-slide/);
  await expect(click).toHaveText("");
  await expect(click).toHaveAttribute("aria-label", "next beat");
  await tell(page, at("b3"), null);
  await expect(click).toHaveClass(/is-slide/);
  await expect(click).toHaveText("slide 3");
  await expect(click).toHaveAttribute("aria-label", "next slide, 3");
});

test("ahead of plan by a minute or more, the pace says so, its gap rounded down", async ({ page }) => {
  await demoDeck(page);
  const view = await viewOf(page);
  await tell(page, at("b4"), 0); // planned 2 min 51 s in, reached as the clock starts
  await expect(view.locator("#pace")).toHaveClass("is-ahead");
  await expect(view.locator("#pace")).toHaveText("2 min ahead");
});

test("the talk strip: one segment per section run, as wide as its planned time; past, current and future; the playhead is the clock in the pace colour", async ({ page }) => {
  const runs = sectionRuns(demo, demoTalk.wpm);
  const planned = demo.map((b) => seconds(b, demoTalk.wpm));
  const arrive = (i: number) => planned.slice(0, i).reduce((a, b) => a + b, 0);
  await demoDeck(page);
  const view = await viewOf(page);
  await view.setViewportSize({ width: 1440, height: 900 });
  const segs = view.locator("#strip .run");
  await expect(segs).toHaveCount(runs.length);
  expect(await segs.evaluateAll((els) => els.map((e) => e.getAttribute("title")))).toEqual(runs.map((r) => sectionName(r.section, demoTalk)));
  expect(await segs.nth(3).textContent()).toBe("Section alpha"); // talk.sections
  expect(await segs.nth(2).textContent()).toBe("Second part"); // the id, in sentence case

  // widths: in proportion to planned time
  const widths = await segs.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
  const timed = runs.map((r, k) => k).filter((k) => runs[k].planned > 0);
  const perSecond = timed.reduce((a, k) => a + widths[k], 0) / timed.reduce((a, k) => a + runs[k].planned, 0);
  for (const k of timed) expect(widths[k], runs[k].section).toBeCloseTo(runs[k].planned * perSecond, 0);
  // untimed preshow and credits take no room; a current one shows (the lobby, as the deck opens)
  expect(widths[0]).toBeGreaterThan(0);
  expect(widths[runs.length - 1]).toBe(0);

  // before the clock starts: no playhead
  await expect(view.locator("#playhead")).toBeHidden();

  // past, current, future; the current run filled to this beat's planned end
  const i = at("alpha-2"); // section alpha's second beat
  const here = runs.findIndex((r) => i >= r.from && i < r.to);
  const leave = arrive(i) + planned[i];
  const headAt = async () => {
    await view.waitForTimeout(300); // a tick
    const [x, e, boxes] = await view.evaluate(() => {
      const h = document.getElementById("playhead")!.getBoundingClientRect();
      return [h.x + h.width / 2, (window as any).__presenter.elapsed(), [...document.querySelectorAll("#strip .run")].map((r) => r.getBoundingClientRect()).map((b) => ({ x: b.x, width: b.width }))];
    });
    const k = timed.find((k) => e < runs[k].start + runs[k].planned) ?? timed[timed.length - 1];
    const expected = boxes[k].x + Math.min(1, (e - runs[k].start) / runs[k].planned) * boxes[k].width;
    return { x, expected };
  };
  const cases = [
    { ago: arrive(i) + 0.5 * planned[i], state: "is-on", colour: "--on" },
    { ago: leave + 75, state: "is-behind", colour: "--late" },
    { ago: arrive(i) - AHEAD_S - 30, state: "is-ahead", colour: "--on" },
    { ago: demoTalk.slot * 60 + 30, state: "is-over", colour: "--over" },
  ];
  for (const c of cases) {
    await tell(page, i, c.ago);
    await expect(segs.first()).toHaveClass(/is-zero/);
    expect((await segs.first().boundingBox())?.width ?? 0).toBe(0); // the lobby, past: no room
    await expect(view.locator("#playhead")).toHaveClass(c.state);
    await expect(view.locator("#pace")).toHaveClass(c.state);
    const { x, expected } = await headAt();
    expect(x, c.state).toBeCloseTo(expected, -0.6); // within 2 px
    const colour = await colourOf(view, c.colour);
    expect(await view.locator("#playhead").evaluate((e) => getComputedStyle(e).backgroundColor), c.state).toBe(colour);
  }
  // behind: the head is past the current run's fill
  await tell(page, i, leave + 75);
  await expect(view.locator("#playhead")).toHaveClass("is-behind");
  const fill = (await segs.nth(here).locator(".fill").boundingBox())!;
  expect((await headAt()).x).toBeGreaterThan(fill.x + fill.width);
  const r = runs[here];
  expect(fill.width / widths[here]).toBeCloseTo((leave - r.start) / r.planned, 1);
  expect(await segs.evaluateAll((els) => els.map((e) => e.className.replace("run ", "")))).toEqual(runs.map((r, k) => (k < here ? "is-past" : k === here ? "is-current" : "is-future") + (r.planned ? "" : " is-zero")));
});
