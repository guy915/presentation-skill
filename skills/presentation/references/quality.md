# Quality (phase 4)

QA is one pass of three checks on the finished talk: the automated suite, one review and one `critique` pass. It asks: is every beat built well, true, and faithful to the asks ledger?

A check passes on evidence (test output, frames, reports), read against `BRIEF.md` (the request verbatim and the asks ledger). Before the next check starts, move each skill's `.review/` folder to `.review-<check>/`.

## 1. Automated

Run `npm test` once, on an idle machine, after any parallel worktrees are merged (RUNTIME.md, "Tests").
- List the skipped tests in the final message (engineering.md §8).
- Run heavy scenes throttled, and check WebGL set pieces headed (engineering.md §6).

## 2. The review

One fresh reviewer that built none of the talk: a read-only general-purpose agent on the strongest model, briefed with the lenses entry point, eye flow, weight, emphasis, cognitive load and prioritisation. Beforehand, run `kill-ai-slop` once on the code; decide its fixes yourself, keeping the treatment's deliberate choices.

1. **Shoot** with `npm run shots` and `npm run screening` (RUNTIME.md, "Commands").
2. **Glance test first.** The reviewer says what each rest frame shows, alone; then compares with each beat's job in `beats.md`.
3. **Then the rest:** strips, screening sheets, washed and colour-blindness sheets, `docs/treatment.md`, `BRIEF.md`, `CLAIMS.md` and the checklist below.
4. **One report,** each finding with a severity (blocker, major, minor) and its beat, in four parts:
   - **Asks and story:** for every ledger row, the beat that meets it, in the form the user described (a named moment in another form is a blocker); then items 19–26.
   - **Frames, motion and control:** items 1–10 and 14–18.
   - **Sync:** a table of beat, sentence, what's on screen and verdict (lands · early · late · walking · off-stress), against items 11–13.
   - **Claims:** every number on screen, every claim marked ◐ and every claim a fair critic might contest: primary and current source, faithful to it, fairly framed. A claim marked ⚠ appears as a view, with both sides in the notes. For a fact-heavy talk, `redteam` does this part, briefed with the Request section of `BRIEF.md`, `CLAIMS.md` and `beats.md` (run `npm run beats` first).

### QA checklist

**Every rest frame**
1. **The read.** In three seconds a newcomer says what the beat shows, matching its job.
2. **Obvious meaning.** Every element, and the beat itself, has a purpose the room grasps unaided.
3. **Content only.** What the audience needs (dates, captions identifying works, credits licences ask for); metadata and build history live elsewhere.
4. **Text.** A short heading, one- or two-word labels, one hero number at most, unless text is the subject. Every text meets the floor and reads on its real background, washed sheet included. Canvas and WebGL text keeps the ceilings (25 words, 60-character lines, four sizes), by eye; reproduced artefacts keep their colours. Leading suits the size; about six sizes in the talk.
5. **Colour.** Each colour keeps its treatment meaning everywhere, backed by shape, position or label (colour-blindness sheets); each named role has its own hue.
6. **Focus.** The eye lands on the focal change first; one accent at most; a mark the words point at is back-row size, pushed in on, or called out.
7. **Consistency.** Type, colour, spacing and imagery follow the treatment.
8. **Finish.** Everything aligns; spacing follows the scale; images are sharp, clean and watermark-free; generated images show ideas, backgrounds or textures; evidence is real.
9. **Groups and space.** The subject fills the frame; empty space has a reason; the frame balances; about four groups at most, labels beside what they name, groups twice as far apart as their parts, the most room for the focal element.
10. **Charts.** Flat marks, direct labels, only the gridlines and legend the read needs.

**Every screening sheet**

11. **The picture lands with its words.** At each sentence the screen shows what the words name; answers, numbers and punchlines appear with their sentence; a payoff after a pause gets its own click. Three or more sentences in a row naming different things over a still picture fail, except over a quotation or one image to contemplate.
12. **The eye is where the stress is.** The phrase the script leans on has its own image.
13. **Questions to the room,** or their options, stay on screen while the room thinks; the answer is the next click.
14. **The clicker runs it all:** every moment, demos and exercises included, on next and back alone.

**Every transition strip**

15. **One change per click,** visible and meaningful.
16. **Continuity.** Persistent objects keep identity and position; the same thing changing form morphs, a new subject cuts; every cut and morph is chosen.
17. **Motion quality.** Smooth, steady where it should be, to rest; every frame styled and filled; siblings enter together, alike; three flashes per second at most, footage included.
18. **Direction, timing and energy.** Directions follow the treatment; exits agree with the next entries; moves are lively yet easy to follow; the amount of motion matches the treatment and the user's reference; the beat ends at rest.

**The whole talk (contact sheet)**

