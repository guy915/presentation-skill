// The engine: beats -> sections -> one <section> each, one click = one beat.
// It owns which section shows (.present), input, the hash, transitions,
// fallbacks and the test contract.
import type { Beat, Rehearsal, Talk } from "./manifest.ts";
import { KEYS, seconds, stageSize, WPM } from "./manifest.ts";
import type { Scene, Section } from "./section.ts";
import { isTop, listen, send, session, REHEARSAL } from "./channel.ts";
import { placeholder } from "./placeholder.ts";
import "./motion.ts"; // sets html[data-motion] before any section builds
import { refitCanvases } from "./canvas.ts";

const FOCUS_CLICK_MS = 400; // a click this soon after the window regains focus only focuses it
const READY_MS = 5000; // a section not ready by then counts as failed
const FONTS_MS = 5000; // fonts not loaded by then: carry on (the visual test names them)
const CLOCK = "talk-clock"; // sessionStorage key: when the talk's clock started, epoch ms

/** Test knob (?break=<section>:mount|ready|render): the section throws in
 *  mount, never gets ready, or throws in a played render. */
function broken(section: Section, how: string): Section {
  return {
    html: section.html,
    mount(root) {
      if (how === "mount") throw new Error("?break: mount");
      const scene = section.mount(root);
      if (how === "ready") return { ...scene, ready: new Promise(() => {}) };
      if (how !== "render") return scene;
      return {
        ...scene,
        render(b, p, live) {
          if (live) throw new Error("?break: render");
          return scene.render(b, p, live);
        },
      };
    },
  };
}

/** A section with no scene yet: each beat shows what the audience will see (its `sees`). */
function placeholderSection(list: Beat[]): Section {
  return {
    html: `<div class="rt-placeholder-area">${placeholder("")}</div>`,
    mount(root) {
      const box = root.querySelector(".rt-placeholder")!;
      return { render: (b) => void (box.textContent = list[b].sees ?? list[b].label) };
    },
  };
}

