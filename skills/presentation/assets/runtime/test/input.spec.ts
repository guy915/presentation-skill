// Input and the talk's clock. In the audience window PageDown, Space,
// ArrowRight, ArrowDown and a left click advance; PageUp, ArrowLeft and
// ArrowUp go back; F toggles fullscreen; S opens the speaker view. Every other
// key does nothing, and a held key acts once. The speaker view forwards the
// next and back keys over a channel only this deck hears; its preview iframe
// never drives. The clock, which the audience window owns, starts when the
// talk starts (the first fullscreen on a content beat, or the speaker's first
// advance onto one), a reload keeps it, and a fresh load clears it.
import { test, expect, type Page } from "@playwright/test";
import { open, settled, index, jump, beats, speakerView, firstPlayed } from "./helpers/deck";
import { beats as manifest, needs } from "./helpers/manifest";
import { cue, KEYS } from "../src/runtime/manifest.ts";

const last = manifest.length - 1;
const NEXT = ["PageDown", "Space", "ArrowRight", "ArrowDown"];
const BACK = ["PageUp", "ArrowLeft", "ArrowUp"];
/** The speaker view's elapsed time, in seconds (it shows whole minutes; __presenter has the seconds). */
const elapsed = (view: Page): Promise<number> => view.evaluate(() => (window as any).__presenter?.elapsed() ?? 0);
/** When the deck's clock started (epoch ms), or null. */
const started = (page: Page) => page.evaluate(() => sessionStorage.getItem("talk-clock"));
const post = (page: Page, name: string, msg: object) =>
  page.evaluate(([name, msg]) => new BroadcastChannel(name as string).postMessage(msg), [name, msg] as const);

test("each next key advances one beat; each back key goes back one, at once", async ({ page }) => {
  expect([...KEYS.next].map((k) => (k === " " ? "Space" : k)).sort()).toEqual([...NEXT].sort());
  expect([...KEYS.prev].sort()).toEqual([...BACK].sort());
  needs(3);
  await open(page);
  for (const key of NEXT) {
    await jump(page, 0);
    await page.keyboard.press(key);
    await settled(page);
    expect(await index(page), key).toBe(1);
  }
  for (const key of BACK) {
    await jump(page, 2);
    await page.keyboard.press(key);
    expect(await index(page), `${key} is instant`).toBe(1);
  }
});

test("every other key does nothing, and a key with a modifier is ignored", async ({ page }) => {
  needs(2);
  await open(page);
  await jump(page, 1);
  const keys = ["Enter", "Backspace", "Home", "End", "n", "N", "p", "P", "b", "B", ".", "3", "Control+PageDown", "Alt+Space", "Meta+PageUp", "Control+ArrowRight"];
  for (const key of keys) {
    await page.keyboard.press(key);
    await settled(page);
    expect(await index(page), key).toBe(1);
  }
});

test("a held key acts once, in the audience window and in the speaker view", async ({ page }) => {
  needs(3);
  await open(page);
  // keyboard.down on a key already down sends it again with repeat set, as a held key does
  for (let n = 0; n < 4; n++) await page.keyboard.down("PageDown");
  await page.keyboard.up("PageDown");
  await settled(page);
  expect(await index(page), "audience window").toBe(1);
  const presenter = await speakerView(page);
  await presenter.bringToFront();
  for (let n = 0; n < 4; n++) await presenter.keyboard.down("Space");
  await presenter.keyboard.up("Space");
  await expect.poll(() => index(page)).toBe(2);
  await presenter.waitForTimeout(300);
  expect(await index(page), "speaker view").toBe(2);
});

test("a left click anywhere advances, a right click does not, and the click that focuses the window only focuses it", async ({ page }) => {
  needs(3);
  await open(page);
  await page.mouse.click(5, 5);
  await settled(page);
  expect(await index(page)).toBe(1);
  await page.mouse.click(960, 540, { button: "right" });
  await settled(page);
  expect(await index(page)).toBe(1);
  // the speaker clicks into the audience window (which had lost focus) before pressing F
  await page.evaluate(() => {
    window.dispatchEvent(new FocusEvent("blur"));
    window.dispatchEvent(new FocusEvent("focus"));
  });
  await page.mouse.click(960, 540);
  await settled(page);
  expect(await index(page), "the focusing click").toBe(1);
  await page.waitForTimeout(450);
  await page.mouse.click(960, 540);
  await settled(page);
  expect(await index(page)).toBe(2);
});

