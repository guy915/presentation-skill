// The npm tools, on the fixed manifest in test/fixtures/beats.ts or on the
// fixture talk's build (test/fixtures/engine.ts): `timing` (speech at a rate plus holds, per beat, per section,
// total; with --rehearsal, planned against actual), `beats` (the manifest's
// block in beats.md), `screening` (frames at each spoken sentence), `handout`
// (the PDF to share) and the frame renderer that shots, screening and handout share.
import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { words, seconds, sentences, spoken, restLine, mmss, printed, cue, placeHold, type Beat, type RehearsalFile } from "../../src/runtime/manifest.ts";
import { ports } from "../../scripts/lib/ports.ts";
import { renderHtml, fileUrl } from "../../scripts/lib/deck.ts";
import { beats } from "../fixtures/beats.ts";
import { beats as talkBeats } from "../helpers/manifest";

const node = (script: string, ...args: string[]) => execFileSync("node", [`scripts/${script}`, "--manifest", "test/fixtures/beats.ts", ...args], { encoding: "utf8" });

test.describe("timing", () => {
  test("words skip the cue line and bracketed markers; preshow and credits take no time; m:ss rounds once", () => {
    expect(words(beats[1].notes)).toBe(15);
    expect(words(beats[2].notes)).toBe(28);
    expect(seconds(beats[1])).toBe(6);
    expect(seconds(beats[1], 100)).toBe(9);
    expect(seconds(beats[0])).toBe(0); // preshow
    expect(seconds(beats[3])).toBe(0); // credits
    expect(mmss(59.6)).toBe("1:00");
    expect(mmss(119.4)).toBe("1:59");
  });

  test("prints per beat, per section, speech and holds apart, the total, the slot share and the markers left", () => {
    const out = node("timing.ts");
    expect(out).toMatch(/hook\s+15 words\s+0:06/);
    expect(out).toMatch(/clip\s+28 words \+ 10 s hold\s+0:21/); // 11.2 s + 10 s
    expect(out).toMatch(/section open\s+0:06/);
    expect(out).toMatch(/thanks\s+\(credits, not counted\)\s+0:00/);
    expect(out).toMatch(/speech\s+0:17/); // 43 words at 150 wpm = 17.2 s
    expect(out).toMatch(/holds\s+0:10/);
    expect(out).toMatch(/total\s+0:27 at 150 wpm/);
    expect(out).toMatch(/23% of a 2 min slot/);
    expect(out).toMatch(/markers: 2 FILL, 1 CONFIRM, 1 TODO/);
    // flags override the manifest's talk settings
    const fast = node("timing.ts", "--wpm", "100", "--slot", "1");
    expect(fast).toMatch(/total\s+0:36 at 100 wpm/); // 43 words = 25.8 s, + 10 s
    expect(fast).toMatch(/60% of a 1 min slot/);
  });
});

test("timing --rehearsal: planned against actual per beat, per section and in total, off-plan beats flagged, and the measured rate", async ({}, info) => {
  // hook: 15 words, planned 6 s, took 7 s. clip: 28 words + 10 s hold, planned 21.2 s, took 30 s (+42 %, +8.8 s).
  const r: RehearsalFile = {
    started: "2026-09-30T12:00:00.000Z", wpm: 150, slot: 2, total: 41,
    beats: [
      { id: "lobby", seconds: 0, words: 6, planned: 0 },
      { id: "hook", seconds: 7, words: 15, planned: 6 },
      { id: "clip", seconds: 30, words: 28, planned: 21.2 },
      { id: "thanks", seconds: 4, words: 4, planned: 0 },
    ],
  };
  const file = info.outputPath("rehearsal.json");
  writeFileSync(file, JSON.stringify(r));
  const out = node("timing.ts", "--rehearsal", file);
  expect(out).toMatch(/hook\s+0:06\s+0:07\s+\+0:01\n/); // 1 s off: within plan
  expect(out).toMatch(/clip\s+0:21\s+0:30\s+\+0:09\s+<- off by 42%/);
  expect(out).toMatch(/thanks\s+0:00\s+0:04\s+\+0:04\n/); // credits: never flagged
  expect(out).toMatch(/section open\s+0:06\s+0:07/);
  expect(out).toMatch(/section body\s+0:21\s+0:30/);
  expect(out).toMatch(/total\s+0:27\s+0:41\s+\+0:14\s+\(34% of a 2 min slot\)/);
  // 43 words over 7 + (30 - 10) s of speaking = 96 wpm, more than 5 % under talk.wpm
  expect(out).toMatch(/rate: 43 words in 0:27 of speaking = 96 wpm \(talk\.wpm 150\)/);
  expect(out).toMatch(/set talk\.wpm to 96/);
  // at a rate within 5 %: no suggestion
  expect(node("timing.ts", "--rehearsal", file, "--wpm", "100")).not.toMatch(/set talk\.wpm/);
  // without the flag: the plan, as before
  expect(node("timing.ts")).toMatch(/total\s+0:27 at 150 wpm/);
});

