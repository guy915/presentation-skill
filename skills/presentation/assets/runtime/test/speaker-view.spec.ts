// The speaker view (presenter.html), for the speaker alone, on this talk: a
// toolbar (the time since the start, the pace, the slide, save rehearsal, the theme) over the
// talk strip, this beat's cue and script with its clicks and stage directions
// marked, what the room sees next and now (live, or stills for heavy scenes),
// and a ready bar while the deck still moves. Its look is fixed: the talk's
// theme leaves it alone. The runtime's own tests (test/runtime/speaker-view.spec.ts)
// cover the strip, the click pills and the pace on fixture talks.
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { open, settled, jump, hashOf, speakerView, firstPlayed, tell, beats as deckBeats } from "./helpers/deck";
import { beats as manifest, talk, needs } from "./helpers/manifest";
import { cue, seconds, words, sectionRuns, type RehearsalFile } from "../src/runtime/manifest.ts";

/** The script's smallest size, px (FLOOR in src/runtime/presenter.ts). */
const FLOOR = 28;
/** The first content beat. */
const first = manifest.findIndex((b) => (b.kind ?? "content") === "content");
const plan = manifest.map((b) => seconds(b, talk.wpm));
const arrive = (i: number) => plan.slice(0, i).reduce((a, b) => a + b, 0);
const slot = talk.slot * 60;

/** The speaker view, once the deck has told it where it is. */
async function viewOf(deck: Page) {
  const view = await speakerView(deck, true);
  await expect(view.locator("#label")).not.toBeEmpty();
  return view;
}
const bg = (view: Page) => view.evaluate(() => getComputedStyle(document.body).backgroundColor);
const token = (view: Page, name: string) => view.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
const DARK_BG = "rgb(33, 33, 33)";
const LIGHT_BG = "rgb(255, 255, 255)";
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

test("shows the cue and script, the frames now and next, the slide and the clock, and nothing else; on the last beat, no next frame", async ({ page }) => {
  needs(3);
  await open(page);
  const presenter = await speakerView(page, true);
  await expect(presenter.locator("#label")).toHaveText(cue(manifest[0].notes));
  const shown = await presenter.evaluate(() =>
    [...document.body.querySelectorAll<HTMLElement>("[id]")].filter((e) => e.checkVisibility()).map((e) => e.id).sort(),
  );
  expect(shown).toEqual(
    ["clock", "current", "label", "notes", "now", "pace", "pace-text", "preview", "save", "slide", "strip", "theme", "theme-box", "time", "top", "track", "unit"],
  );
  await page.keyboard.press("PageDown");
  await settled(page);
  await expect(presenter.locator("#label")).toHaveText(cue(manifest[1].notes));
  const label = await presenter.locator("#label").evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  const body = await presenter.locator("#notes").evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(label).toBeGreaterThan(body); // the cue reads first
  await expect(presenter.locator("#current")).toHaveAttribute("src", new RegExp(`${hashOf(manifest, 1)}$`));
  await expect(presenter.locator("#preview")).toHaveAttribute("src", new RegExp(`${hashOf(manifest, 2)}$`));
  const runs = sectionRuns(manifest, talk.wpm);
  const slide = runs.findIndex((r) => 1 >= r.from && 1 < r.to) + 1; // beat 2's slide: its section run
  await expect(presenter.locator("#slide")).toHaveText(`Slide ${slide} of ${runs.length}`);
  await expect(presenter.locator("#slide b")).toHaveText(`${slide}`);
  await expect(presenter.locator("#time")).toHaveText("0");
  await expect(presenter.locator("#unit")).toHaveText("min");
  expect(await page.evaluate(() => (window as any).__deck.beats[0].duration)).toBeCloseTo(seconds(manifest[0], talk.wpm), 3);
  await jump(page, manifest.length - 1);
  await expect(presenter.locator("#label")).toHaveText(cue(manifest[manifest.length - 1].notes));
  await expect(presenter.locator("#preview")).toBeHidden();
  await expect(presenter.locator("#current")).toBeVisible();
});

