// The beat manifest's schema and the timing rules every tool shares (the
// engine, the speaker view, `npm run timing`, `npm run beats`, screening, handout).
// Erasable TypeScript only: Node runs this file directly (type stripping).

export interface Beat {
  /** Unique, stable id (used in file names and ?fallback=). */
  id: string;
  /** Section id: consecutive beats with the same section form one scene. */
  section: string;
  /** Short name for contact sheets and the speaker view. */
  label: string;
  /** The one read the audience takes in, as one sentence. Required for content beats. */
  job?: string;
  /** What the audience sees, and what the click changes. Shown as the placeholder until the scene exists. */
  sees?: string;
  /** Line 1: the cue (the point, in a few words). Then the full spoken
   *  script, ending in exactly one `[click]` where the next beat lands (the
   *  last beat has none; a sentence the click interrupts continues in the
   *  next beat's notes). Other bracketed stage directions ([pause]) are not
   *  spoken; [FILL …], [CONFIRM …] and [TODO …] mark what is still missing. */
  notes: string;
  /** Silence beyond ordinary pauses, which the rate already includes: a clip
   *  that speaks, a played sequence the speaker waits for rather than talks
   *  over, answers from the room, a scripted silence. Seconds. */
  hold?: number;
  /** "preshow" and "credits" count as 0 s in the timing. */
  kind?: "content" | "preshow" | "credits";
  /** Media this beat uses (paths under public/); clips here preload a beat ahead. */
  assets?: string[];
  /** A still image (path under public/) that stands in for the live scene when forced (?fallback=) or when its section fails. */
  fallback?: string;
}

/** Talk-level settings (src/beats.ts exports one as `talk`). */
export interface Talk {
  /** Speaking rate, words per minute. */
  wpm: number;
  /** The slot, in minutes. */
  slot: number;
  /** The talk's language, a BCP 47 tag ("en", "nl", "pt-BR"): sets <html lang> for hyphenation, quotes and screen readers. Default "en". */
  lang?: string;
  /** Sections heavy enough (WebGL, big canvases) that the speaker view
   *  shows their rest stills instead of rendering them a second time. */
  heavy?: string[];
  /** The screen's shape, "w:h": "16:9" (default), "4:3" (older projectors),
   *  "16:10", "21:9" (LED walls), or any other. The stage is designed at it. */
  aspect?: string;
  /** Display names for the speaker view's talk strip, by section id:
   *  { "part-a": "Part A" }. A section left out shows its id
   *  in sentence case ("second-part" reads "Second part"). */
  sections?: Record<string, string>;
}

/** The keys that move the deck (KeyboardEvent.key values), in the audience
 *  window and from the speaker view. A presentation pointer sends PageDown and
 *  PageUp; F (fullscreen) and S (speaker view) are the set-up keys. */
export const KEYS = {
  next: new Set([" ", "PageDown", "ArrowRight", "ArrowDown"]),
  prev: new Set(["PageUp", "ArrowLeft", "ArrowUp"]),
};

/** How far ahead of plan (seconds) counts as ahead. */
export const AHEAD_S = 60;

/** The speaker view's pace: `arrive` and `leave` are the planned times (s) at
 *  arrival at this beat and at its end. Behind: the clock is past the beat's
 *  planned end. Ahead: it is AHEAD_S or more before the planned arrival.
 *  Over: past the slot. `by` is the gap in seconds. */
export function pace(elapsed: number, arrive: number, leave: number, slot: number, started: boolean): { state: "idle" | "on" | "behind" | "ahead" | "over"; by: number } {
  if (!started) return { state: "idle", by: 0 };
  if (elapsed > slot) return { state: "over", by: elapsed - slot };
  if (elapsed > leave) return { state: "behind", by: elapsed - leave };
  if (arrive - elapsed >= AHEAD_S) return { state: "ahead", by: arrive - elapsed };
  return { state: "on", by: 0 };
}

/** The stage in stage px: always 1080 lines, so the type floor keeps its
 *  meaning, and as wide as the talk's aspect makes it (even, for video
 *  encoders). Everything that draws, measures or records the stage reads it here. */