test.describe("beats", () => {
  test("creates beats.md with the block, or appends the block to a file without markers", async ({}, info) => {
    const file = info.outputPath("beats.md");
    node("beats.ts", "--out", file);
    const md = readFileSync(file, "utf8");
    expect(md).toContain("<!-- beats:start -->");
    expect(md).toContain("<!-- beats:end -->");
    expect(md).toMatch(/open · hook · Hook/);
    for (const text of ["There is a question worth an hour.", "One line of text; the click brings in a date.", "The question", "media/a.mp4", "media/a.jpg"]) expect(md).toContain(text);
    expect(md).toMatch(/15 words \+ 0 s = 0:06/);
    expect(md).toMatch(/28 words \+ 10 s = 0:21/);
    expect(md).toMatch(/total\D+0:27/);
    writeFileSync(file, "# Header only\n");
    node("beats.ts", "--out", file);
    const appended = readFileSync(file, "utf8");
    expect(appended.startsWith("# Header only\n")).toBe(true);
    expect(appended).toContain("<!-- beats:end -->");
  });

  test("rewrites only the block and keeps the hand-written text around it", async ({}, info) => {
    const file = info.outputPath("beats.md");
    writeFileSync(file, "# My talk\n\nThroughline: a hand-written header.\n\n<!-- beats:start -->\nstale\n<!-- beats:end -->\n\nFooter notes.\n");
    node("beats.ts", "--out", file);
    const md = readFileSync(file, "utf8");
    expect(md.startsWith("# My talk\n\nThroughline: a hand-written header.\n\n<!-- beats:start -->\n")).toBe(true);
    expect(md.endsWith("<!-- beats:end -->\n\nFooter notes.\n")).toBe(true);
    expect(md).not.toContain("stale");
    node("beats.ts", "--out", file);
    expect(readFileSync(file, "utf8")).toBe(md); // idempotent
  });
});