test("[click] is a marker; other brackets are dimmed stage directions; [FILL …], [CONFIRM …] and [TODO …] are highlighted", async ({ page }) => {
  needs(1);
  await open(page);
  const presenter = await speakerView(page, true);
  const i = manifest.findIndex((b) => /\[(?!click\])[^\]]+\]/.test(b.notes));
  if (i >= 0) {
    await jump(page, i);
    await expect(presenter.locator("#notes .click")).toHaveCount((manifest[i].notes.match(/\[click\]/g) ?? []).length);
    const dir = presenter.locator("#notes .dir").first();
    await expect(dir).toHaveText(manifest[i].notes.match(/\[(?!click\])[^\]]+\]/)![0]);
    const said = await presenter.locator("#notes").evaluate((e) => getComputedStyle(e).color);
    expect(await dir.evaluate((e) => getComputedStyle(e).color)).not.toBe(said);
    expect(await presenter.locator("#notes").textContent()).not.toContain("[click]");
  }
  // what the view renders for a marker, next to a stage direction
  await presenter.evaluate(() => (document.getElementById("notes")!.innerHTML = `<span class="mark">[FILL year]</span> <span class="dir">[pause]</span>`));
  const bgOf = (s: string) => presenter.locator(`#notes .${s}`).evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(await bgOf("mark")).not.toBe(await bgOf("dir"));
});

test("the toolbar across the top, on one baseline; under it the script and the monitors; the next frame first and largest, from 1280×800 to 1920×1200", async ({ page }) => {
  test.skip(first < 0 || first + 1 >= manifest.length, "needs a content beat with a beat after it");
  await open(page);
  const presenter = await speakerView(page, true);
  await jump(page, first);
  await presenter.evaluate(() => document.fonts.ready);
  for (const size of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }, { width: 1920, height: 1200 }]) {
    await presenter.setViewportSize(size);
    const [now, next] = await Promise.all(["#current", "#preview"].map((s) => presenter.locator(s).boundingBox()));
    expect(next!.width, `at ${size.width}x${size.height}`).toBeGreaterThan(now!.width);
    expect(next!.y, `at ${size.width}x${size.height}`).toBeLessThan(now!.y);
    // everything fits the window: no page scroll
    expect(await presenter.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), `at ${size.width}x${size.height}`).toBe(true);
    // the toolbar across the top; under it the script (left) and the monitors (right), on one top line
    const [top, script, frames, theme] = await Promise.all(["#top", "#now", ".frames", "#theme"].map((s) => presenter.locator(s).boundingBox()));
    expect(top!.x, `toolbar at ${size.width}`).toBe(0);
    expect(top!.width, `toolbar at ${size.width}`).toBe(size.width);
    for (const col of [script, frames]) expect(col!.y, `columns at ${size.width}`).toBeCloseTo(top!.y + top!.height, 0);
    expect(script!.x).toBe(0);
    expect(script!.x + script!.width).toBeLessThanOrEqual(frames!.x + 1);
    expect(frames!.x + frames!.width).toBeCloseTo(size.width, 0);
    expect(theme!.x + theme!.width, `theme control in the window at ${size.width}`).toBeLessThanOrEqual(size.width);
    // the time, its unit, the pace and the slide share one baseline
    const baselines = await presenter.evaluate(() =>
      ["#time", "#unit", "#pace-text", "#slide"].map((sel) => {
        const probe = document.createElement("span");
        probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
        document.querySelector(sel)!.append(probe);
        const y = probe.getBoundingClientRect().top;
        probe.remove();
        return y;
      }),
    );
    for (const y of baselines) expect(y, `baselines ${baselines.join(", ")} at ${size.width}`).toBeCloseTo(baselines[0], 0);
    // the time is the largest type in the toolbar
    const sizes = await presenter.locator("#top *").evaluateAll((els) => els.map((e) => [e.id, parseFloat(getComputedStyle(e).fontSize)] as const));
    const big = sizes.find(([id]) => id === "time")![1];
    for (const [id, px] of sizes) if (id !== "time") expect(px, id).toBeLessThan(big);
  }
});