test("nothing moves past either end: Space, a left click, PageDown and the speaker view's keys stay put", async ({ page }) => {
  needs(1);
  await open(page);
  await page.keyboard.press("PageUp");
  await settled(page);
  expect(await index(page)).toBe(0);
  const presenter = await speakerView(page);
  await page.bringToFront();
  await jump(page, last);
  const hash = await page.evaluate(() => location.hash);
  const stays = async (how: string) => {
    await settled(page);
    expect(await index(page), how).toBe(last);
    expect(await page.evaluate(() => location.hash), how).toBe(hash);
  };
  await page.keyboard.press("Space");
  await stays("Space");
  await page.waitForTimeout(450); // clear of the focusing-click window
  await page.mouse.click(960, 540);
  await stays("left click");
  await page.keyboard.press("PageDown");
  await stays("PageDown");
  await presenter.bringToFront();
  for (const key of ["PageDown", "Space"]) await presenter.keyboard.press(key);
  await presenter.waitForTimeout(300);
  await stays("from the speaker view");
  await expect(presenter.locator("#label")).toHaveText(cue(manifest[last].notes));
  await expect(presenter.locator("#preview")).toBeHidden();
});

test("a key from the speaker view mid-transition settles it and advances, in one press", async ({ page }) => {
  await open(page);
  const list = await beats(page);
  // the longest played transition with a beat after it (a clip's length depends on its decoder: left out)
  const i = list.reduce((best, b, k) => (k > 0 && k < last && !manifest[k].assets?.length && b.transition > (list[best]?.transition ?? 0) ? k : best), -1);
  test.skip(i < 0 || list[i].transition < 0.5, "no beat before the last has a played transition of 0.5 s or more");
  const presenter = await speakerView(page);
  await jump(page, i - 1);
  const t0 = Date.now();
  await page.keyboard.press("PageDown"); // the transition into beat i starts
  await presenter.keyboard.press("PageDown"); // and the speaker view's key arrives while it plays
  expect(Date.now() - t0, "pressed mid-transition").toBeLessThan(list[i].transition * 1000);
  await expect.poll(() => index(page)).toBe(i + 1);
  await settled(page);
  expect(await index(page), "one press, one beat").toBe(i + 1);
});

test("F enters fullscreen, which starts the clock on a content beat, and F again leaves it", async ({ page }) => {
  needs(1);
  await open(page);
  expect(await started(page)).toBeNull();
  const full = () => page.evaluate(() => !!document.fullscreenElement);
  await page.keyboard.press("f");
  await expect.poll(full).toBe(true);
  if ((manifest[0].kind ?? "content") === "content") await expect.poll(() => started(page)).not.toBeNull();
  await page.keyboard.press("F");
  await expect.poll(full).toBe(false);
  expect(await index(page)).toBe(0);
});

test("the cursor hides after 2 s still and returns on movement", async ({ page }) => {
  await open(page);
  await page.mouse.move(100, 100);
  await page.waitForTimeout(2300);
  expect(await page.evaluate(() => getComputedStyle(document.body).cursor)).toBe("none");
  await page.mouse.move(200, 200);
  expect(await page.evaluate(() => getComputedStyle(document.body).cursor)).not.toBe("none");
});

test("S opens the speaker view, whose next and back keys drive the deck, and only those", async ({ page }) => {
  needs(3);
  await open(page);
  const presenter = await speakerView(page);
  expect(new URL(presenter.url()).pathname).toMatch(/presenter\.html$/);
  await presenter.bringToFront();
  const moves = [["PageDown", 1], ["Space", 2], ["PageUp", 1], ["ArrowRight", 2], ["ArrowLeft", 1], ["ArrowDown", 2], ["ArrowUp", 1]] as const;
  for (const [key, to] of moves) {
    await presenter.keyboard.press(key);
    await expect.poll(() => index(page), key).toBe(to);
  }
  for (const key of ["Enter", "End", "f", "s"]) await presenter.keyboard.press(key);
  await presenter.waitForTimeout(300);
  expect(await index(page)).toBe(1);
  await expect(presenter.locator("#label")).toHaveText(cue(manifest[1].notes));
});

test("the speaker view's preview iframe never drives the deck", async ({ page }) => {
  needs(3);
  await open(page);
  const presenter = await speakerView(page);
  const frame = presenter.frameLocator("#preview");
  await expect(frame.locator("#stage")).toBeVisible();
  await presenter.waitForFunction(() => (document.getElementById("preview") as HTMLIFrameElement).contentWindow?.hasOwnProperty("__deck"));
  const box = (await presenter.locator("#preview").boundingBox())!;
  await presenter.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  // even with focus forced inside it, its keys and clicks go nowhere
  const inner = (await (await presenter.locator("#preview").elementHandle())!.contentFrame())!;
  await inner.evaluate(() => {
    document.body.focus();
    dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown" }));
    document.body.click();
  });
  await presenter.waitForTimeout(500);
  expect(await index(page)).toBe(0);
  expect(await inner.evaluate(() => (window as any).__deck.index())).toBe(1); // it shows the next beat, and stays there
  // but it follows the deck: after a real advance it shows the new next beat
  await page.bringToFront();
  await page.keyboard.press("PageDown");
  await expect.poll(() => inner.evaluate(() => (window as any).__deck.index())).toBe(2);
});