export async function start(beats: Beat[], built: Record<string, Section>, talk?: Talk) {
  document.documentElement.lang = talk?.lang ?? "en";
  const params = new URLSearchParams(location.search);
  // ---- manifest -> sections ----------------------------------------------
  const sections = { ...built };
  for (const b of beats) sections[b.section] ??= placeholderSection(beats.filter((x) => x.section === b.section));
  const [brokenId, how] = (params.get("break") ?? "").split(":");
  if (sections[brokenId]) sections[brokenId] = broken(sections[brokenId], how);
  const order: string[] = [];
  const flat = beats.map((beat, i) => {
    if (beats[i - 1]?.section !== beat.section) {
      if (order.includes(beat.section)) throw new Error(`section "${beat.section}" is split: its beats must be consecutive`);
      order.push(beat.section);
    }
    return { beat, h: order.length - 1, local: beats.slice(0, i).filter((b) => b.section === beat.section).length };
  });
  const firstOf = (h: number) => flat.findIndex((e) => e.h === h);

  const stage = document.getElementById("stage")!;
  // The stage's size, from talk.aspect (?aspect= overrides it: a test knob).
  const size = stageSize(params.get("aspect") ? { aspect: params.get("aspect")! } : (talk ?? {}));
  document.documentElement.style.setProperty("--stage-w", `${size.width}px`);
  document.documentElement.style.setProperty("--stage-h", `${size.height}px`);
  const slides = stage.querySelector(".slides")!;
  slides.innerHTML = order.map((id) => `<section data-section="${id}">${sections[id].html}</section>`).join("");
  const roots = [...slides.children] as HTMLElement[];
  /** Section h is the one that shows; the rest stay laid out, hidden (runtime.css). */
  const show = (h: number) => roots.forEach((r, k) => r.classList.toggle("present", k === h));
  let cur = -1;
  let anim: { i: number; t0: number; dur: number; raf: number } | null = null;

  // ---- stage: size.width x size.height, letterboxed. Fitted before sections mount, so a
  // canvas sized in mount (./canvas.ts) knows the scale; a refit sizes those
  // canvases again and, since that clears them, renders the current beat again.
  function fit() {
    // the layout viewport, not innerWidth: on a phone, innerWidth grows to take in the
    // unscaled stage that overflows it on load, so the first fit came out zoomed in
    const { clientWidth: w, clientHeight: h } = document.documentElement;
    const s = Math.min(w / size.width, h / size.height) || 1; // 0 in a sizeless window: stay unscaled
    // whole pixels: a fractional offset resamples the whole stage and blurs every line of text
    const x = Math.round((w - size.width * s) / 2);
    const y = Math.round((h - size.height * s) / 2);
    stage.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    if (refitCanvases(s) && cur >= 0 && !anim) render(cur, 1, false);
  }
  fit();

  // ---- fonts: every bundled face loads before any section mounts, so scenes
  // that measure text, and canvas text (which layout never requests), get the
  // final metrics. All of them: they are local and small.
  void stage.offsetWidth; // layout, which requests the faces the markup uses
  await Promise.race([
    Promise.all([...document.fonts].map((f) => f.load().catch((err) => console.error(`font "${f.family}" failed to load:`, err)))),
    new Promise((r) => setTimeout(r, FONTS_MS)),
  ]);

  // ---- fallbacks: a still per beat, shown when its section is degraded:
  // forced (?fallback=, decided at rehearsal) or failed (below)
  const forced = params.get("fallback");
  const degraded = new Set(order.filter((id) => forced === "all" || forced === id || beats.some((b) => b.section === id && b.id === forced)));
  const fallbacks: (HTMLElement | null)[] = flat.map((e) => {
    if (!e.beat.fallback) return null;
    const img = document.createElement("img");
    img.className = "rt-fallback";
    img.hidden = true;
    img.src = e.beat.fallback;
    roots[e.h].append(img);
    return img;
  });
  function showFallbacks(i: number) {
    const on = degraded.has(flat[i].beat.section);
    fallbacks.forEach((f, k) => f && (f.hidden = !(on && k === i)));
  }

  // What renders are still doing (a clip seeking), for
  // settled(). Each entry leaves once done, so live use, where nothing ever
  // calls settled(), keeps nothing.
  const pending = new Set<Promise<unknown>>();
  function track(x: unknown) {
    if (!(x instanceof Promise)) return;
    const p = x.then(
      () => void pending.delete(p),
      () => void pending.delete(p),
    );
    pending.add(p);
  }

  // ---- failures: a section whose code throws or never gets ready is degraded
  // for good. Each of its beats shows its fallback, else its rest still
  // (public/rest/<id>.jpg, written by npm run shots), else its `sees` text.
  const failed = new Set<string>();
  function fail(id: string, err: unknown) {
    if (failed.has(id)) return;
    failed.add(id);
    degraded.add(id);
    console.error(`section "${id}" failed, showing its stand-ins:`, err);
    flat.forEach((e, k) => {
      if (e.beat.section !== id || fallbacks[k]) return;
      const img = document.createElement("img");
      img.className = "rt-fallback";
      img.hidden = true;
      img.onerror = () => {
        const text = document.createElement("div");
        text.className = "rt-fallback rt-placeholder-area";
        text.innerHTML = placeholder("");
        text.firstElementChild!.textContent = e.beat.sees ?? e.beat.label;
        text.hidden = img.hidden;
        img.replaceWith(text);
        fallbacks[k] = text;
      };
      img.src = `rest/${e.beat.id}.jpg`;
      roots[e.h].append(img);
      fallbacks[k] = img;
    });
  }
  const inert: Scene = { render() {} };

  // ---- mount -------------------------------------------------------------
  const scenes: Scene[] = order.map((id, h) => {
    try {
      return sections[id].mount(roots[h]);
    } catch (err) {
      fail(id, err);
      return inert;
    }
  });
  await Promise.all(
    scenes.map(
      (s, h) =>
        new Promise<void>((done) => {
          const t = setTimeout(() => (fail(order[h], new Error(`not ready after ${READY_MS} ms`)), done()), READY_MS);
          Promise.resolve(s.ready)
            .catch((err) => fail(order[h], err))
            .then(() => (clearTimeout(t), done()));
        }),
    ),
  );
  function render(i: number, p: number, live: boolean) {
    const e = flat[i];
    const id = e.beat.section;
    // A degraded section's live scene stops rendering wherever its stand-in
    // shows, so the fallback sheds the load instead of adding to it. A beat
    // of it without a fallback still shows (and renders) the live scene.
    if (!failed.has(id) && !(degraded.has(id) && fallbacks[i])) {
      try {
        const out = scenes[e.h].render(e.local, p, live);
        if (out instanceof Promise)
          track(
            out.catch((err) => {
              fail(id, err);
              if (cur === i) showFallbacks(i);
            }),
          );
      } catch (err) {
        fail(id, err);
      }
    }
    showFallbacks(i);
  }

  function finish() {
    if (!anim) return;
    cancelAnimationFrame(anim.raf);
    const { i } = anim;
    anim = null;
    render(i, 1, false);
    announce(); // at rest: the speaker view's ready bar goes
  }

  function tick(now: number) {
    if (!anim) return;
    const a = anim;
    const p = Math.min(1, (now - a.t0) / 1000 / a.dur);
    if (p >= 1) return finish();
    render(a.i, p, true);
    a.raf = requestAnimationFrame(tick);
  }

  /** To beat `target`: played if it is the next one, else at rest; seek passes `progress`. */
  function go(target: number, { instant = false, progress }: { instant?: boolean; progress?: number } = {}) {
    if (!flat.length) return; // an empty manifest: an empty stage, nothing to go to
    const i = Math.max(0, Math.min(flat.length - 1, target));
    finish(); // a transition still playing completes first
    const prev = cur;
    if (prev === i) return void (progress !== undefined && render(i, progress, false));
    // A section left behind goes back to its first beat, so off-screen state never depends on history.
    if (prev >= 0 && flat[prev].h !== flat[i].h) render(firstOf(flat[prev].h), 1, false);
    cur = i;
    logStay(i);
    const e = flat[i];
    preload(i + 1);
    show(e.h);
    const dur = scenes[e.h].duration?.(e.local) ?? 0;
    // Reduced motion plays too (./motion.ts): sections pick gentler variants.
    if (!instant && prev === i - 1 && dur > 0) {
      anim = { i, t0: performance.now(), dur, raf: requestAnimationFrame(tick) };
      render(i, 0, true);
    } else render(i, progress ?? 1, false);
    history.replaceState(null, "", `${location.pathname}${location.search}#/${e.beat.section}/${e.local}`);
    announce();
  }

  /** Beat i at progress p, straight there: never through its settled state first
   *  (a clip would seek to its end, GSAP would fire its completions). */
  function seek(i: number, p: number) {
    go(i, { instant: true, progress: p });
  }

  async function settled() {
    while (anim || pending.size) {
      await Promise.all(pending);
      await new Promise(requestAnimationFrame);
    }
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  }

  /** Clips of this beat and the next (their manifest `assets`) buffer fully;
   *  others load metadata only. The speaker view's previews stay at metadata:
   *  the audience window buffers each clip once. */
  function preload(i: number) {
    const full = isTop ? "auto" : "metadata";
    const wanted = [...(flat[i - 1]?.beat.assets ?? []), ...(flat[i]?.beat.assets ?? [])];
    for (const v of stage.querySelectorAll("video")) v.preload = wanted.includes(v.getAttribute("src")!) ? full : "metadata";
  }

  // ---- the talk's clock, owned by the audience window: starts when the talk
  // starts, i.e. when the audience window first goes fullscreen on a content
  // beat, or on the speaker's first advance onto one. Kept per tab: a reload
  // (the URL names a beat) keeps it; a fresh load clears it for a new run.
  let started = 0;
  if (isTop) {
    try {
      if (fromHash() !== null) started = Number(sessionStorage.getItem(CLOCK)) || 0;
      else sessionStorage.removeItem(CLOCK);
    } catch {} // storage blocked: the clock lasts until reload
  }

  // ---- the rehearsal log: seconds each beat stays on screen while the clock
  // runs (a revisit adds to its beat). Kept with the clock in this window, in
  // localStorage per talk and tab, where the speaker view reads it to save it.
  // A reload keeps it; a fresh load, which clears the clock, starts a new one.
  const fresh = (): Rehearsal => ({ started, spent: flat.map(() => 0), on: -1, since: 0 });
  let log = fresh();
  if (isTop) {
    try {
      const kept = JSON.parse(localStorage.getItem(REHEARSAL) ?? "null") as Rehearsal | null;
      if (started && kept?.started === started) log = kept;
      else localStorage.removeItem(REHEARSAL);
    } catch {} // storage blocked: the log lasts until reload
  }

  /** Ends the stay on screen that is open and opens one on beat i. */
  function logStay(i: number) {
    if (!isTop || !started) return;
    const now = Date.now();
    if (log.started !== started) log = fresh();
    if (log.on >= 0) log.spent[log.on] = (log.spent[log.on] ?? 0) + (now - log.since) / 1000;
    log.on = i;
    log.since = now;
    try {
      localStorage.setItem(REHEARSAL, JSON.stringify(log));
    } catch {}
  }

  /** Tells the speaker view the beat, the clock, and whether a played
   *  transition still runs (a clip's transition lasts as long as the clip). */
  function announce() {
    if (isTop) send({ kind: "beat", index: cur, started, settled: !anim });
  }

  function startClock(on: number) {
    if (!isTop || started || !flat[on] || (flat[on].beat.kind ?? "content") !== "content") return;
    started = Date.now();
    try {
      sessionStorage.setItem(CLOCK, String(started));
    } catch {}
    logStay(cur);
    announce();
  }

  /** The speaker's next beat (a key, a click, or a key from the speaker view). */
  function next() {
    startClock(cur + 1);
    go(cur + 1);
  }

  /** The beat the URL's hash names, or null for a hash that names none. */
  function fromHash(): number | null {
    const m = location.hash.match(/^#\/([^/]+)\/(\d+)$/);
    const k = m ? flat.findIndex((e) => e.beat.section === decodeURIComponent(m[1]) && e.local === Number(m[2])) : -1;
    return k < 0 ? null : k;
  }

  go(fromHash() ?? 0, { instant: true });

  addEventListener("resize", fit);
  document.addEventListener("fullscreenchange", () => document.fullscreenElement && startClock(cur));

  // ---- input (the audience window only) --------------------------------------
  /** A next or back key (also from the speaker view); false for any other key. */
  function step(key: string): boolean {
    if (KEYS.next.has(key)) next();
    else if (KEYS.prev.has(key)) go(cur - 1, { instant: true });
    else return false;
    return true;
  }
  /** The audience window's keys: next, back, F and S; false for a key the deck
   *  leaves to the browser. A held key acts once: its repeats are swallowed. */
  function key(k: string, repeat: boolean): boolean {
    const own = KEYS.next.has(k) || KEYS.prev.has(k) || /^[fs]$/i.test(k);
    if (!own || repeat || step(k)) return own;
    if (k.toLowerCase() === "f") {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      // the speaker view's previews follow this window's ?fallback=, ?motion= and ?preview=
      const q = new URLSearchParams({ s: session });
      for (const p of ["fallback", "motion", "preview"]) if (params.get(p)) q.set(p, params.get(p)!);
      window.open(`presenter.html?${q}`, "presenter", "width=1280,height=800");
    }
    return true;
  }
  // An edited URL, or the speaker view moving its preview iframe (in every window).
  // A hash that names no beat leaves the deck where it is.
  addEventListener("hashchange", () => {
    const i = fromHash();
    if (i !== null) go(i, { instant: true });
  });
  if (isTop) {
    addEventListener("keydown", (e) => {
      if (!e.metaKey && !e.ctrlKey && !e.altKey && key(e.key, e.repeat)) e.preventDefault();
    });
    // The click that brings the window back into focus (the speaker clicks it
    // before pressing F) only focuses. Decided when the press starts (capture
    // phase, before any scene sees it), so a long press still counts as that
    // click. Counted only after a blur, so a window that never lost focus
    // doesn't eat its first click.
    let away = !document.hasFocus();
    let focusedAt = -Infinity;
    let pressing = false;
    let focusing = false; // the current press is the one that focused the window
    addEventListener("blur", () => (away = true));
    addEventListener("focus", () => {
      if (away) {
        focusedAt = performance.now();
        focusing ||= pressing; // the focus arrived after the press began
      }
      away = false;
    });
    addEventListener(
      "pointerdown",
      () => {
        pressing = true;
        focusing = performance.now() - focusedAt < FOCUS_CLICK_MS;
      },
      { capture: true },
    );
    addEventListener("pointerup", () => (pressing = false), { capture: true });
    // capture phase: the click is the deck's alone, and only advances
    addEventListener(
      "click",
      (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        if (focusing) focusing = false;
        else next();
      },
      { capture: true },
    );
    listen((msg) => {
      if (msg.kind === "hello") announce();
      if (msg.kind === "key") step(msg.key);
    });
    // cursor hides after 2 s still
    let idle = 0;
    const wake = () => {
      document.documentElement.classList.remove("rt-idle");
      clearTimeout(idle);
      idle = window.setTimeout(() => document.documentElement.classList.add("rt-idle"), 2000);
    };
    addEventListener("mousemove", wake);
    wake();
    // keep the screen on while presenting (re-acquired when the tab returns)
    const lock = () => (navigator as any).wakeLock?.request("screen").catch(() => {});
    lock();
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && lock());
  }

  await settled();
  (window as any).__deck = {
    count: flat.length,
    stage: size, // { width, height } in stage px, from talk.aspect
    session, // the speaker view's ?s=
    index: () => cur,
    go,
    seek,
    settled,
    beats: flat.map(({ beat: b, h, local }) => ({
      ...{ id: b.id, section: b.section, label: b.label, notes: b.notes, kind: b.kind ?? "content" },
      duration: seconds(b, talk?.wpm ?? WPM), // planned seconds: speech + hold
      transition: scenes[h].duration?.(local) ?? 0, // seconds the played transition into it takes
    })),
  };
  stage.style.opacity = "1"; // hidden until here, and after __deck: no load flash, and tests never see a shown stage without it
}
