// Drives any talk through the window.__deck contract (RUNTIME.md "Test contract").
import type { Page } from "@playwright/test";

export interface BeatInfo { id: string; section: string; label: string; notes: string; kind: string; duration: number; transition: number }

/** Loads the deck (optionally at a hash / query) and waits for it to settle.
 *  Always a real load: a goto that differs only in its hash is a same-document
 *  navigation (a hashchange, not a cold load), so it goes via about:blank. */
export async function open(page: Page, at = "/") {
  if (at.includes("#")) await page.goto("about:blank");
  await page.goto(at);
  await page.waitForFunction(() => (window as any).__deck);
  await settled(page);
}

export const settled = (page: Page) => page.evaluate(() => (window as any).__deck.settled());
export const index = (page: Page): Promise<number> => page.evaluate(() => (window as any).__deck.index());
export const beats = (page: Page): Promise<BeatInfo[]> => page.evaluate(() => (window as any).__deck.beats);

/** Jumps (no transition) and waits for the beat to settle. */
export async function jump(page: Page, i: number) {
  await page.evaluate((i) => (window as any).__deck.go(i, { instant: true }), i);
  await settled(page);
}

/** Beat i's URL hash: its section and its place in that section. */
export const hashOf = (list: { section: string }[], i: number) =>
  `#/${list[i].section}/${list.slice(0, i).filter((b) => b.section === list[i].section).length}`;

/** How many fallbacks (a still, or a failed section's stand-in) show now. */
export const fallbacksShown = (page: Page): Promise<number> =>
  page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".rt-fallback")].filter((e) => !e.hidden).length);

/** The first beat whose played transition takes `min` seconds or more, or -1.
 *  `beforeLast`: only a beat with another beat after it. */
export const firstPlayed = (list: { transition: number }[], min: number, { beforeLast = false } = {}) =>
  list.findIndex((b, k) => k > 0 && b.transition >= min && (!beforeLast || k + 1 < list.length));

/** Opens the speaker view with S and waits for it to load; `deckFront` gives the deck the focus back. */
export async function speakerView(page: Page, deckFront = false) {
  const [view] = await Promise.all([page.context().waitForEvent("page"), page.keyboard.press("s")]);
  await view.waitForLoadState();
  if (deckFront) await page.bringToFront();
  return view;
}

/** Tells the speaker view what the deck would: beat i, its clock started `ago`
 *  seconds back (null: not started), at rest or not. */
export async function tell(deck: Page, i: number, ago: number | null, atRest = true) {
  const s = await deck.evaluate(() => (window as any).__deck.session);
  await deck.evaluate(
    ([i, ago, settled, s]) =>
      new BroadcastChannel(`talk:${location.pathname.replace(/[^/]*$/, "")}`).postMessage({ kind: "beat", index: i, started: ago === null ? 0 : Date.now() - (ago as number) * 1000, settled, s }),
    [i, ago, atRest, s] as const,
  );
}

/** Visits every beat at rest; `fn` sees each one. */
export async function eachBeat(page: Page, fn: (i: number, beat: BeatInfo) => Promise<void>) {
  const list = await beats(page);
  for (let i = 0; i < list.length; i++) {
    await jump(page, i);
    await fn(i, list[i]);
  }
}

export interface Snapshot { dom: string; canvases: string[] }

/** The present section's DOM plus every canvas's pixels: what "same state"
 *  means. Canvases come back as PNG data URLs, compared with the screenshot's
 *  tolerance (helpers/pixels.ts): antialiasing differs by a few pixels. */
export function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const root = document.querySelector("#stage > .slides > section.present")!;
    const present = root.cloneNode(true) as HTMLElement;
    // attribute order follows history (`style` arrives when a scene first sets
    // it, `hidden` comes and goes on stand-ins), not state: sort them everywhere
    for (const el of [present, ...present.querySelectorAll("*")]) {
      const attrs = [...el.attributes].map((a) => [a.name, a.value]).sort();
      for (const [n] of attrs) el.removeAttribute(n);
      for (const [n, v] of attrs) el.setAttribute(n, v);
    }
    // Read each canvas by drawing it into a scratch one: getContext("2d") fails
    // on a WebGL canvas and claims an untouched one for 2D. (A WebGL canvas
    // without preserveDrawingBuffer reads blank here; the screenshot still compares it.)
    const canvases = [...root.querySelectorAll("canvas")].map((c) => {
      if (!c.width || !c.height) return "empty";
      const scratch = document.createElement("canvas");
      scratch.width = c.width;
      scratch.height = c.height;
      scratch.getContext("2d")!.drawImage(c, 0, 0);
      return scratch.toDataURL("image/png");
    });
    return { dom: present.outerHTML.replace(/ style=""/g, ""), canvases };
  });
}
