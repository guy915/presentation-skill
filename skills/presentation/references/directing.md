# Directing

The craft behind the talk: a method, separate from any look. Every rule serves one goal: the audience understands and remembers. Depart from a rule when that serves the goal better, and note why in `docs/treatment.md`.

## Contents
1. Story and arcs
2. Beats
3. Visual explanation
4. Motion grammar
5. The room: type, colour, light, layout
6. Pacing and timing
7. The spoken script
8. Set pieces and live computation
9. Footage, stills, generated imagery, 3D
10. Sensitive material
11. Openings and closings

## 1. Story and arcs

- **One throughline, in at most 15 words.** Cut every beat that does not serve it, however good.
- **The user's named moments are the spine.** Build around each opener, image, exercise, demo or material they name, and keep each one.

**The running order.** Adapt it as needed; log the order and each change, with its reason, in `beats.md`.
1. **Hook**, the first content beat: a question, tension or surprise aimed at the main idea. The conclusion answers it.
2. **Title and promise:** the title, and one line on what the room will gain.
3. **Roadmap:** three or four parts, each named in a few words; under about five minutes, one spoken sentence, and each part's title sits on its first content beat in place of a part title beat.
4. **The parts.** Each opens on a part title beat (the roadmap, this part lit), then gives its point as a sentence, a concrete case from real material, and what it means for the room.
5. **Recap** (§11).
6. **Conclusion** (§11).
7. **Questions:** the beat that stays up through Q&A (§11).

**Pick the arc for what the talk must do.**
- **Explainer:** question → why the obvious answer fails → mechanism, from concrete cases → the catch everyone gets wrong → the question answered and seen anew.
- **Persuasion:** swing between what is and what could be, the scene visibly changing state at each swing; end on the new state.
- **Decision** (a pitch, a board, a grant): the ask; the askers' record, if the room knows them by name only; reasons by strength, with evidence; one beat per objection. Build the budget with its basis, each risk with its mitigation, and what the deciders get, line by line as named. The notes hold the detail they will ask for.
- **Chronological:** then → the turning points → now, so the history pays off in the present.
- **Personal** (a toast, a eulogy): a moment → who they are, in two or three stories → what they mean to this room → the raised glass or the farewell.
- **Another shape:** name it in `beats.md`. **Mixed purposes:** the main purpose's arc, closing on the other.

**Arc techniques:**
- **Stakes within 30 seconds,** before the roadmap; an opening misconception can carry them.
- **Answer first or build up, by the room's role.** A room that decides gets the answer or ask on the title beat, then the support; a room that learns or doubts builds towards it from the hook. Log the room's role in `beats.md`.
- **Say the structure aloud:** at each turn, the script names where the talk stands in its order and what comes next.
- **A turn near the middle:** one beat changes direction.
- **Answer the strongest objection** when persuading or explaining a contested idea: state it fairly, answer it in the next beat. Raise only objections you answer.
- **Fence the idea:** where the room could confuse it with a neighbour, one line says what it is not.
- **Build on misconceptions:** show one the audience holds, overturn it with a primary source. Stage those you can overturn cleanly; the rest go in the notes.
- **Energy rises in waves to a late peak.** Alternate demanding stretches with lighter ones. Put the strongest part last or second to last, and the most produced moment in the last third, before the recap. Log each part's energy in `beats.md`.
- **Plant early, pay off late:** something from the hook returns once near the end, seen anew. Pay off everything you plant.
- **Every story carries the point:** tie it aloud to its part's point, or cut it.

## 2. Beats

A beat is one click: one change the audience reads while the speaker talks.
- **One job:** a single read the audience could say back as a sentence. Write it down first.
- **One focal change per click;** everything else holds or recedes, and direct consequences may follow in the same motion. Stage a complex change over several beats, one kind of change each.
- **A question and its reveal are two beats.** A payoff the script pauses before gets its own click, or lands inside a played sequence the screening sheet shows the words reach.
- **A played sequence** of one process is one change: it starts on a click, ends at rest, and the next click finishes it instantly.
- **Lists:** one click per item that is its own idea; items that make sense only together arrive at once.
- **Vary the texture:** change medium or ground within about five beats. In phase 1, log each part's medium and scale in `beats.md`.
- **Duration:** about 5–25 s of speech; split a longer beat at a sentence where the screen can change. Clips and held images may run longer; a burst of short beats can drive a climax.

