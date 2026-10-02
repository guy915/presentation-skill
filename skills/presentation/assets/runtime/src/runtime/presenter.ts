// The speaker view (presenter.html, opened with S), for the speaker alone:
// a toolbar (time since the start, pace, slide, save rehearsal, theme) over the talk strip
// (every section, sized by its planned time, and the clock on it), this
// beat's cue and script (clicks and stage directions marked), what the room
// sees next and now (live previews, which never drive or sound: see isTop;
// or rest stills for heavy sections and ?preview=still), and a ready bar
// while the deck still moves. Its look is fixed (presenter.css), the same in
// every talk.
import { beats, talk } from "../beats.ts";
import { cue, script, seconds, segments, previewMode, stageSize, KEYS, pace, sectionName, sectionRuns, rehearsalFile, type Rehearsal } from "./manifest.ts";
import { listen, send, REHEARSAL } from "./channel.ts";
import "./presenter.css";

/** The view's words. `{name}` is filled in where the view shows it. */
const PRESENTER_UI = {
  min: "{n} min", // a time in whole minutes
  unit: "min", // beside the minutes since the start
  over: "{time} over", // the pace, past the slot
  idle: "Not Started", // the pace, before the clock starts
  onPlan: "On Plan",
  behind: "{time} behind",
  ahead: "{time} ahead",
  underMin: "< 1 min", // a pace gap under a minute
  go: "next beat", // the click marker within a slide, for screen readers
  goSlide: "next slide, {n}", // the click marker that moves to slide n, for screen readers
  slideN: "slide {n}", // on the click marker that moves to slide n
  toDark: "Switch to dark", // the theme button, for screen readers, in light
  toLight: "Switch to light", // ... and in dark
  save: "Save rehearsal", // the save button, for screen readers and as its tooltip
};

const root = document.documentElement;
root.lang = talk.lang ?? "en";
const stage = stageSize(talk);
root.style.setProperty("--stage-aspect", `${stage.width} / ${stage.height}`);
root.style.setProperty("--stage-hw", String(stage.height / stage.width)); // height per width, for sizing the frames
const $ = (id: string) => document.getElementById(id)!;
/** A label, its {names} filled in. */
const ui = (k: keyof typeof PRESENTER_UI, vars: Record<string, string | number> = {}) =>
  PRESENTER_UI[k].replace(/\{(\w+)\}/g, (m, v) => (v in vars ? String(vars[v]) : m));
/** "Slide <b>n</b> of total", as nodes. */
function slideOfNodes(n: number, total: number): Node[] {
  const b = document.createElement("b");
  b.textContent = String(n);
  return [document.createTextNode("Slide "), b, document.createTextNode(` of ${total}`)];
}
const params = new URLSearchParams(location.search);
const plan = beats.map((b) => seconds(b, talk.wpm));
/** Planned time on arriving at each beat, seconds. */
const arrive = plan.map((_, i) => plan.slice(0, i).reduce((a, b) => a + b, 0));
const slot = talk.slot * 60;
const local = (i: number) => beats.slice(0, i).filter((b) => b.section === beats[i].section).length;

/** Writes to the DOM only on a change: the clock ticks 4 times a second. */
const set = (el: HTMLElement, text: string) => void (el.textContent !== text && (el.textContent = text));
const setClass = (el: HTMLElement, name: string) => void (el.className !== name && (el.className = name));
const setStyle = (el: HTMLElement, prop: "width" | "left", value: string) => void (el.style[prop] !== value && (el.style[prop] = value));
/** Replaces an element's nodes only when its text changes. */
const setNodes = (el: HTMLElement, nodes: Node[]) => {
  const text = nodes.map((n) => n.textContent).join("");
  if (el.textContent !== text) el.replaceChildren(...nodes);
};

let index = -1;
let started = 0; // the deck's clock: epoch ms, 0 until the first content beat
const elapsed = () => (started ? Math.max(0, (Date.now() - started) / 1000) : 0);

// ---- the talk strip: one segment per section run, as wide as its planned time
const runs = sectionRuns(beats, talk.wpm);
/** The slide (section run, 1-based) that beat i belongs to. */
const slideOf = (i: number) => runs.findIndex((r) => i >= r.from && i < r.to) + 1;
const total = plan.reduce((a, b) => a + b, 0);
const strip = $("strip");
const track = $("track");
const head = $("playhead");
const runEls = runs.map((r) => {
  const el = document.createElement("div");
  el.className = "run is-future";
  el.dataset.section = r.section;
  el.style.flexGrow = String(r.planned);
  const name = sectionName(r.section, talk);
  el.title = name;
  const fill = document.createElement("i");
  fill.className = "fill";
  const label = document.createElement("span");
  label.textContent = name;
  el.append(fill, label);
  track.append(el);
  return el;
});
const runOf = (i: number) => runs.findIndex((r) => i >= r.from && i < r.to);

/** Where planned time t falls on the strip, in px from its left edge: inside
 *  the run planned at that time (so gaps and the untimed preshow and credits leave it unskewed). */
