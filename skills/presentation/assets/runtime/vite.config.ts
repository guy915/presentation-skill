import { defineConfig, type Plugin } from "vite";
import { cpSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ports } from "./scripts/lib/ports.ts";

/** Test knobs, for building a talk this one isn't (test/helpers/fixture-build.ts,
 *  and `npm run test:runtime` on the fixture talk in test/fixtures/):
 *  TALK_BEATS=<file> builds that manifest in place of src/beats.ts, and
 *  TALK_SECTIONS=<file> that section registry in place of src/sections/index.ts. */
function swapSources(): Plugin {
  const swaps = [
    [resolve("src/beats.ts"), process.env.TALK_BEATS],
    [resolve("src/sections/index.ts"), process.env.TALK_SECTIONS],
  ] as const;
  return {
    name: "talk:swap-sources",
    enforce: "pre",
    load(id) {
      const to = swaps.find(([file, to]) => to && id.split("?")[0] === file)?.[1];
      if (to) return `export * from ${JSON.stringify(resolve(to))};\n`;
    },
  };
}

/** Test knob: TALK_PUBLIC=<dir> ships that folder's files in the build too,
 *  beside public/ (the fixture talk's media). */
function extraPublic(): Plugin {
  let outDir = "";
  return {
    name: "talk:extra-public",
    apply: "build",
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    writeBundle() {
      if (process.env.TALK_PUBLIC) cpSync(resolve(process.env.TALK_PUBLIC), outDir, { recursive: true });
    },
  };
}

/** <html lang> from talk.lang, written into the built HTML so it holds before any
 *  script runs; deck.ts and presenter.ts still set it at runtime (the dev server too). */
function htmlLang(): Plugin {
  return {
    name: "talk:html-lang",
    async transformIndexHtml(html) {
      const m = await import(`${pathToFileURL(resolve(process.env.TALK_BEATS ?? "src/beats.ts")).href}?lang=${Date.now()}`);
      const lang = String(m.talk?.lang ?? "en").replace(/[^\w-]/g, "");
      return html.replace(/<html(?=[\s>])/, `<html lang="${lang}"`);
    },
  };
}

// base "./": the build runs from any path, such as the GitHub Pages sub-path it is presented from.
export default defineConfig({
  base: "./",
  plugins: [swapSources(), extraPublic(), htmlLang()],
  server: { port: ports.dev, strictPort: true },
  preview: { port: ports.test, strictPort: true },
  build: { rollupOptions: { input: { main: "index.html", presenter: "presenter.html" } } },
});