test.describe("screening", () => {
  test("sentences start at the talk's rate; brackets are not spoken, even with sentences inside them; timing counts the same words", () => {
    expect(sentences("Cue\nTwo more bars grow in. [pause] Nothing here depends on how you got to this beat. [click]", 150)).toEqual([
      { t: 0, text: "Two more bars grow in." },
      { t: 2, text: "Nothing here depends on how you got to this beat." }, // 5 words at 150 wpm
    ]);
    const notes =
      "The probe\nThe probe launched in 1977. [Source: NASA JPL. Voyager fact sheet, 2023.] It is still sending data. " +
      "[CONFIRM the date. Ask Ana.]\n[Q&A if asked: yes. It runs on plutonium.] [pause] Nobody expected that. [click]";
    const s = sentences(notes, 150);
    expect(s.map((x) => x.text)).toEqual(["The probe launched in 1977.", "It is still sending data.", "Nobody expected that."]);
    expect(s.map((x) => x.t)).toEqual([0, 2, 4]); // 5 + 5 words at 150 wpm
    expect(s.reduce((a, x) => a + spoken(x.text), 0)).toBe(words(notes));
  });

  test("each sheet's header says how much of the speech runs over a picture already at rest", () => {
    // sentences start at 0, 2 and 4 s (5 words each at 150 wpm)
    const said = sentences("Cue\nOne two three four five. Six seven eight nine ten. Eleven twelve thirteen fourteen fifteen.", 150);
    expect(restLine(said, 3)).toBe("at rest through 1 of 3 sentences"); // the picture settles at 3 s: only the one at 4 s
    expect(restLine(said, 0)).toBe("at rest through 3 of 3 sentences"); // a cut: at rest from the click
    expect(restLine(said, 10)).toBe("at rest through 0 of 3 sentences");
    expect(restLine(sentences("Cue\n[pause]", 150), 1)).toBe("no spoken sentences");
  });

  test("the hold sits where the script puts it and the sentences after it start that much later, as timing counts it", () => {
    const beat = (notes: string, extra: Partial<Beat> = {}): Beat => ({ id: "b", section: "s", label: "B", hold: 10, notes, ...extra });
    // a played sequence the speaker watches, then explains: the picture is at rest through every sentence
    const played = beat("Watch\nWatch the wave. [let it play] One two three four five. Six seven eight nine ten. [click]");
    expect(placeHold(played)).toEqual({ at: 3, s: 10 });
    const said = sentences(played.notes, 150, placeHold(played));
    expect(said.map((x) => x.t)).toEqual([0, 11.2, 13.2]); // 3 words (1.2 s), the 10 s hold, then 5 words (2 s)
    expect(restLine(said, 10)).toBe("at rest through 2 of 3 sentences");
    expect(said[2].t + (spoken(said[2].text) / 150) * 60).toBeCloseTo(seconds(played)); // ends where timing plans the beat
    // [let it play] wins over an earlier [pause]; [pause] alone places it; a clip that speaks holds from the click; else the room answers at the end
    expect(placeHold(beat("C\nOne. [pause] Two three. [let it play] Four. [click]")).at).toBe(3);
    expect(placeHold(beat("C\nOne two. [pause] Three. [click]")).at).toBe(2);
    expect(placeHold(beats[2])).toEqual({ at: 0, s: 10 });
    expect(sentences(beats[2].notes, 150, placeHold(beats[2]))[0].t).toBe(10);
    expect(placeHold(beat("C\nAny questions so far? [click]"))).toEqual({ at: 4, s: 10 });
    expect(placeHold({ ...played, kind: "credits" }).s).toBe(0); // credits take no time
  });

  test("writes one sheet per content beat and one PDF", () => {
    test.setTimeout(180_000);
    execFileSync("node", ["scripts/screening.ts", "--base", `http://localhost:${ports.test}/`], { stdio: "ignore" }); // the test server's build
    const content = talkBeats.map((b, i) => ({ b, i })).filter(({ b }) => (b.kind ?? "content") === "content");
    const sheets = readdirSync("out/screening").filter((f) => f.endsWith(".png")).sort();
    expect(sheets).toEqual(content.map(({ b, i }) => `${String(i + 1).padStart(2, "0")}-${b.id}.png`));
    expect(existsSync("out/screening.pdf")).toBe(true);
    const pdf = readFileSync("out/screening.pdf", "latin1");
    expect((pdf.match(/\/Type\s*\/Page\b/g) ?? []).length).toBe(content.length);
  });
});

test.describe("handout", () => {
  test("prints the spoken words only: every bracket goes, paragraphs stay, no space before punctuation", () => {
    const notes = "The probe\nIt launched in 1977 [Source: NASA]. [pause] It still sends data. [TODO check]\n\n[CONFIRM date] Nobody expected that. [click]";
    expect(printed(notes)).toEqual(["It launched in 1977. It still sends data.", "Nobody expected that."]);
    for (const b of talkBeats) expect(printed(b.notes).join(" "), b.id).not.toMatch(/[[\]]/);
  });

  test("builds one PDF: two content beats to a page with cue and script, the credits frames last; --no-notes: one frame to a page", () => {
    test.setTimeout(180_000);
    const base = `http://localhost:${ports.test}/`; // the test server's build
    const shown = talkBeats.filter((b) => (b.kind ?? "content") !== "preshow");
    const content = talkBeats.filter((b) => (b.kind ?? "content") === "content");
    const pages = () => (readFileSync("out/handout.pdf", "latin1").match(/\/Type\s*\/Page\b/g) ?? []).length;
    execFileSync("node", ["scripts/handout.ts", "--base", base], { stdio: "ignore" });
    expect(pages()).toBe(Math.ceil(shown.length / 2));
    // the PDF's own text, where poppler's pdftotext is installed
    let text = "";
    try {
      text = execFileSync("pdftotext", ["out/handout.pdf", "-"], { encoding: "utf8" });
    } catch {}
    if (text) {
      expect(text).toContain(cue(content[0].notes));
      expect(text).not.toContain("[click]");
    }
    execFileSync("node", ["scripts/handout.ts", "--base", base, "--no-notes"], { stdio: "ignore" });
    expect(pages()).toBe(shown.length);
  });
});

test("a frame that fails to load fails the sheet, not a blank tile", async ({ browser }, info) => {
  const html = `<!doctype html><img src="${fileUrl(resolve("out/missing.jpg"))}">`;
  await expect(renderHtml(browser, html, info.outputPath("broken.png"))).rejects.toThrow(/missing\.jpg/);
});