export function stageSize(talk: Pick<Talk, "aspect"> = {}): { width: number; height: number } {
  const m = (talk.aspect ?? "16:9").match(/^\s*(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)\s*$/);
  if (!m || !+m[1] || !+m[2]) throw new Error(`talk.aspect "${talk.aspect}" is not "w:h" (e.g. "16:9", "4:3")`);
  const height = 1080;
  return { width: 2 * Math.round((height * +m[1]) / +m[2] / 2), height };
}

/** A section's name on the speaker view's talk strip: talk.sections, else
 *  its id in sentence case ("second-part" -> "Second part"). */
export function sectionName(id: string, talk: Pick<Talk, "sections"> = {}): string {
  const named = talk.sections?.[id];
  if (named) return named;
  const words = id.replace(/[-_\s]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The talk's section runs (consecutive beats that share a section), each
 *  with its beats [from, to), its planned start and its planned seconds. */
export function sectionRuns(beats: Beat[], wpm = WPM): { section: string; from: number; to: number; start: number; planned: number }[] {
  const runs: { section: string; from: number; to: number; start: number; planned: number }[] = [];
  let t = 0;
  beats.forEach((b, i) => {
    const s = seconds(b, wpm);
    const last = runs[runs.length - 1];
    if (last && last.section === b.section) {
      last.to = i + 1;
      last.planned += s;
    } else runs.push({ section: b.section, from: i, to: i + 1, start: t, planned: s });
    t += s;
  });
  return runs;
}

export const WPM = 150;

/** The first line of the notes. */
export const cue = (notes: string) => notes.trim().split("\n")[0].trim();

/** Everything after the cue line. */
export const script = (notes: string) => notes.trim().split("\n").slice(1).join("\n").trim();

/** A script as the speaker reads it: spoken words, the [click] that ends
 *  it, bracketed stage directions ([pause]) and markers of what is still
 *  missing ([FILL …], [CONFIRM …], [TODO …]), which are shown loud, not dimmed. */
export type Segment = { kind: "say" | "click" | "dir" | "mark"; text: string };
const MARKER = /^\[(FILL|CONFIRM|TODO)\b/;
export const segments = (text: string): Segment[] =>
  text
    .split(/(\[[^\]]*\])/)
    .filter(Boolean)
    .map((t) => ({
      kind: t === "[click]" ? "click" : MARKER.test(t) ? "mark" : t.startsWith("[") && t.endsWith("]") ? "dir" : "say",
      text: t,
    }));

/** How the speaker view shows a beat of `section`: its rest still for a
 *  heavy section (unless ?preview=live), or everything as stills with ?preview=still. */
export const previewMode = (section: string, talk: Pick<Talk, "heavy">, param: string | null): "live" | "still" =>
  param === "live" || param === "still" ? param : talk.heavy?.includes(section) ? "still" : "live";

/** What is said aloud in a stretch of script: everything in brackets goes
 *  (stage directions like [pause], [click], markers, sources, even with full
 *  stops inside), line breaks stay. The one definition of "spoken" that
 *  timing and screening share. */
export const said = (text: string) =>
  text
    .replace(/\[[^\]]*\]/g, " ")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .join("\n");

/** A script as a handout prints it: the spoken words (said()) in paragraphs
 *  (a blank line in the notes starts one), with no space left before
 *  punctuation where a bracket stood. */
export const printed = (notes: string) =>
  said(script(notes))
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").replace(/\s+([.,;:!?…])/g, "$1").trim())
    .filter(Boolean);

/** Spoken words in any stretch of script. */
export const spoken = (text: string) => said(text).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** Spoken words in the script (everything after the cue line). */
export const words = (notes: string) => spoken(script(notes));

/** A beat's hold placed in its script: `at` spoken words in, `s` seconds long. */
export type Hold = { at: number; s: number };

/** Where the script puts a beat's hold: at its first [let it play], else its
 *  first [pause]; with neither, at the start for a beat whose clip speaks,
 *  else after the last word (answers from the room). */
export function placeHold(beat: Beat): Hold {
  const text = script(beat.notes);
  const marker = text.match(/\[let it play\b[^\]]*\]/i) ?? text.match(/\[pause\]/i);
  const at = marker ? spoken(text.slice(0, marker.index)) : beat.assets?.some((a) => /\.(mp4|webm)$/i.test(a)) ? 0 : spoken(text);
  return { at, s: hold(beat) };
}

