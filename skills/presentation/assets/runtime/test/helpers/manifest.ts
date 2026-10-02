// The manifest the suite checks: the talk's own (src/beats.ts), or the
// fixture talk TALK_BEATS names, which `npm run test:runtime` builds and
// serves (playwright.config.ts). A check that needs more beats than the talk
// has skips, saying so.
import { test } from "@playwright/test";
import { beats } from "../../scripts/lib/talk.ts";

export { beats, talk } from "../../scripts/lib/talk.ts";

/** Skips the test while the talk has fewer than `n` beats. */
export const needs = (n: number) => test.skip(beats.length < n, `needs ${n} beat${n === 1 ? "" : "s"}; the talk has ${beats.length}`);