19. The images alone, in order, tell the throughline; the closing image answers the hook.
20. Texture varies: runs of one medium and ground stay near five beats, or `PROGRESS.md` Decisions says why.
21. One piece, its look drawn from the topic, the user's reference and the treatment.
22. The set pieces are the most produced moments; the talk reaches real material (footage, a photograph, the real interface, a running system), or `PROGRESS.md` Decisions says why none exists.

**The running order (`beats.md` and the notes)**

23. **The order.** Hook, title and promise, roadmap, three or four parts (each opening on its title beat, or under five minutes its first content beat), recap, conclusion, questions beat, or `beats.md` gives each change and its reason; the voice marks each turn.
24. **The arc holds.** The conclusion answers the hook and returns what it planted; a turn comes near the middle; the strongest objection is stated and answered where the room's role puts it.
25. **Every story carries the point;** the energy peaks in the last third.
26. **The close.** The recap asks the room to recall; the conclusion states the throughline and one concrete next step; the questions beat carries the throughline or the ask, the next step and the contact.

## 3. The critique pass

1. **The brief** (`.review/brief.md`): the **Request**, **Asks ledger** and **Interview** sections of `BRIEF.md` and the standing bar below, verbatim; the benchmark's name and link from `docs/treatment.md`; how to launch (dev command and port, URL, keys, `S` for the speaker view). Only what the audience and the user see.
2. **Run `critique` on the strongest model** (set the Agent tool's `model`), with the prompt the skill prescribes.
3. **Act on the verdict:** fix every blocker and major; record the score and open minors for the final message. Run a second pass only when the user asks.

**The standing bar (paste into the brief):**

> The talk the requester asked for, in the asks ledger, made production-grade and fit for this room. First judge whether every ask is met in the form the requester described. Then judge the craft: an audience that has seen the best talks of this kind, and the benchmark named in the brief, should rate this one higher. Fit means the register the room needs: restraint and evidence where that persuades, wonder and delight where that is the job, and spectacle where it serves. Every beat is legible from the back of the room, every claim is true, and the speaker could give it tomorrow from the speaker view alone.

**Scores** (8 and up need every ask met): 10, better than the benchmark and the reference board's best · 9, the best of its kind this audience has seen, nitpicks only · 8, excellent, with some weak beats or one weaker area · 7, produced, with generic stretches or motion or legibility problems · ≤ 6, an ask missed or more work needed.

## Fixing

- Fix every blocker and major from the review and the critique, and the cheap minors. Answer a finding you disagree with by evidence (a source, a computation, a frame).
- For a claim that falls: fix it, soften it (qualifier in the notes), or cut its beat.
- Rerun what each fix touches: the specs for changed beats, the motion test for changed transitions. Re-shoot once after the last fix and look at the changed beats. A change that alters a part's story gets a fresh review.
- Take a fix that would change an ask to the user.

## Release check

1. **Publish** to the host in `BRIEF.md` (engineering.md §9) and check the URL.
2. **Offline backup.** Put a local build on the presenting machine (`npm run build && npm run preview`, or the built `dist/` folder), so the talk runs without the venue's network, and walk it once.
3. **Walk the published link** in a clean browser profile, on the presenting machine when you can, with the confirmed setup: the first beat appears cleanly; the pointer advances and goes back; set pieces play at frame rate; clips play with sound after a click, `F` or `S` in the audience window; `S` opens the speaker view with the confirmed contents, in sync both ways; `F` toggles fullscreen and `Esc` leaves it.
4. **Credits.** Every asset in the build has a used row in `MATERIALS.md` with source and licence (and prompt, if generated); the credits beat lists every asset whose licence asks for credit.
5. **Sharing.** The link previews with the talk's title, a one-line description and a share image.
6. **Phone.** On a phone in landscape, the stage fits and a tap advances.

## The final message

A short chat message, one fact per line, readable cold hours later:
- **Checkpoints** (first, in unattended runs): what each would have shown, and your choice.
- **Link:** the published URL (with the default host, public and unlisted).
- **How to present,** in two lines: open the link (with any `?fallback=` the talk should start with, decided at rehearsal; engineering.md §5), `S` for the speaker view on the speaker's screen, `F` for fullscreen on the audience screen, then the confirmed pointer.
- **Offline backup:** where the local build is and the one command that starts it.
- **Handout:** `out/handout.pdf` attached (rest frames with cue and script), for sharing after the talk.
- **Asks:** each ledger row with its beat; any changed ask, with the user's OK.
- **Style:** the direction picked, and why.
- **QA:** the suite's result (skips; excluded tests, with why), the review's findings fixed and open, the critique's score and open minors.
- **For you:** the `FILL` and `CONFIRM` items, claims marked ↻ to re-check the day before, clips lacking a licence (each with its owner and a drafted request), rehearsing aloud with the speaker view (then **Save rehearsal** and `npm run timing -- --rehearsal <file>` to fit the timing to the real pace), and checking the venue's screen and pointer.