test("?preview=still shows rest stills instead of live decks; ?fallback= reaches the previews", async ({ page }) => {
  needs(2);
  await open(page, "/?preview=still&fallback=all");
  const presenter = await speakerView(page, true);
  expect(new URL(presenter.url()).searchParams.get("fallback")).toBe("all");
  await expect(presenter.locator("#preview-still")).toHaveAttribute("src", `rest/${manifest[1].id}.jpg`);
  await expect(presenter.locator("#current-still")).toHaveAttribute("src", `rest/${manifest[0].id}.jpg`);
  await expect(presenter.locator("#preview")).toBeHidden();
  await expect(presenter.locator("#preview")).not.toHaveAttribute("src", /./);

  await presenter.close(); // S reuses the window named "presenter"
  await open(page, "/?fallback=all");
  const live = await speakerView(page, true);
  await expect(live.locator("#preview")).toHaveAttribute("src", /^\.\/\?fallback=all#\//);
});

test("this talk's script fits the speaker view on every beat at FLOOR px or more, from 1280×800 up", async ({ page }) => {
  needs(1);
  await open(page);
  const presenter = await speakerView(page, true);
  for (const size of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
    await presenter.setViewportSize(size);
    for (let i = 0; i < manifest.length; i++) {
      await jump(page, i);
      await expect(presenter.locator("#label")).toHaveText(cue(manifest[i].notes));
      await presenter.waitForTimeout(50);
      const [fits, px] = await presenter.evaluate(() => {
        const now = document.getElementById("now")!;
        return [now.scrollHeight <= now.clientHeight + 1, parseFloat(getComputedStyle(document.getElementById("notes")!).fontSize)] as const;
      });
      expect(fits, `beat ${manifest[i].id} at ${size.width}×${size.height}`).toBe(true);
      expect(px, `beat ${manifest[i].id} at ${size.width}×${size.height}: split it, the script needs ${px.toFixed(0)} px to fit`).toBeGreaterThanOrEqual(FLOOR);
    }
  }
});

test("the time since the start in whole minutes, orange past the slot, and the pace: not started, on plan, behind, over", async ({ page }) => {
  test.skip(first < 0 || first + 1 >= manifest.length, "needs a content beat with a beat after it");
  await open(page);
  const view = await viewOf(page);
  await expect(view.locator("#pace")).toHaveClass("is-idle");
  await expect(view.locator("#pace")).toHaveText("Not Started");
  await tell(page, first, 125);
  await expect(view.locator("#time")).toHaveText("2");
  await expect(view.locator("#unit")).toHaveText("min");
  await expect(view.locator("#clock")).toHaveClass("");

  await tell(page, first, slot + 130);
  await expect(view.locator("#time")).toHaveText(`${Math.floor((slot + 130) / 60)}`);
  await expect(view.locator("#clock")).toHaveClass("is-over");
  const over = await colourOf(view, "--red-text"); // orange, in its text-safe ink
  expect(await view.locator("#time").evaluate((e) => getComputedStyle(e).color)).toBe(over);
  await expect(view.locator("#pace")).toHaveClass("is-over");
  await expect(view.locator("#pace")).toHaveText("3 min over");

  const i = first + 1;
  const leave = arrive(i) + plan[i];
  await tell(page, i, arrive(i) + 0.5 * plan[i]);
  await expect(view.locator("#pace")).toHaveClass("is-on");
  await expect(view.locator("#pace")).toHaveText("On Plan");
  await tell(page, i, leave + 20);
  await expect(view.locator("#pace")).toHaveClass("is-behind");
  await expect(view.locator("#pace")).toHaveText("< 1 min behind");
  await tell(page, i, leave + 90);
  await expect(view.locator("#pace")).toHaveText("1 min behind");
  // the shape says it too, for a viewer who can't tell the colours apart
  await expect(view.locator("#pace .glyph")).toBeVisible();
  // a tinted capsule: its text in the state's colour
  expect(await view.locator("#pace").evaluate((e) => getComputedStyle(e).color)).toBe(await colourOf(view, "--orange-text"));
  expect(await view.locator("#pace").evaluate((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius))).toBeGreaterThanOrEqual(16);
});

test("the ready bar shows while a played transition runs and goes when the deck comes to rest", async ({ page }) => {
  await open(page);
  const list = await deckBeats(page);
  const i = firstPlayed(list, 0.5);
  test.skip(i < 0, "no beat has a played transition of 0.5 s or more");
  await jump(page, i - 1);
  const view = await speakerView(page, true);
  await expect(view.locator("#label")).toHaveText(cue(manifest[i - 1].notes));
  await expect(view.locator("#ready")).toBeHidden();
  // every change of the bar, seen from inside the view
  await view.evaluate(() => {
    const bar = document.getElementById("ready")!;
    (window as any).__bar = [];
    new MutationObserver(() => (window as any).__bar.push(bar.hidden)).observe(bar, { attributes: true, attributeFilter: ["hidden"] });
  });
  await page.keyboard.press("PageDown"); // plays the transition
  await expect(view.locator("#ready")).toBeVisible();
  const box = (await view.locator("#ready").boundingBox())!;
  expect(box.width).toBe(view.viewportSize()!.width); // full width
  expect(box.height).toBeLessThanOrEqual(8); // thin
  await settled(page);
  await expect(view.locator("#ready")).toBeHidden();
  expect(await view.evaluate(() => (window as any).__bar)).toEqual([false, true]); // one show, one hide
  await jump(page, i - 1); // a jump is at rest at once
  await expect(view.locator("#ready")).toBeHidden();
});

test("Save rehearsal downloads the time each beat stayed on screen since the clock started; a reload keeps the log, a fresh load starts a new one", async ({ page }) => {
  test.skip(manifest.length < first + 3, "needs two advances after the first content beat");
  await open(page);
  const view = await viewOf(page);
  const save = view.locator("#save");
  await expect(save).toHaveAttribute("aria-label", "Save rehearsal");
  await expect(save).toBeDisabled(); // the clock has not started
  await jump(page, first);
  const stay = 800; // ms on each beat after the advance that reaches it
  for (let k = 0; k < 2; k++) {
    await page.keyboard.press("PageDown"); // the first advance starts the clock
    await settled(page);
    await page.waitForTimeout(stay);
  }
  await expect(save).toBeEnabled();
  const [download] = await Promise.all([view.waitForEvent("download"), save.click()]);
  expect(download.suggestedFilename()).toMatch(/^rehearsal-\d{4}-\d{2}-\d{2}\.json$/);
  const r = JSON.parse(readFileSync((await download.path())!, "utf8")) as RehearsalFile;
  expect(r.beats.map((b) => b.id)).toEqual(manifest.map((b) => b.id));
  expect(r.beats.map((b) => b.words)).toEqual(manifest.map((b) => words(b.notes)));
  r.beats.forEach((b, i) => expect(b.planned).toBeCloseTo(seconds(manifest[i], talk.wpm), 1));
  const took = r.beats.map((b) => b.seconds);
  for (const i of [first + 1, first + 2]) {
    expect(took[i], `beat ${manifest[i].id}`).toBeGreaterThanOrEqual(stay / 1000 - 0.1);
    expect(took[i], `beat ${manifest[i].id}`).toBeLessThan(30);
  }
  took.forEach((s, i) => i !== first + 1 && i !== first + 2 && expect(s, `beat ${manifest[i].id}: never on screen with the clock running`).toBe(0));
  expect(r.total).toBeCloseTo(took.reduce((a, b) => a + b, 0), 0);
  expect(r.wpm).toBe(talk.wpm);

  // a reload keeps the log, and the beat on screen keeps counting
  await page.reload();
  await page.waitForFunction(() => (window as any).__deck);
  const kept = (await view.evaluate(() => (window as any).__presenter.rehearsal())) as RehearsalFile;
  expect(kept.beats[first + 1].seconds).toBeCloseTo(took[first + 1], 1);
  expect(kept.beats[first + 2].seconds).toBeGreaterThanOrEqual(took[first + 2]);
  // the talk's link again, with no beat in it: a new run and a new log
  await page.goto("about:blank");
  await open(page);
  await expect(save).toBeDisabled();
  expect(await view.evaluate(() => (window as any).__presenter.rehearsal())).toBeNull();
});

test("the look is fixed: the talk's theme leaves it alone; the theme follows the system until the button swaps it for this tab; next and back on the focused button drive the deck", async ({ page, browser }) => {
  needs(3);
  await open(page);
  const view = await speakerView(page, true);
  const button = view.locator("#theme");
  await view.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => bg(view)).toBe(DARK_BG);
  await expect(button).toHaveAttribute("data-shows", "dark"); // a moon
  await expect(button).toHaveAttribute("aria-label", "Switch to light");
  await view.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => bg(view)).toBe(LIGHT_BG);
  await expect(button).toHaveAttribute("data-shows", "light"); // a sun
  await expect(view.locator("#theme button")).toHaveCount(0); // one button, no segments
  const box = (await button.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(40);
  expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1); // round

  await button.click();
  await expect.poll(() => bg(view)).toBe(DARK_BG); // the system says light: the press wins
  await expect(button).toHaveAttribute("data-shows", "dark");
  expect(await view.evaluate(() => document.activeElement?.id ?? null)).not.toBe("theme"); // the press leaves no focus on it
  await view.reload();
  await expect.poll(() => bg(view)).toBe(DARK_BG); // the same tab keeps the choice
  await button.click();
  await expect.poll(() => bg(view)).toBe(LIGHT_BG); // and a second press swaps back

  // Space and PageDown on the focused button drive the deck and leave the theme
  await view.evaluate(() => sessionStorage.clear());
  await view.reload();
  await view.bringToFront();
  await view.emulateMedia({ colorScheme: "dark" });
  await view.locator("#theme").focus();
  expect(await view.evaluate(() => document.activeElement?.id)).toBe("theme");
  const at = await page.evaluate(() => (window as any).__deck.index());
  await view.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => (window as any).__deck.index())).toBe(at + 1);
  await view.keyboard.press("PageDown");
  await expect.poll(() => page.evaluate(() => (window as any).__deck.index())).toBe(at + 2);
  await view.waitForTimeout(200);
  expect(await view.evaluate(() => document.documentElement.dataset.theme ?? "system")).toBe("system");
  expect(await bg(view)).toBe(DARK_BG);

  // src/theme.css is not on this page: nothing declares the talk's tokens, and setting them changes nothing
  await view.evaluate(() => document.fonts.ready);
  const talkTokens = await view.evaluate(() =>
    [...document.styleSheets].flatMap((s) => [...s.cssRules].map((r) => r.cssText)).filter((t) => /--ground|--font-text|--type-floor/.test(t)),
  );
  expect(talkTokens).toEqual([]);
  await view.evaluate(() => {
    document.documentElement.style.setProperty("--ground", "#ff0000");
    document.documentElement.style.setProperty("--font-text", "serif");
  });
  expect(await bg(view)).toBe(DARK_BG);
  expect(await token(view, "--bg")).toBe("#212121");
  // DM Sans for words, DM Mono for the clock
  for (const sel of ["body", "#label", "#notes", "#pace", "#slide"]) {
    const family = await view.locator(sel).evaluate((e) => getComputedStyle(e).fontFamily);
    expect(family, sel).toBe(`"DM Sans Variable", sans-serif`);
  }
  expect(await view.locator("#time").evaluate((e) => getComputedStyle(e).fontFamily)).toBe(`"DM Mono", monospace`);
  // both faces load from the talk's own link
  await view.evaluate(() => Promise.all(['30px "DM Sans Variable"', '500 30px "DM Mono"'].map((f) => document.fonts.load(f, "Aa1"))));
  const faces = await view.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replaceAll('"', "")));
  expect(faces).toContain("DM Sans Variable");
  expect(faces).toContain("DM Mono");
  // digits line up: tabular figures everywhere
  expect(await view.locator("#time").evaluate((e) => getComputedStyle(e).fontVariantNumeric)).toBe("tabular-nums");

  // a fresh window follows the system again
  const fresh = await browser.newContext({ colorScheme: "light", viewport: { width: 1920, height: 1080 } });
  const deck = await fresh.newPage();
  await open(deck, `${new URL(page.url()).origin}/`);
  const other = await speakerView(deck);
  await expect.poll(() => bg(other)).toBe(LIGHT_BG);
  await fresh.close();
});
