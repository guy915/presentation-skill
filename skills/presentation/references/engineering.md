# Engineering

Read the runtime's `RUNTIME.md` (API, manifest, commands, tests) and `AGENTS.md` (invariants) first. Prefer installed tools. Check every library API in Context7 or the official docs before coding. Give beats slug ids.

## 0. Project setup

In phase 0, in the project folder the interview confirmed (default in `defaults.md`):
1. **Copy the runtime:** `rsync -a --exclude node_modules --exclude dist --exclude out --exclude test-results --exclude test/runtime --exclude test/fixtures ${CLAUDE_SKILL_DIR}/assets/runtime/ <folder>/` (without rsync: `cp -R ${CLAUDE_SKILL_DIR}/assets/runtime/. <folder>/ && rm -rf <folder>/{node_modules,dist,out,test-results,test/runtime,test/fixtures}`). The runtime's own tests stay in the skill; the talk gets its suite.
2. **Add the files:** rename `gitignore` to `.gitignore`; copy `${CLAUDE_SKILL_DIR}/assets/templates/` to the root; move `treatment.md` into `docs/`.
3. **Set** `talk.slot`, `talk.lang` and `talk.aspect` in `src/beats.ts`.
4. **Install** (Node ≥ 22.18): `npm ci`, `npx playwright install chromium`, `git init`, commit (with no git identity configured, set a local one for the repo).
5. **Create the repo:** `gh repo create <talk-slug> --private --source . --push`. When `gh` is missing or unauthenticated, continue locally and list publishing as an open item.

## 1. The contract

`render(beat, progress, live)` is a pure function of `(beat, progress)` (RUNTIME.md, "The section contract"): no path history, click counts or leftover state. Use `live` for media timing only.

## 2. Scene patterns

**DOM and GSAP.** One `timelineScene` per section, with a label `b<n>` where beat n rests, still beats included.
- Set start states with `.set(…, 0)` or `.from(…)`.
- Put easing inside the tweens; progress moves linearly in time.
- Put every change on the timeline as a tween or `.set`; `onComplete`, delayed calls and `repeat: -1` run outside progress.
- GSAP's plugins (Flip, MorphSVG, DrawSVG, SplitText) are free to use.

**Canvas and SVG.**
- A canvas scene clears and redraws from `(beat, progress)`; precompute geometry in `mount`. Leave `duration` undefined so `combine` stretches it over the transition.
- Seed randomness per beat, or precompute it.
- A full-stage SVG at 1920×1080: `left: 96px; top: 54px; width: 1728px; height: 972px` and `viewBox="96 54 1728 972"` (stage coordinates, inside the safe area).

**WebGL and 3D.**
- One renderer for the whole talk, in a shared module; browsers drop the oldest context past about 16.
- Draw inside `render`. Run an ambient loop only while `root.matches(".present")`.
- In `ready`, load models and textures and call `renderer.compile(scene, camera)`.
- Sections stay mounted: dispose what a beat replaces.
- **Blender** (the Blender MCP, or `blender -b`) makes the talk's own 3D: stills, image sequences or glTF (Draco/KTX2).

**Other visuals.** manim (`-t` for transparency); Lottie and Rive with frames driven by the beat. Typeset maths (KaTeX, MathJax SVG) and highlight code (Shiki) at build time.

**Video beats.** `videoScene(video, beat)` owns the element's time; the timeline owns visibility and layout. List the clip in the beat's `assets`. A clip that speaks gets a `hold` of its length. To step a clip on clicks, set `currentTime` from `(beat, progress)` in place of `videoScene`.

**Persistent objects.** An object that travels unbroken into the next scene belongs to one longer section. When the subject changes, cut: start the next section's first beat on the same position, size and colour. Name every persistent object in `beats.md` with its defining numbers.

**Style directions (phase 2).** One direction: build it on main. Two or more: build each as real sections on a branch `style-<letter>`, run `npm run shots`, and copy `out/shots/rest/` to `out/directions/<letter>/` (each shots run clears `out/shots/`). Tile them into one labelled composite with ffmpeg's `tile` filter. Merge the picked branch into main.

