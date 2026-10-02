# Talk runtime

A talk is a web app the speaker drives click by click; each click advances one **beat** of a continuous scene. The runtime holds the mechanics; the talk brings the look. Node ≥ 22.18.

```sh
npm ci             # installs exactly what package-lock.json pins
npm run dev        # http://localhost:4611 (see Ports)
npm test           # builds, serves on 4610, runs the talk suite
```

## Files

- `src/beats.ts`: the manifest, one entry per click, in order, and the `talk` settings. It ships empty.
- `src/sections/<id>/`: one folder per section, registered in `src/sections/index.ts` (it ships empty); a section without one shows a grey placeholder with each beat's `sees`.
- `src/theme.css`: the `@font-face` rules for the text face the talk bundles (the template leaves them to the talk) and its tokens (`--ground`, `--type-floor`, `--font-text`, colours, spacing, motion); overrides the runtime's CSS.
- `src/runtime/`: the engine; keep it as shipped.
- `test/`: the talk suite; `test/allow.ts` is the one test file a talk edits. `test/runtime/` and `test/fixtures/`: the runtime's own tests and their fixture talk, in the skill's copy only.

The stage is a fixed box 1080 lines high, as wide as `talk.aspect` makes it (1920 at 16:9), letterboxed into any window with bars in `--ground`. Each section is one `<section>` in `#stage > .slides`; the engine shows the current one (`.present`) and keeps the rest laid out, hidden.

**Paths:** the talk is served from a sub-path. Write section markup and manifest paths relative (`media/clip.mp4`); in CSS, write `url("/fonts/…")`, which the build rewrites.

## The manifest (`src/beats.ts`)

`talk`: `wpm` (speaking rate for planned times); `slot` (the hard stop, in minutes); `lang?` (BCP 47 tag for `<html lang>`, `"en"` by default); `heavy?` (sections, such as WebGL scenes, the speaker view previews as rest stills); `aspect?` (`"w:h"`, `"16:9"` by default); `sections?` (speaker-view names by section id, `{ "part-a": "Part A" }`; otherwise the id in sentence case).

Each beat (`Beat` in `src/runtime/manifest.ts`):
- `id`: unique and stable (file names, `?fallback=`).
- `section`: the section id; a section's beats are consecutive.
- `label`: a short name (contact sheets, speaker view).
- `job`: the one read the audience takes in, one sentence; required for content beats.
- `sees?`: what the audience sees, and what the click changes.
- `notes`: line 1 is the **cue**; then the spoken script, ending in exactly one `[click]` (none on the last beat). Other brackets are stage directions (`[pause]`). `[FILL …]`, `[CONFIRM …]` and `[TODO …]` mark gaps in the notes; the stage carries finished text.
- `hold?`: seconds of silence beyond ordinary pauses (a clip that speaks, a played sequence, answers from the room). It falls at the script's first `[let it play]`, else its first `[pause]`; with neither, at the click for a beat with a clip, else after the last word.
- `kind?`: `content` (default), `preshow` or `credits`; the last two count 0 s and need no `job`; credits are exempt from the glance ceilings.
- `assets?`: media paths under `public/`; clips here preload a beat ahead.
- `fallback?`: a still (path under `public/`) that stands in when the section is forced to it or fails.

Planned time per beat = script words ÷ `wpm` + `hold`; the cue line and bracketed text do not count.

## The section contract (`src/runtime/section.ts`)

```ts
export const mySection: Section = {
  html: `<div class="thing"></div>`, // stage coordinates; relative paths
  mount(root) {
    return { render(beat, progress, live) {}, duration(beat) { return 0.8 } };
  },
};
```