## 3. Visual explanation

- **The ladder,** strongest first. Climb as high as each idea allows; note per part in `MATERIALS.md` the highest rung reached.
  1. the user's own material
  2. real: footage, photographs, the running system, screenshots and recordings of the real software, 3D scans
  3. computed: live computation on real data, or real data drawn
  4. built: a diagram, 3D scene, mathematical animation, shader
  5. generated: ideas and textures only (§9)
  6. words
- **Depth follows the audience:** the mechanism they need to act; deeper internals go in the notes, bracketed, for questions. The explanation the user cares most about gets the most beats.
- **The simplest medium that teaches the idea;** keep 3D, time or scale when that dimension is the idea, and live computation where liveness is the point.
- **Marks the words point at are big:** at least about 1/40 of screen height, or pushed in on, or called out.
- **Explain the encoding, then move it:** a still beat names axes, marks and colours before the data animates.
- **Climb the ladder of abstraction:** one case, the family across a parameter or time, back to one case.
- **Word ceilings per beat** (the runtime tests DOM text):
  - a heading of about six words; labels of one or two;
  - at most one hero number, usually none; a relation, a range or the sum the beat shows counts as one;
  - about 25 words on stage; lines under about 60 characters;
  - four type sizes per beat, about six per talk;
  - when text or notation is the subject, the ceilings give way; floor and contrast (§5) hold.
- **Illustration beside evidence looks visibly different;** the notes say which is which.
- **Metaphors show a true mechanism;** the notes say where each breaks.
- **The glance test:** a fresh reviewer sees the rest frame for about three seconds and says what it shows; the beat passes when that matches its job.

## 4. Motion grammar

- **Motion follows the register and the user's reference:** layered and continuous for a lively brief, restrained for a sober one; both resolve to one read at rest. Ambient life stays quieter than the focal change.
- **Object constancy:** a persistent thing keeps its identity, place and colour; each mark means one thing all talk. Name persistent objects in `beats.md`.
- **Direction carries meaning:** one direction for "next"; each other direction reserved for one meaning, the same all talk.
- **Exits set up entries:** same axis, direction and speed; a handed-over object keeps position and velocity.
- **Timing budgets,** starting points tuned by watching the strips:

  | Transition | Single entry | Exit | Stagger, in total | Stillness before a climax |
  |---|---|---|---|---|
  | 0.5–1.2 s | ≤ 800 ms | ¾ of its entry | ≤ 500 ms | 0.3–0.75 s |
- **A small vocabulary:** two or three transition types per talk, one easing for similar elements; bounce and elastic only for springy ideas.
- **Flashing at three per second or slower** in all motion and every clip (a seizure risk); trim or choose another take.
- **Cut when the subject changes; morph when the same thing changes form.**

## 5. The room: type, colour, light, layout

- **The text face is the treatment's choice.** Pick it for this talk: licensed for web embedding, legible at the room's distance, and covering every character the talk shows. Bundle it (RUNTIME.md, "Fonts").
- **Size floor, from the room.** The smallest text anyone must read needs an x-height of at least 1/200 of the farthest viewer's distance (AVIXA DISCAS). On the 1080-line stage, with x-height half the font size, that is about 11 px of font size per screen height of room depth:

  | Last row, in screen heights | 3 | 4 | 6 (a typical lecture hall) | 8 |
  |---|---|---|---|---|
  | Font size | 33 px | 44 px | 65 px | 87 px |

  Set `--type-floor` in `src/theme.css` from the brief's room depth, minimum 24 px; the runtime tests it. A taller x-height may go proportionally smaller; raise the floor for display faces, coarse screens and older audiences. Set sentences well above it. When a frame fills up, split the beat; keep type and gaps full size.
