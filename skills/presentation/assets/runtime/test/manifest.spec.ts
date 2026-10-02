// The manifest and what it ships. Notes are the spoken script: every beat has
// a cue line and a script, and none carries the talk's build history (a phrase
// that only looks like history goes in NOTES_ALLOW, test/allow.ts, with its
// reason). Paths are relative: the talk is presented from a GitHub Pages
// sub-path, where a root-absolute "/…" path loads from the domain's root and
// 404s. talk.lang sets <html lang> in the deck and the speaker view.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { beats, talk, needs } from "./helpers/manifest";
import { cue, script } from "../src/runtime/manifest.ts";
import { open, speakerView } from "./helpers/deck";
import { serveBuild, FIXTURE } from "./helpers/fixture-build";
import { leaks, repo } from "./helpers/notes";
import { NOTES_ALLOW } from "./allow";

test("every content beat states its job in one sentence", () => {
  const missing = beats.filter((b) => (b.kind ?? "content") === "content" && !b.job?.trim()).map((b) => b.id);
  expect(missing).toEqual([]);
  const long = beats.filter((b) => b.job && (b.job.match(/[.!?](\s|$)/g) ?? []).length > 1).map((b) => b.id);
  expect(long, "one sentence").toEqual([]);
});

test("every beat has a cue line and a script; every beat but the last ends with exactly one [click]", () => {
  // a preshow beat may be just a cue line plus [click]
  const missing = beats.filter((b) => !cue(b.notes) || (!script(b.notes) && b.kind !== "preshow")).map((b) => b.id);
  expect(missing).toEqual([]);
  const last = beats.length - 1;
  const bad = beats.flatMap((b, i) => {
    const n = (b.notes.match(/\[click\]/g) ?? []).length;
    if (i === last) return n ? [`${b.id}: [click] on the last beat`] : [];
    if (n !== 1) return [`${b.id}: ${n} [click]s`];
    return /\[click\]\s*$/.test(b.notes) ? [] : [`${b.id}: [click] not at the very end`];
  });
  expect(bad).toEqual([]);
});

test("beat ids are unique and each section's beats are consecutive", () => {
  const ids = beats.map((b) => b.id);
  expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  const order = beats.map((b) => b.section).filter((s, i, a) => a[i - 1] !== s);
  expect(order.filter((s, i) => order.indexOf(s) !== i)).toEqual([]);
});

test("no note contains build history, and every NOTES_ALLOW entry has its reason", () => {
  const talkRepo = repo();
  const found = beats.flatMap((b) => leaks(b.notes, talkRepo, NOTES_ALLOW).map((l) => `${b.id}: ${l}`));
  expect(found).toEqual([]);
  expect(Object.entries(NOTES_ALLOW).filter(([, why]) => !why.trim())).toEqual([]);
});

test("manifest paths (assets, fallback) and section markup have no root-absolute path", async ({ page }) => {
  const bad = beats.flatMap((b) => [...(b.assets ?? []), ...(b.fallback ? [b.fallback] : [])].filter((p) => p.startsWith("/")).map((p) => `${b.id}: ${p}`));
  await open(page);
  bad.push(
    ...(await page.evaluate(() => {
      const found: string[] = [];
      for (const el of document.getElementById("stage")!.querySelectorAll("*")) {
        for (const a of ["src", "href", "poster", "data"]) if (el.getAttribute(a)?.startsWith("/")) found.push(`${el.tagName.toLowerCase()} ${a}="${el.getAttribute(a)}"`);
        const css = el.tagName === "STYLE" ? el.textContent! : (el.getAttribute("style") ?? "");
        for (const m of css.match(/url\(\s*["']?\/[^)]*\)/g) ?? []) found.push(`${el.tagName.toLowerCase()}: ${m}`);
      }
      return found;
    })),
  );
  expect(bad).toEqual([]);
});

test("served from a sub-path, the deck and the speaker view load everything from under it", async ({ context }) => {
  needs(1);
  await serveBuild(context, "dist", "talk/");
  const problems: string[] = [];
  context.on("request", (r) => {
    const url = new URL(r.url());
    if (url.origin === new URL(FIXTURE).origin && !url.pathname.startsWith("/talk/")) problems.push(`outside the sub-path: ${url.pathname}`);
  });
  // a failed section asks for its rest stills, which exist once `npm run shots` has run: a 404 there is the designed fallback
  context.on("response", (r) => r.status() >= 400 && !new URL(r.url()).pathname.startsWith("/talk/rest/") && problems.push(`${r.status()}: ${r.url()}`));
  const page = await context.newPage();
  await page.goto(`${FIXTURE}talk/`);
  await page.waitForFunction(() => (window as any).__deck);
  const count: number = await page.evaluate(() => (window as any).__deck.count);
  for (let i = 1; i < count; i++) await page.evaluate((i) => (window as any).__deck.go(i, { instant: true }), i);
  await page.evaluate(() => (window as any).__deck.go(0, { instant: true }));
  expect(await page.evaluate(() => [...document.fonts].filter((f) => f.status !== "loaded").map((f) => f.family)), "fonts").toEqual([]);
  const view = await speakerView(page);
  expect(new URL(view.url()).pathname).toBe("/talk/presenter.html");
  await expect(view.locator("#label")).toHaveText(cue(beats[0].notes));
  await view.waitForFunction(() => (document.getElementById("preview") as HTMLIFrameElement).contentWindow?.hasOwnProperty("__deck"));
  expect(problems).toEqual([]);
});

test("<html lang> follows talk.lang: written into the build, and set in the deck and the speaker view", async ({ page }) => {
  const lang = talk.lang ?? "en";
  for (const f of ["index.html", "presenter.html"]) {
    expect(readFileSync(f, "utf8"), `${f} leaves the language to the manifest`).not.toMatch(/<html[^>]*\blang=/);
    expect(readFileSync(`dist/${f}`, "utf8"), `dist/${f}`).toMatch(new RegExp(`<html lang="${lang}"`));
  }
  await open(page);
  expect(await page.evaluate(() => document.documentElement.lang)).toBe(lang);
  await page.goto("/presenter.html");
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(lang);
});
