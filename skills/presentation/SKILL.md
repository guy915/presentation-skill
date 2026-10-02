---
name: presentation
description: >-
  Direct, build and publish a talk someone will give live, as a click-driven web app published at a
  link. Use it for any talk, lecture, class, keynote, pitch, defence or board presentation the user
  will present, including when they say "slides" or "deck", and to continue or rebuild one begun
  earlier. Load it before an Artifact quickstart or the Slides type. A .pptx, Keynote or Google Slides
  file goes to the pptx skill.
argument-hint: "[topic, audience, length, venue: whatever you already know]"
---

# Presentation

You direct and build a talk a person gives live: **a presentation directed like a film, built like a website**, on a fixed stage shaped like the venue's screen. Each click advances one **beat** of a continuous scene: something changes, the audience reads it at a glance, and the speaker's voice carries the rest.

**The bar: the talk the user asked for, made production-grade and fit for this room.** The user's words set *what* the talk contains; your craft sets how it looks, moves and lands, in the room's register: restraint and evidence to persuade, wonder to delight, spectacle where it serves. The user takes part in the interview and two checkpoints (storyboard, style; one combined checkpoint for a talk of 5 minutes or less); after the style pick, deliver finished work.

`${CLAUDE_SKILL_DIR}` means this skill's folder.

## Terms

- **Beat:** one click's change. Its **rest frame** is where it settles, its **hold** is scripted silence, its **cue** is the one-line prompt above its script in the speaker notes.
- **Part:** a story unit of the running order (directing.md §1), opened by a part title beat.
- **Section:** the runtime's scene, one folder in `src/sections/`, one visible at a time; a part can span several. The speaker view labels a section run "slide".
- **Throughline:** the talk's point in one sentence. **Set piece:** a beat where the idea transforms on screen beyond what a static slide can show. **Treatment** (`docs/treatment.md`): the written visual direction.
- **Runtime:** the web app in `assets/runtime/` every talk starts from; `RUNTIME.md` documents it.
- **House defaults** ([references/defaults.md](references/defaults.md)): the concrete setup, host, tool and model choices.
- **Helper skills** (`orchestrate`, `frontend-design`, `critique`, `redteam`, `kill-ai-slop`): do a missing one's job by hand. For `critique` or `redteam`, brief a fresh agent on the strongest model to return a verdict, a score and every finding with its severity. When no second agent can be started, run the review yourself in a separate pass against the checklist, and mark it not independent in the final message.

## Principles

1. **The user's words are the spec.** Each moment, image, exercise, demo, material and style reference the user names is an *ask*: deliver it in the form they described, better than they pictured it. Offer alternatives at a checkpoint; the user's pick decides. A risky ask (licence, accuracy, feasibility) stays in the plan, with a fallback, until the next checkpoint. When an ask's count meets a craft rule, keep the count and apply the rule inside it: one asked-for beat can play several stages, each timed to its sentence.
2. **Show early, build once:** heavy production starts after the checkpoints.
3. **Study the best, then diverge.** Take technique from the best work in the topic's world; derive the look from this talk and the user's reference.
4. **Real material first; show the thing itself** (directing.md §3–§5): fork rather than make from scratch, as high on the ladder as each idea allows.
5. **Be true:** source every claim; compute or cite every number.

## The asks ledger

`BRIEF.md` opens with the request verbatim, then the ledger: one row per distinct ask, in the user's words, with a status; the latest word wins ([references/interview.md](references/interview.md)). Every beat serves an ask or a named story need, mapped in **Asks → beats** in `beats.md`. Every check reads against the ledger.

## Standing rules

After a context compaction or restart, re-read this file, then `BRIEF.md` and `PROGRESS.md`, first.

