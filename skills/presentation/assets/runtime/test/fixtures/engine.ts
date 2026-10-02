// The fixture talk the runtime's own suite builds and runs the talk suite on
// (`npm run test:runtime` sets TALK_BEATS to this file, TALK_SECTIONS to
// test/fixtures/sections/index.ts and TALK_PUBLIC to out/fixture-media/, the
// media test/helpers/fixture-media.ts makes).
// Neutral on purpose: one section with a played transition of 1 s or more, a
// canvas with a fallback still, a clip with its poster, and a placeholder.
import type { Beat, Talk } from "../../src/runtime/manifest.ts";

export const talk: Talk = { wpm: 150, slot: 10, lang: "en" };

export const beats: Beat[] = [
  {
    id: "fixture-1",
    section: "fixture",
    label: "Fixture beat 1",
    job: "A heading fades in.",
    sees: "A heading fades in.",
    notes: `Fixture beat 1
A neutral line of script for the first fixture beat. [click]`,
  },
  {
    id: "fixture-2",
    section: "fixture",
    label: "Fixture beat 2",
    job: "Bars grow on a canvas.",
    sees: "Three grey bars grow on a canvas.",
    notes: `Fixture beat 2
A neutral line of script for the second fixture beat. [click]`,
    fallback: "fixture/fallback.png",
  },
  {
    id: "fixture-3",
    section: "fixture",
    label: "Fixture beat 3",
    job: "A clip plays and rests on its last frame.",
    sees: "A short test clip plays beside the bars.",
    notes: `Fixture beat 3
A neutral line of script for the third fixture beat. [click]`,
    hold: 2.4,
    assets: ["fixture/clip.webm"],
  },
  {
    id: "fixture-4",
    section: "fixture",
    label: "Fixture beat 4",
    job: "A placeholder box appears.",
    sees: "A grey placeholder box.",
    notes: `Fixture beat 4
A neutral line of script for the last fixture beat.`,
  },
];
