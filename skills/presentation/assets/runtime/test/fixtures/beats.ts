// A fixed manifest for the timing and beats tests: worked examples, not the talk.
import type { Beat } from "../../src/runtime/manifest.ts";

export const talk = { wpm: 150, slot: 2 };

export const beats: Beat[] = [
  { id: "lobby", section: "open", label: "Lobby", kind: "preshow", notes: "Doors open\nWelcome everyone, take a seat. [click]" },
  // 15 words at 150 wpm = 6 s; the cue line and [click]/[pause] are not words
  {
    id: "hook", section: "open", label: "Hook", job: "There is a question worth an hour.", sees: "One line of text; the click brings in a date.",
    notes: "The question\nOne two three four five [pause] six seven eight nine ten eleven twelve thirteen fourteen fifteen. [click]",
  },
  // 30 words = 12 s, plus a 10 s hold = 22 s
  {
    id: "clip", section: "body", label: "Clip", job: "It already happened once.", hold: 10, assets: ["media/a.mp4"], fallback: "media/a.jpg",
    notes: "Watch this\n" + Array(28).fill("word").join(" ") + " [FILL year] [CONFIRM source] [TODO number] [FILL name] [click]",
  },
  { id: "thanks", section: "end", label: "Credits", kind: "credits", notes: "Credits\nThanks to everyone who helped." },
];