## 3. Live data and computation

Run it live when seeing the real system run is the point; otherwise bake a result or a clip.
- Fix the timestep and seed of every simulation. Run the source's own code (Pyodide with only the needed wheels), with a parameter stepped per click. Pre-cache model weights (transformers.js, ONNX Runtime Web) and warm up in `ready`.
- **Maps:** MapLibre GL JS with self-hosted PMTiles (`pmtiles extract --bbox … --maxzoom …` from a Protomaps build), glyphs and sprites; credit "© OpenStreetMap". Streaming 3D map services forbid copies.
- Bake heavy results to JSON at build time. Past a few thousand marks, draw in canvas or WebGL.

**Data that changes before the talk:**
1. Bake a snapshot to `data/<name>.json` with its source URL and `fetchedAt`; the scene reads only the file.
2. Add `scripts/refresh-<name>.mjs` and a `"refresh"` script. The day before the talk: refresh, `npm test`, commit, publish (§9). List this in the final message.
3. Import the snapshot into `src/beats.ts` (`import snap from "../data/<name>.json" with { type: "json" }`) and write the value into the script in words.
4. Compute clock-based values for the scheduled time (a manifest constant) in place of `Date.now()`.

## 4. Media

**Clips.** List every clip in `media.json` and run `npm run media:fetch` (RUNTIME.md, "Commands"). Take the owner's upload, at the highest resolution, a few seconds long.
- **yt-dlp** needs a JS runtime for YouTube (Deno 2.3+, or Node 22+ with `--js-runtimes node`) and the EJS scripts (`pip install -U "yt-dlp[default]"`).
- **When a download is refused:** (1) update yt-dlp and add `bgutil-ytdlp-pot-provider`; (2) `pip install "yt-dlp[default,curl-cffi]"`, then `--impersonate chrome -t sleep`; (3) the owner's press kit, site or direct file, then an archive copy, then an open item for the user.
- **Loudness:** give your own recordings the −16 LUFS, −1.5 dBTP that `media:fetch` applies.
- **Transparency:** stacked alpha (`stacked-alpha-video`).
- **`public/media/` is gitignored.** In a new worktree, `ln -s <main>/public/media public/media`.