- **Contrast:** at least 4.5:1 against the pixels behind the text, 7:1 for anything read at a distance (the runtime tests 4.5:1, warns under 7:1). A reproduced artefact keeps its own colours.
- **Light follows the venue** and the user's reference; test the ground on the washed-projector sheet.

  | Venue | Ground and imagery |
  |---|---|
  | Projector, lit room | Light ground (dark grounds turn grey); brighten or crop mostly dark photographs |
  | Projector, half-lit room (most halls) | The lighter ground; a dark direction must survive the washed sheet |
  | Projector, dimmed room | Dark stage, darkest tone a little above black, holding 7:1 |
  | Dark hall or LED wall | Dark scenes carry. On LED: strokes above a hairline, irregular texture, large fields below pure white, detail above near-black |
  | TV or monitor up close | True black; density can go up; the floor holds |
  | Video-call screen share | Floor at 4+ screen heights, solid strokes, slow large moves; send the link afterwards |
- **Sound:** clips share one loudness (engineering.md §4). For small speakers, check that what must be heard survives with the low end cut. The visual carries the structure alone.
- **A noisy room:** the screen carries more, a short phrase per beat may stay, the rate slows, questions come by hands.
- **Safe area:** content inside a 5% margin; full-bleed imagery keeps its meaning inside it.
- **Colour carries information:** each role gets one hue for the whole talk, written in the treatment; neutral means context or still to come. Pair each colour with shape, position or a label (about one man in twelve confuses some hues); check the colour-blindness sheets.
- **One accent per beat,** separate from the role colours; dim or grey the rest. In a busy chart, one or two series take the accent, labelled directly.
- **About four groups at rest;** stage the rest over later beats. Gaps between groups are at least twice the gaps inside them.
- **One spacing scale** in the tokens (a base unit, 8 px by default, and its multiples) beside the type scale.

## 6. Pacing and timing

- **Speaking rate.** TED speakers average about 163 words per minute (133–188), pauses included. Plan at about 150; at 130–140 for new, dense material, a second language on either side, or a noisy room. Another language: cite its measured rate. A recording of the speaker beats any average, and a timed rehearsal beats both (`npm run timing -- --rehearsal <file>`). Set `talk.wpm` before the first count, log why in `beats.md`, and hold it fixed; fit the script to it.
- **Compute the timing** with `npm run timing`: spoken words at the rate, plus holds; it skips cue lines and bracketed directions, and pre-show and credits count zero. Write numbers as said. Without word spaces (Chinese, Japanese), count characters at the language's rate.
- **A hold is silence beyond ordinary pauses:** a speaking clip, a sequence left to play, answers from the room, a scripted silence (always one after a revelation, over a held image). Make holds honest; a show of hands takes longer than it seems.
- **The total lands at 80–90% of the slot,** or anywhere inside a range the user gives. Over: cut beats. Under: make holds honest, then give more room to an ask the user named; if still short, take it to checkpoint 1 with the gap noted. When the room will interrupt, plan to about two-thirds of the slot.
- **Pace:** a texture change every few minutes, more often as the talk goes on; a recall question to end any part longer than about five minutes; recap and conclusion together in about a tenth of the slot or less.

## 7. The spoken script

The notes are what the speaker says: a one-line cue (the point in a few words), then the full script, deliverable as written. The speaker view shows both for the current beat.
- **One glance holds the beat:** cue and script fit about 60 words (28 px on a 1280×800 screen), since the speaker has only a clicker. The presenter spec names longer beats; split them at a sentence where the screen can change.
- **Their voice:** first person, for the ear, in their register. For a second-language speaker, plain syntax and words they say comfortably; for a second-language audience, literal phrasing, familiar units, key numbers repeated.
- **The voice adds what the screen leaves out;** read a quotation or hero number aloud only for emphasis.
- **Words and picture in sync:** the visual lands on the sentence that names it.
  - Each beat's notes end with `[click]` where the next beat lands; the last beat has none. For a mid-sentence landing, end this beat with the first half and `[click]`, and start the next with the rest.
  - When the words name several things in turn, each gets its own click (it arrives, the camera goes to it, or it is marked).
  - At the phrase the script leans on, its subject is on screen and large.