**The format.**
- **One click is one beat; every change starts with a click.** A played sequence or clip ends at rest; a click during one finishes it and advances, in one press; clips fade out.
- **During the talk the clicker (next, back) is the only control.** Fullscreen, the speaker view and the first click on the audience window are set-up. Record or step demos, walkthroughs and exercises click by click.
- **Every beat comes to rest.** What the audience must read settles; ambient life stays quieter than the read.
- **Forward, back, a jump and a reload land on the same frame.**
- **Self-hosted:** every asset, fonts included, ships in the build. Every risky moment (live computation, heavy 3D, large media) has a still fallback the audience would take for the real thing.
- **The stage holds what the audience reads.** Sources, qualifiers and caveats go in the notes; licence credits on the credits beat (directing.md §11).
- **Every claim, on screen or aloud, has a row in `CLAIMS.md`.** Footage is the original file, from the best source.

**Setup** (presenting, controls, sound, host) comes from the house defaults as confirmed in `BRIEF.md`. **Yours to decide:** look, motion, story treatment and tools, within the asks and what the user fixed. Take style references from this talk's brief only; saved preferences about how to work still apply.

**Standing permissions.** The user's confirmation in the interview permits:
- the house defaults' model settings, image generator and host, or the user's overrides;
- downloading any public resource the talk uses, logged in `MATERIALS.md`;
- playing and hosting third-party clips as they are, credited;
- the build's commands, allowed in the user's tool settings so an unattended run keeps moving;
- private people's material or confidential work on the link, once the interview has asked who may see it.

**Autonomy.**
- The user answers the interview and the two checkpoints. Between them, decide and continue, recording each default as an assumption in `BRIEF.md`. Where another skill says to ask the user, decide instead.
- **Unattended runs** (scheduled, the user is away, or they waived the checkpoints): at each checkpoint, send what you would have shown and continue on your recommendation, with one style direction. Without a confirmed publish, build and test everything and list publishing under **For you**.
- **When the user rejects work,** restate in one line what you will change, quoting their words you measure against, and wait for their yes before changing files. Then update the ledger and rework from the earliest phase touched: content from the storyboard (re-send the changed rows as checkpoint 1), look from the tokens.
- When a tool fails, try another before reporting.
- Helpers (subagents, other models, a browser-reached advisor) get one self-contained brief each and return inline text or code; save it to the repo at once. Recover a stalled helper once, then continue locally. Integration, verification and QA stay with you.

**State lives in files** in the talk's repo, from `${CLAUDE_SKILL_DIR}/assets/templates/`. You alone write `PROGRESS.md` and `BRIEF.md`.
- `BRIEF.md`: request, ledger, interview, confirmed defaults, assumptions, definition of done.
- `PROGRESS.md`: phase, next step, open items, agent ledger, and **Decisions** (the style pick, each approved departure from an ask, each deliberate exception to a rule, with its reason); commit it at every phase exit and hand-off.
- `CLAIMS.md`: every claim with status, source and evidence. `MATERIALS.md`: every material and asset, candidate to used, with licence and credit.
- `src/beats.ts`: the manifest, the single source for beat order, jobs, notes, holds, assets and fallbacks. `beats.md`: the story plan, the persistent objects and the talk's vocabulary, above a view of the manifest.
- `docs/treatment.md`: references, benchmark, treatment.

## The run

| Phase | Exit when |
|---|---|
| 0 Brief | every open question is answered or knowingly defaulted |
| 1 Storyboard, **checkpoint 1** | the user approves the storyboard (unattended: it is sent) |
| 2 Research and look, **checkpoint 2** | a style is picked; each beat's claims and material are in hand |
| 3 Build | every beat is built, targeted tests are green, neutral marks remain only for facts only the user has |
| 4 QA | blockers and majors are fixed |
| 5 Release | the link works in a clean browser, with the speaker's setup checked |

Scale the ceremony to the talk; keep the ambition:

| | ≤ 5 min | 6–15 min | 16–30 min | > 30 min |
|---|---|---|---|---|
| Checkpoints | one: storyboard and style frames together | two | two | two |
| Gather (phase 1) | you | you + 1 agent | 3 agents, one per thread | 3–4 agents |
| Research (phase 2) | you | you (one agent if claims run long) | 2 agents | 3 agents |
| Set pieces | 0–1 | 1–2 | 2–4 | 3–5 |
| Style directions | 1–2 | 2 (3 without a user reference) | 2–3 | 3 |
| Benchmark study | reading | transcript or reading | full | full |
| Build | you | you + at most one visual agent | you + 1–2 area agents | `orchestrate`, 3–5 areas |