- `render(beat, progress)` makes the section's state a **pure function** of `(beat, progress)`. `progress` ∈ [0, 1] is how far the transition into `beat` has run; 1 is at rest. Played forward, the engine calls it every frame for `duration(beat)` seconds; back, jumps, cold loads and reloads call it once with 1. A click mid-transition settles it and advances in the same press.
- `live` is true only while the transition plays in real time; use it only to let media run on its own clock.
- `ready` (optional): a promise that resolves once async assets are in.
- `timelineScene(build)` (`src/runtime/gsap.ts`): one paused GSAP timeline, with a label `b<n>` where beat n rests; every beat needs its label. Keep transforms 2D; give a large moving layer `will-change: transform`.
- `videoScene(video, beat)` (`src/runtime/video.ts`): the poster shows before its beat; played forward, the clip plays and rests on its last frame; an advance mid-clip fades it out.
- `combine(...scenes)` plays scenes as one transition, as long as the longest; scenes with a `duration` keep their speed, the rest stretch. `placeholder(text)` is the grey box that names the finished visual.
- **Canvas** (`src/runtime/canvas.ts`): size it in CSS (stage px) and call `sizeCanvas(canvas)` in `mount`; the engine keeps its backing store sharp. A canvas scene is a `Scene` with only `render`: each call clears and draws the whole picture for `(beat, progress)`, in stage px after `g.setTransform(k, 0, 0, k, 0, 0)` with `k = canvasScale(canvas)`; nothing carries over between calls. At the top of `render`, reset the context state the scene uses (`setLineDash([])`, `lineWidth`, `globalAlpha`). Under `combine` it stretches over the beat's transition.
- **Clip:** a `<video>` in the section's markup with a relative `src` and `poster`, driven by `videoScene(video, beat)` with its section-local beat; list the file in that beat's `assets` so it preloads a beat ahead.
- **Fallback:** a still of the beat at rest (its frame from `npm run shots`, `out/shots/rest/`), saved under `public/` and named in the beat's `fallback`; it covers the stage when it shows (Fallbacks, below).
- **Reduced motion** (`reducedMotion` from `src/runtime/motion.ts`; `html[data-motion="reduced"]` in CSS): set by the OS or `?motion=reduced`. Transitions and clips still play; give motion that carries the eye far a gentler variant (a fade for a rise or zoom).

