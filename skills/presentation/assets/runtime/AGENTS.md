# Invariants for agents working in a talk repo

0. **The user's words are the spec.** `BRIEF.md` holds the request verbatim and the asks ledger. Build each beat to serve its ask, in the form the user described; take questions about an ask to the lead.
1. **One click = one beat,** one entry in `src/beats.ts`. Every advance starts with a click; sequences and timers run inside a beat and end at rest. The speaker holds only a clicker (next, back), so every moment runs on clicks alone.
2. **Reversible.** A section's state is a pure function of `(beat, progress)`: back, jump, cold load and reload land exactly where playing forward does.
3. **Every beat comes to rest** (progress 1); a click mid-transition settles it and advances in one press.
4. **Self-hosted.** Everything ships in the build and loads from the talk's own origin. Download any public resource it needs and give it a row in `MATERIALS.md` (source, licence). Set stage text in bundled faces (RUNTIME.md, "Fonts"). Get clips with `npm run media:fetch` as original files; capture screenshots and recordings of software the talk teaches yourself, with demo accounts and files.
5. **The stage holds content, at a glance:** the labels, names, numbers and captions the audience needs; qualifiers and sources go in the notes. Per beat: at most 25 words, 60 characters a line and four type sizes, except text in `DENSE_TEXT`.
6. **Notes are the spoken script:** line 1 is the cue, then the words as said, ending in one `[click]` (none on the last beat). They ship on the link for the speaker view: write them for the audience's ears, free of build history (versions, QA rounds, ADRs, commits).
7. **Fix the talk; the tests encode the format.** `test/allow.ts` is the one test file a talk edits, each entry with its reason.
8. **The manifest is the source.** Edit `src/beats.ts`; `npm run beats` regenerates its block in `beats.md`.
9. **Build on the contract** in RUNTIME.md and keep `src/runtime/` as shipped. Put the talk's faces and tokens in `src/theme.css`.
10. **Check what you changed before handing back:** run the specs that cover it (RUNTIME.md, "Add a section") and look at the beats you built. The full `npm test`, `npm run shots` and `npm run screening` run at QA.
