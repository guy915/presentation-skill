// Builds the runtime from a fixture manifest (TALK_BEATS, see vite.config.ts)
// and serves a build to a browser context from disk, under http://fixture.local/:
// a talk the tests can't be, without a port. `base` serves it from a sub-path
// instead ("talk/" -> http://fixture.local/talk/), as GitHub Pages does, where
// anything asked for outside that path 404s.
import type { BrowserContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

export const FIXTURE = "http://fixture.local/";

export function buildFixture(manifest: string, outDir: string) {
  execFileSync("npx", ["vite", "build", "--logLevel", "error", "--outDir", outDir, "--emptyOutDir"], { env: { ...process.env, TALK_BEATS: manifest } });
}

export async function serveBuild(context: BrowserContext, dir: string, base = "") {
  await context.route(`${FIXTURE}**`, (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname);
    if (!path.startsWith(`/${base}`)) return route.fulfill({ status: 404 });
    let file = resolve(dir, path.slice(1 + base.length));
    if (existsSync(file) && statSync(file).isDirectory()) file = resolve(file, "index.html");
    return existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404 });
  });
}