function stripX(t: number) {
  const timed = runs.map((r, k) => k).filter((k) => runs[k].planned > 0);
  if (!timed.length) return 0;
  const k = timed.find((k) => t < runs[k].start + runs[k].planned) ?? timed[timed.length - 1]; // past the planned end: the end of the last timed run
  const r = runs[k];
  const el = runEls[k];
  return el.offsetLeft + Math.max(0, Math.min(1, (t - r.start) / r.planned)) * el.offsetWidth;
}

function strips() {
  const here = runOf(index);
  runEls.forEach((el, k) =>
    setClass(el, `run ${k < here ? "is-past" : k === here ? "is-current" : "is-future"}${runs[k].planned ? "" : " is-zero"}`),
  ); // is-zero: preshow and credits, no time in the plan
  const r = runs[here];
  // the current run fills to the planned end of this beat: a clock past it is behind
  const upTo = arrive[index] + plan[index] - r.start;
  setStyle(runEls[here].querySelector<HTMLElement>(".fill")!, "width", `${r.planned > 0 ? Math.min(100, (upTo / r.planned) * 100).toFixed(2) : 100}%`);
}

/** Shows beat i in a frame: a live copy of the deck at that beat, or its rest still. */
function frame(name: "current" | "preview", i: number | undefined) {
  const live = $(name) as HTMLIFrameElement;
  const still = $(`${name}-still`) as HTMLImageElement;
  const beat = i === undefined ? undefined : beats[i];
  const mode = beat && previewMode(beat.section, talk, params.get("preview"));
  live.closest("figure")!.hidden = !beat; // no next beat: no empty frame
  live.hidden = mode !== "live";
  still.hidden = mode !== "still";
  if (!beat || mode === "still") live.removeAttribute("src");
  if (!beat || mode === "live") still.removeAttribute("src");
  if (!beat) return;
  if (mode === "still") {
    still.src = `rest/${beat.id}.jpg`; // written by npm run shots
    still.alt = beat.sees ?? beat.label;
    return;
  }
  const q = new URLSearchParams();
  for (const p of ["fallback", "motion"]) if (params.get(p)) q.set(p, params.get(p)!);
  const src = `./${q.size ? `?${q}` : ""}#/${beat.section}/${local(i!)}`;
  if (live.getAttribute("src") !== src) live.src = src; // a hash change: same document, no reload
}

function notes(i: number) {
  $("label").textContent = cue(beats[i].notes);
  $("notes").replaceChildren(
    ...segments(script(beats[i].notes)).map((s) => {
      if (s.kind === "say") return paragraphs(s.text);
      const span = document.createElement("span");
      span.className = s.kind;
      if (s.kind === "click") {
        // a click that stays on this slide (the next beat) or moves to the next slide
        const slide = i + 1 < beats.length && slideOf(i + 1) !== slideOf(i) ? slideOf(i + 1) : 0;
        span.classList.toggle("is-slide", slide > 0);
        span.setAttribute("aria-label", slide ? ui("goSlide", { n: slide }) : ui("go"));
        if (slide) span.textContent = ui("slideN", { n: slide });
      } else span.textContent = s.text;
      return span;
    }).flat(),
  );
  fit();
}

/** The script always fits: the speaker has only a clicker during the talk, so
 *  nothing scrolls. The cue and script shrink together until the beat fits,
 *  down to FLOOR px of script; a beat still too long at FLOOR shrinks further
 *  (never cut off) and is marked is-tight: test/speaker-view.spec.ts fails on it at
 *  QA, so the beat gets split. */
const FLOOR = 28;
function fit() {
  const now = $("now");
  const notes = $("notes");
  now.style.setProperty("--fit", "1");
  const over = () => now.scrollHeight > now.clientHeight + 1;
  const base = parseFloat(getComputedStyle(notes).fontSize);
  let s = 1;
  if (over()) {
    let lo = Math.min(1, FLOOR / base), hi = 1;
    now.style.setProperty("--fit", String(lo));
    if (over()) lo = Math.min(lo, 12 / base), hi = Math.min(1, FLOOR / base); // last resort, below the floor
    for (let k = 0; k < 12; k++) {
      const mid = (lo + hi) / 2;
      now.style.setProperty("--fit", String(mid));
      if (over()) hi = mid;
      else lo = mid;
    }
    s = lo;
  }
  now.style.setProperty("--fit", s.toFixed(4));
  now.classList.toggle("is-tight", base * s < FLOOR - 0.5);
}
new ResizeObserver(() => fit()).observe($("now"));
document.fonts.ready.then(() => fit());

/** Spoken text, with a blank line in the notes shown as a half-line gap between paragraphs. */
function paragraphs(text: string): Node[] {
  return text.split(/\s*\n\s*\n\s*/).flatMap((part, k) => {
    const gap = document.createElement("span");
    gap.className = "gap";
    return k ? [gap, document.createTextNode(part)] : [document.createTextNode(part)];
  });
}