A section that combines the three scene kinds, as a skeleton (the markup, CSS, tweens and drawing are the talk's):

```ts
import { gsap } from "gsap";
import { combine, type Section } from "../../runtime/section.ts";
import { timelineScene } from "../../runtime/gsap.ts";
import { videoScene } from "../../runtime/video.ts";
import { sizeCanvas, canvasScale } from "../../runtime/canvas.ts";

export const mySection: Section = {
  html: `<style>/* stage px */</style><div class="a"></div><canvas class="c"></canvas><video class="v" src="media/clip.mp4" poster="media/clip.jpg"></video>`,
  mount(root) {
    const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
    const canvas = $<HTMLCanvasElement>(".c");
    const g = canvas.getContext("2d")!;
    sizeCanvas(canvas);
    const draw = (beat: number, p: number) => {
      const k = canvasScale(canvas);
      g.setTransform(k, 0, 0, k, 0, 0);
      g.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      // the picture for `beat`, p of the way from beat - 1's
    };
    const timeline = timelineScene(() =>
      gsap.timeline()
        .from($(".a"), { autoAlpha: 0, duration: 0.6 }) // into beat 0
        .addLabel("b0")
        .to({}, { duration: 1 }) // into beat 1: the canvas draws over it
        .addLabel("b1")
        .addLabel("b2"), // beat 2: the clip's own clock sets its length
    );
    return combine(timeline, { render: draw }, videoScene($<HTMLVideoElement>(".v"), 2));
  },
};
```

### Add a section

1. Add its beats to `src/beats.ts` with one `section` id; the placeholder shows them at once.
2. Create `src/sections/<id>/index.ts` exporting a `Section`; register it in `src/sections/index.ts`.
3. Run `npx playwright test test/visual.spec.ts test/equivalence.spec.ts test/manifest.spec.ts --project talk` and look at its beats. The full `npm test` and `npm run shots` run at QA.

A check needs beats to check: on a talk with too few beats, or no beat with a `fallback`, a clip in `assets` or a played transition, the checks that need one skip and say so.

## Fonts

Fonts ship with the talk, and each talk brings its own text face: the one its treatment picks, licensed for web embedding (SIL OFL 1.1 or similar).

1. Put its woff2 files and licence under `public/fonts/<face>/`.
2. Declare each file in `src/theme.css` with `@font-face`, `url("/fonts/<face>/…")` and its `unicode-range`.
3. Set `--font-text` in `src/theme.css` to that family.

Get the files from Google Fonts or Fontsource. The CSS2 API, `https://fonts.googleapis.com/css2?family=<Family>:ital,wght@0,400..700;1,400..700`, fetched with a browser User-Agent, returns `@font-face` rules naming a woff2 file and `unicode-range` per subset: download the files, copy the rules with their URLs rewritten, and add the family's `OFL.txt`. Fontsource serves the same subsets (`https://cdn.jsdelivr.net/fontsource/fonts/<id>@latest/<subset>-<weight>-<style>.woff2`, licence in the `@fontsource/<id>` package).

Every character on stage needs a bundled face whose `unicode-range` covers it, including Greek letters, maths symbols (∝, ≈) and sub- and superscripts. For a few such characters, download a subset: `https://fonts.googleapis.com/css2?family=Noto+Sans+Math&text=<characters>` names a small woff2 (OFL); save it and its `OFL.txt` under `public/fonts/`.

Until `--font-text` is set, text renders in the runtime's generic fallback (`system-ui, sans-serif`). Only placeholder boxes (`.rt-placeholder`) may stay in it: the face check exempts them, since they come before the treatment; every other text on stage, in every built section, must be in a bundled face. `public/fonts/dm-sans/` and `dm-mono/` belong to the speaker view, whose look is fixed.

## In the room

Present from the published link: the deck fullscreen on the projector, the speaker view on the laptop. Click the audience window once first; that click only focuses it and unlocks clip sound.

| Control | Does |
| --- | --- |
| PageDown, Space, ArrowRight, ArrowDown, a left click on the audience window | next beat |
| PageUp, ArrowLeft, ArrowUp | back one beat, at once |
| F | fullscreen on or off (Esc also leaves it) |
| S | opens the speaker view (`presenter.html`) in a second window |

A presentation pointer sends PageDown and PageUp. Next and back (`KEYS` in `src/runtime/manifest.ts`) also work from the speaker view; a held key acts once; other keys go to the browser. The URL `#/<section>/<beat>` follows along, and a reload resumes there. A clip whose sound the browser blocks plays muted until the next press in the audience window.

The clock starts at the first fullscreen on a content beat, or the first advance onto one; reloads keep it; opening the link without a beat in the URL resets it.

**Speaker view:** "Slide n of m" counts sections. A thin blue bar shows while the deck still moves: click when it is gone. Sections in `talk.heavy`, or `?preview=still`, preview as rest stills. **Rehearse** with the clock running: the audience window logs how long each beat stays on screen (a revisit adds to its beat; a reload keeps the log, a fresh load starts a new one). After the run, the **Save rehearsal** button (an arrow down, beside the theme button) downloads it as `rehearsal-<date>.json`: per beat its id, seconds, words and planned seconds, and the total. `npm run timing -- --rehearsal <file>` compares it with the plan. Its look is fixed (`src/runtime/presenter.css`); `src/theme.css` never applies there.

## Fallbacks

A beat's `fallback` is a still that replaces its section in two cases, and only these:
- **Forced:** `?fallback=<section or beat id>` or `?fallback=all`, decided at rehearsal on the presenting machine; the speaker view's previews follow it. The live scene stops rendering wherever its fallback shows.
- **Failed code:** a section whose `mount` throws, whose `ready` rejects or takes over 5 s, or whose `render` throws stays degraded: each of its beats shows its `fallback`, else its rest still (`public/rest/<id>.jpg`, from `npm run shots`), else its `sees` text. The rest of the talk runs.

## Test contract

`window.__deck` exists once the first beat has settled, before the stage shows:

```ts
{ count, stage /* { width, height }, stage px */, session, index(), go(i, { instant }), seek(i, progress), settled(): Promise<void>,
  beats: [{ id, section, label, notes, kind, duration /* planned s */, transition /* played s */ }] }
```

The speaker view has `window.__presenter.elapsed()` (the clock, in seconds), `fit()` and `rehearsal()` (the file Save rehearsal downloads, or null before the clock starts). Test knobs:
- `?aspect=<w:h>` overrides `talk.aspect`.
- `?break=<section>:mount|ready|render` makes that section fail that way.
- At build time, `TALK_BEATS=<file>` builds that manifest instead of `src/beats.ts` (the scripts and the specs read it too), `TALK_SECTIONS=<file>` that section registry instead of `src/sections/index.ts`, and `TALK_PUBLIC=<dir>` ships that folder beside `public/` (`test/helpers/fixture-build.ts`, `npm run test:runtime`).

## Tests

`npm test` builds the talk, serves it and runs the talk suite:

| Spec | Guards |
| --- | --- |
| manifest | cue, script, one-sentence `job`, one closing `[click]`; unique ids, consecutive sections; no build history in the notes; relative paths, loading from a sub-path; `<html lang>` |
| equivalence | played, stepped back and cold-loaded, every beat rests in the same state (DOM exactly; pixels within 0.2%); every request on its origin, no errors; `seek(i, 1)` equals rest; hash and reload |
| visual | nothing outside the 5% safe area (grounds pass); text ≥ `max(24px, --type-floor)` and ≥ 4.5:1 on its real pixels (warns under 7:1); ≤ 25 words, 60-character lines, 4 sizes; no `[FILL …]` on stage; every character in a bundled face (placeholder boxes exempt); sharp canvases |
| stage | fits any window on whole pixels, letterboxed; each `?aspect=`; a phone in landscape; nothing paints before the deck is ready |
| input | the controls above, from the deck and the speaker view; held keys; both ends; the clock's start, reload and reset; stale tabs ignored |
| media | a clip's poster, preload, play, rest, mid-clip fade, seek, and blocked sound |
| degrade | forced fallbacks; a section failing in `mount`, `ready` or `render`; reduced motion |
| speaker-view | contents; layout from 1280×800 to 1920×1200; every script fits at 28 px or more (split a beat that fails); clock, pace, ready bar, Save rehearsal, fixed look |
| motion | every transition in real time: fails on a frame over 100 ms, or over 10% of frames above 1.5 display frames. `TALK_CPU_THROTTLE=4` emulates a 4× slower laptop, where only a frame over 100 ms fails |
| `npm run test:runtime` | the runtime's own tests (`test/runtime/`): tools (timing and `--rehearsal`, beats, screening, handout), deploy, media fetch, the checks, the engine, the speaker view; then the whole talk suite, all on the fixture talk in `test/fixtures/` (a timeline, a canvas with a fallback, a clip with its poster, a placeholder, and its own text face in `test/fixtures/theme.css`). It needs ffmpeg: it generates the fixture talk's clip, poster and fallback still into `out/fixture-media/` (kept while fresh). They live in the skill's copy of the runtime, and setup leaves them out of a talk; run them there when you change the engine, the tools or the tests |

Put intentional exceptions in `test/allow.ts`, each keyed by a CSS selector with its reason: `BLEED` (safe area; a clip's poster follows its clip; grounds need no entry: an element with no text of its own passes when it covers the whole stage, or carries the class `ground` for one that bleeds past only some edges), `SMALL_TEXT` (floor), `LOW_CONTRAST`, `DENSE_TEXT` (text that is the subject, or labels the eye visits one at a time: exempt from the word, line and size ceilings; the floor and contrast still apply) and `NOTES_ALLOW` (an exact phrase in the notes that only looks like build history, such as "gate 12"). `--type-floor` in `src/theme.css` raises the floor above 24 px.

## Commands

| Command | Does |
| --- | --- |
| `npm run build` | `dist/`: a static site with relative paths |
| `npm run preview` | serves `dist/` on the tests' port |
| `npm run typecheck` | type-checks sections, engine, tests and configs |
| `npm run timing [-- --wpm 150 --slot 10]` | speech, holds and total per beat and section, % of the slot, markers left |
| `npm run timing -- --rehearsal <file>` | planned against actual (a file from Save rehearsal) per beat and section, beats off by more than 30 % and 5 s flagged; the total against the slot; the measured rate (words ÷ (seconds − holds) on content beats) and, when it differs by more than 5 %, the `talk.wpm` to set |
| `npm run beats` | rewrites the block between `<!-- beats:start -->` and `<!-- beats:end -->` in `beats.md` from the manifest |
| `npm run shots` | `public/rest/<id>.jpg` (the stills a failed section shows) and `out/shots/`: `rest/`, contact sheets (plain, washed-out, colour-vision deficiencies), `strips/` (8 frames per transition) |
| `npm run screening` | `out/screening/NN-<id>.png` per content beat and `out/screening.pdf`: frames at the click, at each spoken sentence and at rest, captioned; the `hold` shows as a band where it falls, and the sentences after it start that much later, as `timing` counts it |
| `npm run handout [-- --no-notes]` | `out/handout.pdf` to share after the talk: each content beat's rest frame with its cue and its script (brackets removed), two to an A4 landscape page; the credits frames last. `--no-notes`: frames only, one to a page |
| `npm run media:fetch [-- name…]` | clips from `media.json` (`name, url, from, to, audio, credit, licence, beat, onScreen, direct`) via yt-dlp and ffmpeg: H.264/AAC MP4 ≤ 1440p, −16 LUFS, a poster `.jpg`, into the gitignored `public/media/`; a row per clip in `MATERIALS.md` |
| `npm run deploy [-- --dry-run] [--site-repo owner/name]` | a clean build of HEAD plus `public/media/` and `public/rest/` to GitHub Pages (`gh-pages`, noindex); prints the URL and writes a relative `og:image` and `og:url` as absolute URLs under it (a dry run prints them); refuses files over 95 MB |

**Ports** come from `TALK_PORT_BASE` (default 4610): tests and `preview` on the base, `dev` on base+1, scripts (shots, screening, handout) on base+2 (`scripts/lib/ports.ts`). A parallel worktree sets one variable: `TALK_PORT_BASE=4710 npm test`.

**Media:** use H.264/AAC MP4. For alpha, stack colour and alpha in one H.264 frame and recombine them in a canvas or shader; Safari has no WebM alpha.