**One checkpoint (≤ 5 min):** after the storyboard, write the treatment and render the direction(s) (phase 2, Look, steps 2–3), then send storyboard and style frames together as checkpoint 1; checkpoint 2 falls away. Research runs after it.

## Phases

### 0 · Brief

Read what exists, then run the interview ([references/interview.md](references/interview.md)). Set up the project (engineering.md §0). Write `BRIEF.md` and start at once.

### 1 · Storyboard, and checkpoint 1

1. **Gather references** ([references/research.md](references/research.md), "Gathering"): scour the web, broad before narrow, in three threads: **inspiration** (the best talks, explainers, visualisations, motion and design on this topic and in this register), **sources** (primary sources, data, the central facts and the common misconceptions) and **assets** (footage, photographs, the real interface, data sets, 3D models, existing visualisations to fork, and the user's named material). Log finds in `docs/treatment.md`, `CLAIMS.md` and `MATERIALS.md` (status candidate), pick the benchmark, and make the reference board.
2. **Write the story** (directing.md §1, §2, §6, §7): throughline of at most 15 words, running order and arc built around the user's named moments, beats, timing, script.
3. **Fill the manifest** (fields in `RUNTIME.md`) and Asks → beats. A sentence that names something new on screen starts a new beat. Map the user's own deck or paper to beats first. A beat still waiting for material says so in `sees`.
4. **Self-check:** every ask has a beat in the form the user described; every beat names its ask or story need.
5. **Checkpoint 1.** Shoot the placeholder deck's contact sheet. Reply with the sheet attached and:
   - the throughline, and a beat table: what the room sees, job, ask, seconds (from the manifest's `sees` and `job`, Asks → beats, and `npm run timing`)
   - for a talk of 5 minutes or less, the style composite and the treatment in a few lines
   - the reference board: the strongest finds per thread, the benchmark marked, each with one line on what it brings
   - a thumbnail of each named material found, beside its beat
   - **Where this differs from your words:** every ask changed, merged, moved or added, and every departure of earlier material from the original request, each with a one-line reason
   - up to three open choices, each with your recommendation

   Ask "Go ahead, or what should change?" with the question tool (or as your closing question), and wait. Apply the answer to the ledger and the manifest.

### 2 · Research and look, and checkpoint 2

1. **Research** what the approved beats need, in depth ([references/research.md](references/research.md)): confirm each claim at its primary source, fetch and license each asset, study the benchmark; add a **Beat this** line to `beats.md`.
2. **Write the treatment** from the user's reference, the topic and the venue (directing.md §5, `frontend-design`).
3. **Render the directions** as finished rest frames of real beats: the opener or a set piece, one with real material, one of text or numbers (engineering.md §2, "Style directions"). Direction A follows the user's reference faithfully; the others are distinct alternatives. Render only one when the user fixed the look tightly or the run is unattended.
4. **Checkpoint 2.** Send one labelled composite and the full frames; ask for a letter, or a mix of named parts from several directions, with the question tool (or as your closing question), and wait.
5. **Lock the design tokens** in `src/theme.css`: the bundled text face, the type floor, type and spacing scales (directing.md §5), and record the pick under Decisions in `PROGRESS.md`.

### 3 · Build

Read the repo's `RUNTIME.md` and `AGENTS.md` first.
1. **Set pieces first** (directing.md §8); redesign a failing one now.
2. **Then section by section** in talk order; for longer talks, area agents (engineering.md §7) after the shared foundations (tokens, recurring components, persistent objects).
3. **Facts only the user has** render as neutral marks that show no value, with the marker in the notes and `CLAIMS.md`.
4. **Check as you go:** look at each finished beat; run the specs covering what changed (engineering.md §8). Merge, then read the whole contact sheet as one piece.

### 4 · QA

Run [references/quality.md](references/quality.md) once on the finished talk: the full suite, one fresh review (plus `redteam` on the claims for a fact-heavy talk), one `critique` pass.

### 5 · Release

Run quality.md's release check, then send the final message in its shape.
