// Shared by the Node scripts: build, serve the build, drive it with Playwright.
import { chromium, type Browser, type Page } from "@playwright/test";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ports } from "./ports.ts";
import { talk } from "./talk.ts";
import { stageSize } from "../../src/runtime/manifest.ts";

/** The stage in stage px (talk.aspect): every frame the scripts capture is this size. */
export const STAGE = stageSize(talk);

/** The deck's beats as window.__deck reports them. */
export interface DeckBeat { id: string; label: string; duration: number; transition: number }

// Scripts build into their own folder, never dist/: npm test serves dist/.
const BUILD = "out/build";

/** Builds, serves it on ports.scripts, launches Chromium, runs fn, cleans up.
 *  With `base`, drives a deck already served there instead (no build, no server). */
export async function withDeck<T>(fn: (deck: { browser: Browser; base: string }) => Promise<T>, { base }: { base?: string } = {}): Promise<T> {
  let server: ChildProcess | undefined;
  if (!base) {
    execFileSync("npx", ["vite", "build", "--logLevel", "error", "--outDir", BUILD, "--emptyOutDir"], { stdio: "inherit" });
    server = spawn(resolve("node_modules/.bin/vite"), ["preview", "--outDir", BUILD, "--port", String(ports.scripts), "--strictPort"], { stdio: "ignore" });
    base = `http://localhost:${ports.scripts}/`;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  const browser = await chromium.launch();
  try {
    return await fn({ browser, base });
  } finally {
    await browser.close();
    server?.kill();
  }
}

/** A page on the deck at the stage's size, ready. */
export async function openDeck(browser: Browser, base: string): Promise<Page> {
  const page = await browser.newPage({ viewport: STAGE, reducedMotion: "no-preference" });
  await page.goto(base);
  await page.waitForFunction(() => (window as any).__deck);
  await page.evaluate(() => (window as any).__deck.settled());
  return page;
}

export const deckBeats = (page: Page): Promise<DeckBeat[]> => page.evaluate(() => (window as any).__deck.beats);

export const seek = (page: Page, i: number, p: number) =>
  page.evaluate(([i, p]) => ((window as any).__deck.seek(i, p), (window as any).__deck.settled()), [i, p]);

export const fileUrl = (path: string) => `http://files.local${encodeURI(path)}`;

/** A page at `viewport` showing `html`, its images (via fileUrl) served from
 *  disk and loaded. Throws naming any image that failed. Waits on load events,
 *  not img.decode(): Chromium throws EncodingError on 30+ full-size frames at
 *  once. decoding="sync" makes the screenshot or PDF decode each image as it
 *  paints it, so none is left blank. */
async function htmlPage(browser: Browser, html: string, viewport: { width: number; height: number }) {
  const page = await browser.newPage({ viewport });
  await page.route("http://files.local/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/page") return route.fulfill({ contentType: "text/html", body: html });
    const path = decodeURIComponent(url.pathname);
    return existsSync(path) ? route.fulfill({ path }) : route.fulfill({ status: 404 });
  });
  await page.goto("http://files.local/page");
  const broken = await page.evaluate(() =>
    Promise.all(
      [...document.images].map((i) => {
        i.decoding = "sync";
        return i.complete ? i : new Promise<HTMLImageElement>((r) => (i.onload = i.onerror = () => r(i)));
      }),
    ).then((all) => all.filter((i) => !i.naturalWidth).map((i) => decodeURI(i.src))),
  );
  if (broken.length) throw new Error(`images that did not load: ${broken.join(", ")}`);
  return page;
}

/** Renders `html` (images via fileUrl) at `width` and screenshots it to `out`. */
export async function renderHtml(browser: Browser, html: string, out: string, { width = 1940, filter = "", deficiency = "" } = {}) {
  const page = await htmlPage(browser, html, { width, height: 400 });
  if (filter) await page.addStyleTag({ content: `img { filter: ${filter}; }` });
  if (deficiency) await (await page.context().newCDPSession(page)).send("Emulation.setEmulatedVisionDeficiency", { type: deficiency as "deuteranopia" });
  await page.screenshot({ path: out, fullPage: true });
  await page.close();
}

/** Prints `html` (images via fileUrl) to the PDF `out`, laid out at `viewport`, with page.pdf `opts`. */
export async function htmlPdf(browser: Browser, html: string, out: string, viewport: { width: number; height: number }, opts: Parameters<Page["pdf"]>[0] = {}) {
  const page = await htmlPage(browser, html, viewport);
  await page.pdf({ path: out, printBackground: true, ...opts });
  await page.close();
}
