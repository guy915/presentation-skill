# House defaults

One owner's concrete choices. The interview confirms or overrides each slot; `BRIEF.md` records the result. To adapt the skill for someone else, edit this file; the rest of the skill names these slots.

## Presenting

- **Setup:** the speaker's laptop runs Chrome: audience window fullscreen on the projector, speaker view on the laptop
- **Controls:** the clicker alone during the talk. Next: PageDown, Space, ArrowRight, ArrowDown, or a left click on the audience window. Back: PageUp, ArrowLeft, ArrowUp. Set-up: `F` toggles fullscreen (`Esc` also leaves), `S` opens the speaker view, a click on the audience window enables clip sound. **Override:** set a pointer that sends other keys to send one of these, in its own software
- **Speaker view:** the current beat's cue and script; the next beat first and largest, then the current one; time since the start, pace against the plan, a ready bar while the deck moves. One fixed look in every talk, dark or light
- **Sound:** clips carry the only sound, at one loudness
- **Speakers:** one

## Delivery

- **Host:** a public, unlisted GitHub Pages link (`npm run deploy`) on the user's existing plans; present from it. **Override:** any static host serving `dist/` (Netlify, Cloudflare Pages, Vercel, a university web space); `npm run preview` locally for a confidential talk
- **Deliverables:** the talk at its link, a handout PDF (`npm run handout`), and a short final message
- **Checkpoints:** two, each waiting for the user: storyboard and style

## Making assets

- **Image generator:** ChatGPT Images (https://chatgpt.com/images) in the user's signed-in browser, within their plan
- **Generated video, motion and 3D:** Higgsfield, through its MCP, within the user's plan
- **Look and mood references:** Pinterest first (search, visual search, a board per talk), then Are.na, Dribbble and Behance (research.md, "Gathering")
- **3D:** Blender (models, renders, glTF export); Three.js (live 3D in the page)
- **Motion library:** GSAP, as shipped; any library that can seek a paused timeline fits (RUNTIME.md, "The section contract")

## Working

- **Models:** visual work, visual QA and `critique` on the strongest model allowed, at its configured effort (medium when unset); research on a model that judges sources; fetching and other mechanical work on smaller models. **Override:** the user's model settings, or their own research agent
- **Project folder:** `~/Code/<talk-slug>/`, pushed to a private GitHub repo (`gh`)
- **Tool approvals:** `npm`, `npx`, `git`, `gh`, `rsync`, `curl`, `python3`, `yt-dlp`, `ffmpeg`, `blender`, allowed in the user's tool settings before the build