/** The script's spoken sentences (said()), each with its planned start in
 *  seconds after the click at `wpm`; sentences from `pause.at` words on start `pause.s` later. */
export function sentences(notes: string, wpm = WPM, pause: Hold = { at: 0, s: 0 }): { t: number; text: string }[] {
  let before = 0;
  return said(script(notes))
    .split(/(?<=[.!?…]["”’)]*)\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text) => {
      const t = +((before / wpm) * 60 + (before >= pause.at ? pause.s : 0)).toFixed(2);
      before += spoken(text);
      return { t, text };
    });
}

const counted = (beat: Beat) => (beat.kind ?? "content") === "content";

/** Seconds of speech: the script at `wpm` (0 for preshow and credits). */
export const speech = (beat: Beat, wpm = WPM) => (counted(beat) ? (words(beat.notes) / wpm) * 60 : 0);

/** Seconds of hold (0 for preshow and credits). */
export const hold = (beat: Beat) => (counted(beat) ? (beat.hold ?? 0) : 0);

/** Planned seconds for a beat: speech plus hold. */
export const seconds = (beat: Beat, wpm = WPM) => speech(beat, wpm) + hold(beat);

/** The talk's planned totals in seconds: speech and holds apart, their sum,
 *  and the sum as a share of a slot of `slot` minutes (%, 0 without a slot). */
export function totals(beats: Beat[], wpm = WPM, slot = 0) {
  const talking = beats.reduce((a, b) => a + speech(b, wpm), 0);
  const holds = beats.reduce((a, b) => a + hold(b), 0);
  const total = talking + holds;
  return { speech: talking, holds, total, share: slot ? Math.round((total / (slot * 60)) * 100) : 0 };
}

/** How much of a beat's speech runs over a picture already at rest: the
 *  sentences that start once its transition is done (all of them, for a cut). */
export function restLine(said: { t: number }[], transition: number): string {
  if (!said.length) return "no spoken sentences";
  const still = said.filter((s) => !(transition > 0) || s.t >= transition).length;
  return `at rest through ${still} of ${said.length} sentences`;
}

/** Markers still in the notes, by kind: { FILL: 2, CONFIRM: 1, TODO: 0 }. */
export function markers(beats: Beat[]) {
  const n = { FILL: 0, CONFIRM: 0, TODO: 0 };
  for (const b of beats) for (const m of b.notes.matchAll(/\[(FILL|CONFIRM|TODO)\b/g)) n[m[1] as keyof typeof n]++;
  return n;
}

/** The rehearsal log, kept by the window that owns the clock while the clock
 *  runs: seconds each beat stayed on screen (by beat index), and the stay
 *  still open (beat `on` since `since`, epoch ms; -1: none). */
export interface Rehearsal { started: number; spent: number[]; on: number; since: number }

/** A saved rehearsal: the speaker view's "Save rehearsal" writes it, `npm run timing -- --rehearsal` reads it. */
export interface RehearsalFile {
  started: string; // when the clock started, ISO 8601
  wpm: number;
  slot: number;
  total: number; // seconds
  beats: { id: string; seconds: number; words: number; planned: number }[];
}

/** The file for a log at `now` (epoch ms): the open stay counts up to now. Seconds to 0.1. */
export function rehearsalFile(beats: Beat[], talk: Talk, log: Rehearsal, now = Date.now()): RehearsalFile {
  const tenth = (s: number) => Math.round(s * 10) / 10;
  const list = beats.map((b, i) => ({
    id: b.id,
    seconds: tenth((log.spent[i] ?? 0) + (i === log.on ? (now - log.since) / 1000 : 0)),
    words: words(b.notes),
    planned: tenth(seconds(b, talk.wpm)),
  }));
  return { started: new Date(log.started).toISOString(), wpm: talk.wpm, slot: talk.slot, total: tenth(list.reduce((a, b) => a + b.seconds, 0)), beats: list };
}

export function mmss(seconds: number) {
  const s = Math.round(seconds); // round once: 59.6 s is 1:00, not 0:60
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
