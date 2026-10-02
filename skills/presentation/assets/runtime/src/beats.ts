// THE BEAT MANIFEST: one entry per click, in order. Every tool reads this.
// Schema: src/runtime/manifest.ts.
import type { Beat, Talk } from "./runtime/manifest.ts";

/** Speaking rate (words per minute) and slot (minutes), which `npm run timing` reads (its flags override them),
 *  and the talk's language (sets <html lang>). Set all three for the talk. The speaker view's strip names each
 *  section by its id in sentence case; to name one yourself: `sections: { <id>: "<name>" }`. */
export const talk: Talk = { wpm: 150, slot: 10, lang: "en" };

export const beats: Beat[] = [];
