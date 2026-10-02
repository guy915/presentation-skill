# Research (phases 1 and 2)

Phase 1 gathers wide, before the story is written; phase 2 goes deep on what the approved beats need. Agents follow the SKILL.md scale table, each filling its file from the template and returning a short summary. Open every URL you cite.

## Gathering (phase 1)

Scour the web in three threads, one agent each when the scale table gives agents. Cast wide first (about 10–20 candidates a thread), then keep the strongest 3–5.

- **Inspiration → `docs/treatment.md`** (Exemplars): the best work that does this talk's job or shares its subject, in any medium.
  - Talks and lectures: TED and TEDx, conference keynotes, university lectures, the field's best-known speakers.
  - Explainers: 3Blue1Brown, Kurzgesagt, Veritasium, Primer, Vox, the topic's best YouTube and course channels.
  - Visual journalism and interactives: The Pudding, NYT and FT graphics, Distill, Bartosz Ciechanowski, Nicky Case, Explorable Explanations.
  - Look and mood: **Pinterest** (search the topic and the register; its visual search finds look-alikes of the user's reference images; save the strongest to a board for the talk), Are.na, Dribbble and Behance, film title sequences. Where a site asks for a login, browse it in the user's signed-in browser.
  - Motion and design technique: Codrops, Awwwards, CodePen.
  - For each, note what it does best and the technique to take. The strongest becomes the benchmark.
- **Sources → `CLAIMS.md`** (status ◐ until phase 2): primary papers and reports, official data, reviews, the field's standard textbook, and the misconceptions the audience holds, each with where it is said wrong.
- **Assets → `MATERIALS.md`** (status candidate): first the user's named material and own files; then real footage, photographs, screenshots and recordings of the real interface, data sets, 3D models, maps, and existing visualisations or code to fork. Note each one's licence as found.

**The reference board.** Screenshot or still each kept find, label it (thread, title, one line on what it brings), mark the benchmark, and tile them into `out/references/board.png` with ffmpeg's `tile` filter. It goes to checkpoint 1, so the user sees and steers the direction before anything is built.

## Truth and material (phase 2)

**Truth → `CLAIMS.md`:** facts, numbers, stories and common misconceptions, each with a primary source, its evidence, a status and a check date. Wikipedia maps sources; only the source earns the ✔. For a paywalled or moved source, use the author's copy or an archived page, and say so.

**Material → `MATERIALS.md`:** the real material the beats name. Search in order: what the user named in the ledger, the user's own files, material closest to the audience (their place, institution or field), then the topic's best public sources. Download what the talk uses into the repo. Every row ends used, or replaced with a reason.

Source notes:
- **Museums** (Met, Rijksmuseum, Smithsonian): CC0 covers public-domain objects only; check each record. IIIF deep zoom lets a beat move from the whole object into one detail.
- **Space:** NASA and its SVS clips, ESO, ESA/Webb. **Data:** Our World in Data, Natural Earth, Copernicus Sentinel (credit "Contains modified Copernicus Sentinel data [Year]"), GBIF; draw each series from its source data.
- **Wikimedia Commons:** send a descriptive User-Agent and back off on 429, or use the Wikipedia API's `generator=images`. On a 403 or an empty reply, back off, then fetch `https://commons.wikimedia.org/wiki/Special:FilePath/<file>?width=<px>`.
- **Quick verification:** `https://api.crossref.org/works/<doi>` for a journal source; Wikipedia's `?action=raw` for a table's numbers.
- **3D and textures:** Sketchfab (CC0, BY, BY-SA only), Poly Haven, ambientCG.
- **Footage:** the owner's upload at the highest resolution, via `npm run media:fetch` (engineering.md §4).

## Software walkthroughs

The material is the real interface: screenshots and silent screen recordings, captured now. Use the user's screenshots; capture missing steps in their signed-in browser once they approve it in the interview, with demo accounts where available, cropping out names, emails and chat history. Crop and zoom each capture to the control the step uses.

## Studying exemplars

- **The benchmark** is the best existing work, in any medium, that does this talk's job for this audience; when the best of its kind is private, take the best public work doing that job. Study it first-hand, at the depth the scale table gives, and record it in `docs/treatment.md`.
- **`${CLAUDE_SKILL_DIR}/scripts/study-video.sh <url|file>`** measures pacing or a speaker's rate: contact sheets, cut rate, transcript, words per minute. `--transcript-only` fetches captions for a URL; for a local file, put `<name>.srt` beside it. `SUB_LANGS=<code>` picks the language. Output: `docs/benchmark/<slug>/`, `out/study/<slug>/`.
- **Technique** comes from exemplars, Codrops, CodePen and Awwwards, rebuilt to the runtime's contract. The look comes from the user's reference, the topic and the treatment.

## Licences at a glance

Log every asset's licence and credit in `MATERIALS.md`; check each item's own rights statement.

| Source | Licence | For a talk |
|---|---|---|
| Fonts for the talk's type | per font | bundle only web-embeddable fonts (OFL, Apache, UFL: all Google Fonts); a subset OFL font with a Reserved Font Name needs a rename; a commercial or system font needs a webfont licence |
| A font as the subject | foundry | render words to images or SVG from a licensed copy, font file out of the build; label a metric clone (Liberation, TeX Gyre) a substitute |
| Logos | trademark, often copyright | the name identifies; show the logo only when the brand is the subject, unaltered, minimal, no implied endorsement |
| Third-party clips | owner's copyright | credits beat; hosted as-is once the user confirmed (SKILL.md, "Standing permissions") |
| OpenStreetMap | ODbL | "© OpenStreetMap" on each map beat |
| NASA | US government | free; apart from generated images; no agency logos; credit NASA, no implied endorsement |
| ESO, ESA/Webb | CC BY 4.0 | exact credit, visible with the image |
| Museums, Poly Haven, ambientCG, Wikimedia, Internet Archive, Europeana, Sketchfab, GBIF, OWID | per item | CC0: free, credit is courtesy; BY, BY-SA → credits beat; NC or "educational": non-commercial, unsponsored talks, with credit |
| Generated images (ChatGPT Images) | OpenAI terms | the user owns them; fictional people only |
