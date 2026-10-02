// One click = one beat, and every beat comes to rest in the same state
// however you got there: played forward, stepped back, or loaded cold.
// Compares the DOM exactly, and canvas pixels and a screenshot with a small
// tolerance (video frames and antialiasing may differ by a few pixels). On the
// way, the talk stays self-hosted: every request stays on its origin, none
// fails, and nothing logs an error.
import { test, expect, type Page } from "@playwright/test";
import { open, settled, beats, index, jump, hashOf, snapshot, firstPlayed, type Snapshot } from "./helpers/deck";
import { diffPixels, MAX_DIFF } from "./helpers/pixels";
import { beats as manifest, needs } from "./helpers/manifest";

/** Asserts `got` is the state `want`: the same DOM, and each canvas within MAX_DIFF of its pixels. */
async function same(page: Page, got: Snapshot, want: Snapshot, what: string) {
  expect(got.dom, `${what}: DOM`).toBe(want.dom);
  expect(got.canvases.length, `${what}: canvases`).toBe(want.canvases.length);
  for (const [k, a] of got.canvases.entries()) {
    const b = want.canvases[k];
    if (a === b) continue;
    if (a === "empty" || b === "empty") expect(a, `${what}: canvas ${k}`).toBe(b);
    const { differ, total } = await diffPixels(page, a, b);
    expect(differ / total, `${what}: canvas ${k}, ${differ} of ${total} pixels differ (${((100 * differ) / total).toFixed(3)}%)`).toBeLessThanOrEqual(MAX_DIFF);
  }
}

/** Asserts a screenshot is within MAX_DIFF of `want`, naming how many pixels differ. */
async function samePicture(page: Page, got: Buffer, want: Buffer, what: string) {
  const { differ, total } = await diffPixels(page, got, want);
  expect(differ / total, `${what}: ${differ} of ${total} pixels differ`).toBeLessThanOrEqual(MAX_DIFF);
}

/** Collects what breaks self-hosting: an external request, a failed one, an error. */
function watch(page: Page) {
  const problems: string[] = [];
  const local = (url: string) => ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
  page.on("request", (r) => !local(r.url()) && !r.url().startsWith("data:") && problems.push(`external: ${r.url()}`));
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  // a local load the browser drops itself (a navigation away, media buffering) never left the machine
  page.on("requestfailed", (r) => !(local(r.url()) && r.failure()?.errorText === "net::ERR_ABORTED") && problems.push(`failed: ${r.url()} ${r.failure()?.errorText}`));
  page.on("response", (r) => r.status() >= 400 && problems.push(`${r.status()}: ${r.url()}`));
  return problems;
}

test("forward, back and cold jump agree on every beat, and every request stays on its origin", async ({ page }) => {
  needs(1);
  test.setTimeout(300_000);
  const problems = watch(page);
  await open(page);
  const n = (await beats(page)).length;
  const shot = () => page.screenshot();

  const fwd: { state: Snapshot; png: Buffer }[] = [{ state: await snapshot(page), png: await shot() }];
  for (let i = 1; i < n; i++) {
    await page.keyboard.press("PageDown"); // plays the transition in real time
    await settled(page);
    expect(await index(page)).toBe(i);
    fwd.push({ state: await snapshot(page), png: await shot() });
  }
  for (let i = n - 2; i >= 0; i--) {
    await page.keyboard.press("PageUp");
    await settled(page);
    await same(page, await snapshot(page), fwd[i].state, `back to ${i}`);
    await samePicture(page, await shot(), fwd[i].png, `back to ${i}`);
  }
  const list = await beats(page);
  for (let i = 0; i < n; i++) {
    await open(page, `/${hashOf(list, i)}`);
    expect(await index(page)).toBe(i);
    await same(page, await snapshot(page), fwd[i].state, `cold ${i}`);
    await samePicture(page, await shot(), fwd[i].png, `cold ${i}`);
  }
  expect(problems, "self-hosted: no external, failed or erroring request").toEqual([]);
});

test("seek(i, 1) equals the rest state, and seek(i, p) is repeatable", async ({ page }) => {
  needs(1);
  await open(page);
  const n = (await beats(page)).length;
  for (let i = 0; i < n; i++) {
    await jump(page, i);
    const rest = await snapshot(page);
    await page.evaluate((i) => (window as any).__deck.seek(i, 0.5), i);
    await settled(page);
    const mid = await snapshot(page);
    await page.evaluate((i) => (window as any).__deck.seek(i, 1), i);
    await settled(page);
    await same(page, await snapshot(page), rest, `seek(${i}, 1)`);
    await page.evaluate((i) => (window as any).__deck.seek(i, 0.5), i);
    await settled(page);
    await same(page, await snapshot(page), mid, `seek(${i}, 0.5) twice`);
  }
});

test("the hash reflects the beat and a reload resumes there", async ({ page }) => {
  needs(3);
  await open(page);
  await page.keyboard.press("PageDown");
  await page.keyboard.press("PageDown");
  await settled(page);
  const hash = await page.evaluate(() => location.hash);
  expect(hash).toMatch(/^#\/[\w-]+\/\d+$/);
  await page.reload();
  await page.waitForFunction(() => (window as any).__deck);
  expect(await index(page)).toBe(2);
});

test("a hash that names no beat is ignored: a cold load starts at the first beat, an edit leaves the deck where it is", async ({ page }) => {
  const errors: string[] = [];
  needs(2);
  page.on("pageerror", (e) => errors.push(e.message));
  for (const bad of ["#/no-such-section/0", `#/${manifest[0].section}/99`, "#nonsense"]) {
    await open(page, `/${bad}`);
    expect(await index(page), bad).toBe(0);
    expect(await page.evaluate(() => location.hash), bad).toMatch(/^#\/[\w-]+\/0$/);
  }
  await page.keyboard.press("PageDown");
  await settled(page);
  await page.evaluate(() => (location.hash = "#/no-such-section/3"));
  await page.waitForTimeout(200);
  await settled(page);
  expect(await index(page)).toBe(1);
  expect(errors).toEqual([]);
});

test("a click during a transition completes it, then advances", async ({ page }) => {
  await open(page);
  const i = firstPlayed(await beats(page), 0.3); // long enough to press into
  test.skip(i < 0, "no beat has a played transition of 0.3 s or more");
  await jump(page, i - 1);
  await page.keyboard.press("PageDown");
  await page.keyboard.press("PageDown"); // mid-transition
  await settled(page);
  expect(await index(page)).toBe(i + 1);
});

test("a cold load is a real load, not a hash change on the open page", async ({ page }) => {
  needs(2);
  await open(page);
  await page.evaluate(() => ((window as any).__warm = true));
  const list = await beats(page);
  await open(page, `/${hashOf(list, 1)}`);
  expect(await page.evaluate(() => (window as any).__warm ?? false)).toBe(false);
  expect(await index(page)).toBe(1);
});
