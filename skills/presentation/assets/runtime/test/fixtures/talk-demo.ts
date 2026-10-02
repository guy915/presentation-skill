// A neutral talk with a real talk's shape, for the runtime's own tests
// (TALK_BEATS=test/fixtures/talk-demo.ts): two lobby beats (the speaker
// advances from one preshow beat onto another before the talk begins), six
// sections of different planned lengths, credits. Some sections are named in
// talk.sections, the others show their id in sentence case; talk.lang is not
// the default, so the build must write it.
import type { Beat, Talk } from "../../src/runtime/manifest.ts";

export const talk: Talk = {
  wpm: 27, // slow, so short notes plan a talk of about 17 minutes
  slot: 20,
  sections: { alpha: "Section alpha", beta: "Section beta", gamma: "Section gamma" },
  lang: "en-GB",
};

const beat = (section: string, id: string, notes: string, more: Partial<Beat> = {}): Beat => ({
  id, section, label: notes.split("\n")[0], job: notes.split("\n")[0], sees: notes.split("\n")[0], notes, ...more,
});

export const beats: Beat[] = [
  beat("lobby", "lobby", "Lobby one\nLorem ipsum dolor sit amet. [click]", { kind: "preshow" }),
  beat("lobby", "lobby-2", "Lobby two\nLorem ipsum dolor sit amet. [click]", { kind: "preshow" }),

  beat("opening", "b1", `Fixture beat 1
Lorem ipsum. Dolor sit amet consectetur, adipiscing elit sed do eiusmod Tempor incididunt ut labore et dolore magna aliqua lorem ipsum dolor sit amet.
Consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et. [click]`),
  beat("opening", "b2", `Fixture beat 2
Dolore magna aliqua lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod. [pause] Tempor incididunt ut labore et dolore magna. Aliqua lorem ipsum dolor sit. [click]`),
  beat("opening", "b3", `Fixture beat 3
Amet consectetur adipiscing elit sed do eiusmod tempor incididunt. Ut labore et dolore magna aliqua lorem. [click]`),

  beat("second-part", "b4", `Fixture beat 4
Ipsum dolor sit amet consectetur adipiscing elit sed. Do eiusmod tempor incididunt ut labore, et dolore, magna aliqua lorem, ipsum dolor sit amet consectetur.
Adipiscing elit sed do eiusmod tempor incididunt ut. [click]`),
  beat("second-part", "b5", `Fixture beat 5
Labore et dolore magna aliqua lorem. Ipsum dolor sit amet consectetur adipiscing elit sed, do eiusmod tempor incididunt ut labore et dolore magna aliqua lorem. [click]`),

  beat("alpha", "alpha", `Fixture beat 6
Ipsum dolor sit amet consectetur adipiscing elit sed do. Eiusmod tempor incididunt ut labore, et dolore magna. Aliqua lorem ipsum dolor sit, amet consectetur adipiscing elit sed.

[a stage direction] Do eiusmod tempor incididunt ut labore et dolore, magna aliqua lorem, ipsum dolor sit amet consectetur adipiscing elit sed. [click]`),
  beat("alpha", "alpha-2", `Fixture beat 7
Do eiusmod tempor incididunt. [pause] Ut labore et dolore magna. Aliqua lorem ipsum dolor sit amet consectetur. [click]`),
  beat("alpha", "b6", `Fixture beat 8
Adipiscing elit sed do eiusmod tempor incididunt. Ut labore et dolore magna aliqua lorem: ipsum dolor sit, amet consectetur adipiscing, elit sed do. [click]`),
  beat("alpha", "b7", `Fixture beat 9
Eiusmod tempor incididunt ut labore et dolore magna, aliqua lorem ipsum dolor sit amet consectetur adipiscing elit. [click]`),
  beat("alpha", "b8", `Fixture beat 10
Sed do eiusmod tempor incididunt, ut labore et dolore magna aliqua lorem ipsum. Dolor sit amet, consectetur adipiscing elit sed do eiusmod tempor. [click]`),

  beat("beta", "b9", `Fixture beat 11
Incididunt ut labore et dolore magna: aliqua lorem, ipsum dolor sit amet consectetur, adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore. [click]`),
  beat("beta", "b10", `Fixture beat 12
Magna aliqua lorem ipsum dolor, sit amet consectetur adipiscing elit sed do eiusmod tempor. [FILL a value] [click]`),
  beat("beta", "b11", `Fixture beat 13
Incididunt ut labore et dolore. Magna aliqua lorem ipsum dolor sit amet consectetur adipiscing elit sed. [click]`),
  beat("beta", "b12", `Fixture beat 14
Do eiusmod tempor incididunt ut labore et dolore. Magna aliqua lorem ipsum dolor sit amet consectetur adipiscing. [click]`),
  beat("beta", "b13", `Fixture beat 15
Elit sed do eiusmod tempor incididunt, ut labore, et dolore magna aliqua lorem. [click]`),

  beat("gamma", "b14", `Fixture beat 16
Ipsum dolor sit amet consectetur adipiscing elit sed. [pause] Do eiusmod. [click]`, { hold: 20 }),
  beat("gamma", "b15", `Fixture beat 17
Tempor incididunt ut labore et dolore magna aliqua, lorem ipsum dolor sit amet. [click]`, { hold: 30 }),
  beat("gamma", "b16", `Fixture beat 18
Consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna. [click]`, { hold: 20 }),
  beat("gamma", "b17", `Fixture beat 19
Aliqua lorem ipsum dolor sit amet consectetur adipiscing. [pause] Elit sed do eiusmod tempor incididunt ut labore et dolore. [click]`),

  beat("close", "b18", `Fixture beat 20
Magna aliqua lorem ipsum dolor sit amet consectetur. Adipiscing elit sed do eiusmod tempor incididunt. [click]`),
  beat("close", "b19", `Fixture beat 21
Ut labore. Et dolore magna aliqua lorem ipsum dolor. [click]`),
  beat("close", "b20", `Fixture beat 22
Sit? [click]`, { hold: 30 }),

  beat("credits", "credits", "Credits\nLorem ipsum dolor.", { kind: "credits" }),
];