test("nothing starts the clock before the speaker's first advance; that advance does", async ({ page }) => {
  needs(2);
  await open(page);
  const view = await speakerView(page, true);
  await page.keyboard.press("PageUp"); // back, at the first beat: not an advance
  await page.evaluate(() => (window as any).__deck.go(0, { instant: true })); // a jump is not the speaker's advance either
  await page.waitForTimeout(1500);
  expect(await elapsed(view)).toBe(0);
  expect(await started(page)).toBeNull();
  await page.keyboard.press("PageDown");
  await settled(page);
  expect(await started(page)).not.toBeNull();
  await expect.poll(() => elapsed(view)).toBeGreaterThanOrEqual(1);
});

test("a reload of the deck or of the speaker view keeps the clock; a fresh load clears it", async ({ page }) => {
  needs(2);
  await open(page);
  await page.keyboard.press("PageDown");
  await settled(page);
  const view = await speakerView(page, true);
  await page.waitForTimeout(2200);
  await page.reload(); // the URL names the beat: a reload
  await page.waitForFunction(() => (window as any).__deck);
  await expect.poll(() => elapsed(view)).toBeGreaterThanOrEqual(2);
  await view.reload();
  await expect.poll(() => elapsed(view)).toBeGreaterThanOrEqual(2);
  // the view shows the time since the start, in whole minutes rounded down
  await expect(view.locator("#time")).toHaveText(`${Math.floor((await elapsed(view)) / 60)}`);
  // the talk's link again, with no beat in it: a new run of the talk
  await page.goto("about:blank");
  await open(page);
  expect(await started(page)).toBeNull();
  await expect.poll(() => elapsed(view)).toBe(0);
});

// The channel is named per talk (its directory) and every message carries the
// deck's session id, which the speaker view gets in its URL.
test("a stale tab of the same talk neither drives this deck nor shows in its speaker view", async ({ page, context }) => {
  needs(3);
  await open(page);
  const stale = await context.newPage();
  await open(stale);
  const presenter = await speakerView(page);
  await expect(presenter.locator("#label")).toHaveText(cue(manifest[0].notes));
  await presenter.keyboard.press("PageDown");
  await expect.poll(() => index(page)).toBe(1);
  expect(await index(stale)).toBe(0);
  await jump(stale, 2); // the stale tab announces its beat
  await presenter.waitForTimeout(300);
  await expect(presenter.locator("#label")).toHaveText(cue(manifest[1].notes));
});

test("the channel is named for this talk's directory and needs this deck's session", async ({ page, context }) => {
  needs(2);
  await open(page);
  const other = await context.newPage();
  await other.goto("/favicon.ico").catch(() => {}); // any page on the origin
  const s = await page.evaluate(() => (window as any).__deck.session);
  expect(s).toBeTruthy();
  const key = { kind: "key", key: "PageDown" };
  await post(other, "talk:/other-talk/", { ...key, s });
  await post(other, "talk:/", key); // no session
  await post(other, "talk:/", { ...key, s: "someone-else" });
  await page.waitForTimeout(300);
  expect(await index(page)).toBe(0);
  await post(other, "talk:/", { ...key, s });
  await expect.poll(() => index(page)).toBe(1);
});

test("the beat message says when the deck is at rest: false as a played transition starts, true when it settles", async ({ page, context }) => {
  await open(page);
  const i = firstPlayed(await beats(page), 0.3);
  test.skip(i < 0, "no beat has a played transition of 0.3 s or more");
  await jump(page, i - 1);
  const s = await page.evaluate(() => (window as any).__deck.session);
  const ear = await context.newPage(); // a stand-in speaker view: the same channel and session
  await ear.goto("/favicon.ico").catch(() => {});
  await ear.evaluate((s) => {
    (window as any).__heard = [];
    new BroadcastChannel("talk:/").addEventListener("message", (e) => e.data?.s === s && e.data.kind === "beat" && (window as any).__heard.push([e.data.index, e.data.settled]));
  }, s);
  await page.keyboard.press("PageDown");
  await settled(page);
  await expect.poll(() => ear.evaluate(() => (window as any).__heard)).toContainEqual([i, true]);
  const heard: [number, boolean][] = await ear.evaluate(() => (window as any).__heard);
  const here = heard.filter(([k]) => k === i).map(([, settled]) => settled);
  expect(here[0], "the transition starts: not at rest").toBe(false);
  expect(here.at(-1), "it settles: at rest").toBe(true);
});