- **Let motion play, then explain:** one short line at the click names what will move; the voice is quiet while it plays; the explanation comes at rest or on the next click.
- **Markers** for values still to come: `[TODO what]` the build supplies, `[FILL what]` only the user has, `[CONFIRM what]` the user confirms. Where public sources can estimate it, write the sourced estimate with `[CONFIRM]`. A line that depends on the venue stays `[CONFIRM …]` until the brief names the place, with a neutral version ready.
- **Stage directions** only when needed: `[pause]`, `[let it play]`, `[wait for the laugh]`.
- **Qualifiers, sources and caveats** go in the notes, verbatim, in brackets (untimed, unspoken). Say in a few words any caveat the room needs to reach the right conclusion.
- **Round from the source:** round headline numbers from the unrounded value; when one differs from the figure the audience meets elsewhere, the notes say which and why.
- **Ownership:** the speaker gives their own view in the first person singular; a computation or finding belongs to the talk; credit the speaker's labour when the brief says they did it.
- **Questions to the room:** the question or options stay up while the room thinks; the answer is the next click. Script expected answers and a bridge back; give the beat a hold.
- **Exercises in another app:** one beat shows the task and exact prompt large, with a hold; the next shows a real answer captured in rehearsal. The interview settles the device and whether the speaker's account appears.
- **Demos and walkthroughs** are recorded in rehearsal and stepped on clicks, one visible change per click; a clip that plays through is one beat with a hold.
- **Several speakers:** mark who speaks each beat; hand over on a beat boundary.
- **Notes carry only what the audience may hear.** Build history (versions, QA rounds, commits) and internal tool names stay in the build files; a version number that belongs to the topic is content.

## 8. Set pieces and live computation

- **Design it first and spike it early:** a rendered, clickable beat at frame rate on the presenting machine, or one like it, with its fallback in place and every drawn quantity traced to the data.
- **Deterministic:** fixed seeds, cached weights, precomputed inputs; load and compile on an earlier beat.
- **A fallback that looks the same:** a still of the live result (engineering.md §5).
- **Data that changes before the talk:** bake a snapshot, refresh it the day before (engineering.md §3).
- **Legible:** the audience sees at a glance that it is live, and what it shows; its event fills the frame at its height.
- **Step a parameter:** click one parameter through its telling values (baseline, threshold, extreme), linked views updating together.

## 9. Footage, stills, generated imagery, 3D

- **Sources and licences:** [research.md](research.md).
- **Footage:** the best original source, trimmed to the read, with a poster frame until it plays. When a clip speaks, the speaker stays quiet: script it as a hold.
- **A photograph the user asks for** is the material. If its licence or availability is in doubt, keep it as the plan, flag it at the next checkpoint, and have a fallback ready.
- **Real but adjacent** material (real, but not the exact subject): weigh it against an exact built visual; when used, the voice names the difference.
- **Stills:** a held photograph with a slow move toward the detail that matters often beats footage. Stock footage is texture.
- **Generated imagery** depicts ideas, metaphors, impossible views, backgrounds and textures; evidence comes from real sources, and historical documents are shown as they are. One style across every image (engineering.md §4).

## 10. Sensitive material

Disasters, deaths, illness, conflict and harm: the audience may include people it touched.
- Let footage and photographs of real suffering hold still or play plainly, at their own scale, free of effects.
- State the number once, plainly, and let it stand. Name people and places with care.
- Script a silence after the hardest beat, with a hold.
- Show real victims and real events of harm only through real, sourced material.
- When the audience needs a warning, the speaker gives it aloud in the opening words.

## 11. Openings and closings

- **Before the talk,** the first beat may hold while the room fills (a still or quiet loop), counted as zero time.
- **The hook comes first, the title after it** (§1), possibly inside the first scene. Script the first minute word for word.
- **Recap by recall** in one or two beats: put on screen a question that asks the room to recall the parts, pause, and reveal the answers on the next click in the images the parts already used. Under about ten minutes, the conclusion can carry the recap.
- **The conclusion pays off the hook:** answer the opening question, return to the planted image, show the new state, and say the throughline outright. In a decision talk, the ask returns. End at the talk's height; script the last lines word for word.
- **End on a next step:** one concrete action the room can take in a situation they will meet. The last spoken line is the message or the action, then a pause; any thank-you sits on the questions beat.
- **The questions beat comes after the conclusion and stays up through Q&A:** the throughline or ask, the next step, the speaker's contact or the talk's link, and a short line that invites questions. Its notes hold bracketed answers to likely questions. When an answer needs a picture, add a backup beat after it (one click forward, one back), with a one-line cue and no hold.
- **Credits** get the last beat, after the questions beat and backups, listing every asset whose licence asks for visible credit (`MATERIALS.md`), unless the licence asks for credit on the image itself (research.md, "Licences at a glance").