listen((msg) => {
  if (msg.kind !== "beat") return;
  started = msg.started;
  const rest = msg.settled !== false; // a message without `settled` counts as at rest
  if ($("ready").hidden !== rest) $("ready").hidden = rest;
  if (msg.index !== index) {
    index = msg.index;
    notes(index);
    strips();
  }
  frame("current", index);
  frame("preview", index + 1 < beats.length ? index + 1 : undefined);
  tick();
});

/** Minutes as the view says them: whole minutes, "< 1 min" under one. */
const minutes = (s: number) => (s < 60 ? ui("underMin") : ui("min", { n: Math.floor(s / 60) }));

function tick() {
  if (index < 0) return;
  const e = elapsed();
  // the time since the start, in whole minutes (rounded down); orange past the slot
  set($("time"), String(Math.floor(e / 60)));
  set($("unit"), ui("unit"));
  setClass($("clock"), e > slot ? "is-over" : "");
  setNodes($("slide"), slideOfNodes(slideOf(index), runs.length));
  if (save.disabled !== !started) save.disabled = !started;
  const p = pace(e, arrive[index], arrive[index] + plan[index], slot, started > 0);
  setClass($("pace"), `is-${p.state}`);
  set(
    $("pace-text"),
    p.state === "idle" ? ui("idle")
    : p.state === "on" ? ui("onPlan")
    : p.state === "behind" ? ui("behind", { time: minutes(p.by) })
    : p.state === "ahead" ? ui("ahead", { time: minutes(p.by) })
    : ui("over", { time: ui("min", { n: Math.max(1, Math.ceil(p.by / 60)) }) }),
  );
  // the playhead: the clock on the plan's scale, in the pace colour; hidden until the clock starts
  if (head.hidden !== (p.state === "idle")) head.hidden = p.state === "idle";
  setClass(head, `is-${p.state}`);
  setStyle(head, "left", `${stripX(e).toFixed(1)}px`);
}
setInterval(tick, 250);
new ResizeObserver(() => tick()).observe(strip);

// ---- theme: the system's (prefers-color-scheme) until the button is pressed;
// the choice then holds for this tab (sessionStorage), and a fresh window follows the system again.
const THEME = "presenter-theme";
const system = matchMedia("(prefers-color-scheme: light)");
let chosen: "light" | "dark" | null = null;
try {
  const t = sessionStorage.getItem(THEME);
  if (t === "light" || t === "dark") chosen = t;
} catch {} // storage blocked: the choice lasts until reload
const shown = () => chosen ?? (system.matches ? "light" : "dark");
/** One button: a sun in light, a moon in dark; a press swaps to the other theme. */
const toggle = $("theme") as HTMLButtonElement;
function applyTheme() {
  if (chosen) root.dataset.theme = chosen;
  else delete root.dataset.theme;
  const now = shown();
  if (toggle.dataset.shows !== now) toggle.dataset.shows = now;
  const label = ui(now === "light" ? "toDark" : "toLight");
  if (toggle.getAttribute("aria-label") !== label) toggle.setAttribute("aria-label", label);
}
applyTheme();
system.addEventListener("change", applyTheme);
toggle.addEventListener("click", () => {
  chosen = shown() === "light" ? "dark" : "light";
  try {
    sessionStorage.setItem(THEME, chosen);
  } catch {}
  applyTheme();
  toggle.blur(); // next and back stay with the deck
});
// ---- save rehearsal: the rehearsal log that the deck keeps while its clock
// runs (deck.ts), as rehearsal-<date>.json, for `npm run timing -- --rehearsal`.
// Null until the clock starts, or when the log belongs to another run.
function rehearsal() {
  let log: Rehearsal | null = null;
  try {
    log = JSON.parse(localStorage.getItem(REHEARSAL) ?? "null");
  } catch {}
  return log && started && log.started === started ? rehearsalFile(beats, talk, log) : null;
}
const save = $("save") as HTMLButtonElement;
save.title = ui("save");
save.setAttribute("aria-label", ui("save"));
save.addEventListener("click", () => {
  const r = rehearsal();
  save.blur(); // next and back stay with the deck
  if (!r) return;
  const d = new Date(started);
  const day = [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, "0")).join("-");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: "application/json" }));
  a.download = `rehearsal-${day}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

// A press leaves the focus where it was; Space on a focused button goes to the deck (below) and never presses it.
for (const button of [toggle, save]) {
  button.addEventListener("mousedown", (e) => e.preventDefault());
  for (const type of ["keydown", "keyup"] as const) button.addEventListener(type, (e) => e.key === " " && e.preventDefault());
}

// Next and back pressed while this window has focus drive the deck; a held key acts once.
addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || !(KEYS.next.has(e.key) || KEYS.prev.has(e.key))) return;
  e.preventDefault();
  if (!e.repeat) send({ kind: "key", key: e.key });
});
send({ kind: "hello" });

(window as any).__presenter = { elapsed, fit, rehearsal }; // the tests read the clock here (the view shows whole minutes), refit a script they set and read the rehearsal
