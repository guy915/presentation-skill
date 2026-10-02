// The manifest the scripts and the tests read: src/beats.ts, or the file
// TALK_BEATS names (a test knob, as in vite.config.ts), so they read the
// manifest the build was made from.
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Beat, Talk } from "../../src/runtime/manifest.ts";

const m = (await import(pathToFileURL(resolve(process.env.TALK_BEATS ?? "src/beats.ts")).href)) as { beats: Beat[]; talk: Talk };

export const beats: Beat[] = m.beats;
export const talk: Talk = m.talk;