**Generated images** (the generator in `defaults.md`, in the user's signed-in browser):
- Attach one style prompt and one reference image to every request.
- For elements that move independently, ask for a cut-out as a transparent PNG.
- Download each at full size, inspect it for artefacts, and log prompt, tool and date in `MATERIALS.md`.

## 5. Fallbacks

Give every risky scene (live computation, heavy WebGL, anything machine-dependent) a still. It shows only when forced with `?fallback=` or when its section fails (RUNTIME.md, "Fallbacks"); a slow scene keeps playing live.
- **Take it:** `npm run shots` writes `public/rest/<id>.jpg`; copy it to `public/fallbacks/<id>.jpg` and set the beat's `fallback` to `fallbacks/<id>.jpg`. Retake it when the scene changes.
- **Rehearse it:** `?fallback=<section or beat id>` or `?fallback=all`, once, on the presenting machine, on mains power. Where the live scene stutters there, the talk starts with that `?fallback=`; the final message names it.

## 6. Performance

- **A motion-test failure** is a stutter the room would see.
- **Run heavy scenes throttled:** `TALK_CPU_THROTTLE=4 npx playwright test --project motion --no-deps`; every scene must pass it, or the talk runs with `?fallback=<id>` decided at rehearsal (§5). Tune a scene to that bar and stop.
- **Check WebGL set pieces headed** (add `--headed`; headless WebGL is software), and on the presenting machine when you can.
- Keep the machine awake during long unattended work (`caffeinate -i`, `systemd-inhibit`).
- **When a scene fails:** profile one played transition, precompute in `mount` or `ready`, and draw less. Still failing: pre-render it as a video beat.
- Fix the scene; keep the thresholds and allow-lists as shipped.

## 7. Parallel builds

Talks over 15 minutes build their areas in parallel git worktrees, one per area agent (SKILL.md, the scale table).
- **Brief** each agent with `BRIEF.md`, `beats.md`, the treatment and tokens, its beats and assets, the acceptance (its specs pass; its strips and screening sheets pass the QA checklist) and the report you want.
- **Create:** `git worktree add ../<talk>-<area> -b area/<area>`, then `npm ci` in it (a copied `node_modules` breaks Vite).
- **Ports:** a `TALK_PORT_BASE` per worktree, 100 apart from 4610 and each other (`TALK_PORT_BASE=4710 npm test`; RUNTIME.md, "Ports").
- **Media:** symlink `public/media` (§4).
- **Test with `--project talk`;** the motion test runs once, at QA.
- **Integrate serially:** merge one area at a time and run the specs for what it brings. After the last merge, the full suite runs once on an idle machine: QA's `npm test`.

## 8. What to run, and when a test fails

Run what covers the change; slow runs happen once.
- **Phase 1:** write the plan into `src/beats.ts`; `npm run beats`, `npm run timing`. `npm run dev` shows placeholders; `npm run shots` writes the contact sheet (`out/shots/contact.png`).
- **Phase 3:** the specs that cover the change (RUNTIME.md, "Add a section"), and a look at the beat in the dev server.
- **Phase 4:** `npm test` once, on the finished talk, on an idle machine; after a fix, rerun what it touched. `npm run shots` and `npm run screening` once for the review and `critique`, and once after the last fix.
- **Release:** publish once (§9), after its dry run; `npm run handout` for the handout PDF.
- `npm run test:runtime`, in the skill's own `assets/runtime/`, only when you change the engine, the tools or the tests.
- Tests for unused features skip themselves; list the skips in the final message. Exclude a test deliberately only with `npm test -- --grep-invert "<title>"` and a reason.

**When a test fails:**
- **Fix the talk;** the tests encode the format. The failure line names the beat, the element and the value.
- **`test/allow.ts`** takes deliberate exceptions only (RUNTIME.md, "Tests"), each with a reason.
- **The glance ceilings measure DOM text only;** the QA review checks canvas and WebGL text by eye.
- **A load flash** means something paints before the stage is ready: keep everything inside `#stage`, load data in `ready`, and let module code style only its own section. When the load-flash test passes while the flash shows, report a runtime bug.
- **A flaky test** is a bug, usually a race with media or fonts. Find the cause and fix it.

## 9. Publish

`npm run build` writes `dist/`, a static site with relative paths. Publish to the host `BRIEF.md` confirms; present from its link.

**Every host:**
- **Commit everything first,** including the share image under `public/`: deploy builds HEAD.
- **Noindex:** `npm run deploy` adds it; elsewhere, add `<meta name="robots" content="noindex">` to each HTML file in `dist/` or set `X-Robots-Tag: noindex`.
- **Link preview:** in `index.html`, set `<title>`, a one-line `description`, `og:title`, `og:description` and `og:image` (a 1200×630 crop of the title beat's rest frame, at its absolute published URL).
- Build from the working tree that holds `public/media/` and `public/rest/`.

**GitHub Pages (default):**
- **Dry-run first:** `npm run deploy -- --dry-run` lists every file and size, the commit, target and URL; check them, then `npm run deploy`.
- **Turn Pages on** once, after the first deploy, on the repo that received `gh-pages`: `gh api -X POST repos/<owner>/<repo>/pages -f 'source[branch]=gh-pages' -f 'source[path]=/'`; allow about a minute.
- **Free plan** (`gh api user --jq .plan.name`): Pages cannot serve a private repo, so `gh repo create <talk>-site --public`, then `npm run deploy -- --site-repo <owner>/<talk>-site`.
- Re-encode or trim any clip deploy refuses as too large.

**Another static host:** upload `dist/`, check its file-size limit against the largest clip, add noindex, check the URL.

**A confidential talk** stays local: `npm run build && npm run preview` on the presenting machine.
