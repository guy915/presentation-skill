// A clip that plays as the transition into one beat. Played forward it runs
// on its own clock; any other arrival seeks to its settled frame (the last).
// Before its beat it shows its poster. An advance mid-clip fades picture and
// sound out over FADE_MS, then the settled frame fades in.
import type { Scene } from "./section.ts";
import { isTop } from "./channel.ts";

const FADE_MS = 300;
const SEEK_TIMEOUT = 3000;
const FRAME_WAIT = 250; // a hidden video presents no frame: don't wait for one
const ENDS = ["seeked", "loadeddata", "emptied", "error"];
const GESTURES = ["pointerdown", "keydown"]; // what grants a window user activation
// What the poster image copies from the clip, so it covers the clip exactly
// (the section's timeline may move, fade or hide the clip).
const MIRROR = ["transform", "transformOrigin", "opacity", "visibility", "objectFit", "objectPosition", "borderRadius", "zIndex"] as const;

export function videoScene(video: HTMLVideoElement, beat: number): Scene {
  video.muted ||= !isTop; // the speaker view's previews never make sound
  video.playsInline = true;
  video.preload = "metadata"; // the engine raises it a beat ahead (manifest `assets`)
  let running = false; // playing live on its own clock
  let gen = 0; // bumps on every settled render, cancelling a live start still seeking
  let mutedByPolicy = false; // the browser refused sound; the next play tries again
  // The duration, kept once known: a lost value would make the beat a cut.
  let duration = 0;
  video.addEventListener("loadedmetadata", () => (duration = video.duration || duration));
  const end = () => duration || video.duration || 0;

  // The poster as an image over the clip, rather than video.load(): load()
  // drops the clip's data, and a forward press before its metadata returned
  // (a slow network) would cut instead of play.
  const src = video.getAttribute("poster");
  const poster = src ? document.createElement("img") : null;
  if (poster) {
    poster.className = "rt-poster";
    poster.alt = "";
    poster.src = src!;
    poster.hidden = true; // last: showing and hiding it leaves the attributes in this order
    video.after(poster);
  }
  const showPoster = async (on: boolean) => {
    if (!poster) return;
    poster.hidden = !on;
    if (!on) return poster.removeAttribute("style"); // the same markup whatever the path here
    await null; // after every scene's render in this frame: the clip's own style is final
    const cs = getComputedStyle(video);
    Object.assign(poster.style, {
      left: `${video.offsetLeft}px`,
      top: `${video.offsetTop}px`,
      width: `${video.offsetWidth}px`,
      height: `${video.offsetHeight}px`,
      ...Object.fromEntries(MIRROR.map((k) => [k, cs[k]])),
    });
  };

  // Chrome refuses an unmuted play() in a window with no user activation (after
  // a reload, or with keys arriving from the speaker view): play muted rather
  // than freeze. The next press or key in the audience window grants activation
  // and gives the running clip its sound back (a one-time listener); the next
  // play tries sound again in any case.
  const unmute = (e: Event) => {
    if (!e.isTrusted) return;
    for (const type of GESTURES) removeEventListener(type, unmute, { capture: true });
    if (mutedByPolicy) video.muted = mutedByPolicy = false;
  };
  const play = async () => {
    if (mutedByPolicy) video.muted = mutedByPolicy = false;
    try {
      await video.play();
    } catch (err) {
      if ((err as DOMException)?.name !== "NotAllowedError" || video.muted) return;
      video.muted = mutedByPolicy = true;
      for (const type of GESTURES) addEventListener(type, unmute, { capture: true });
      await video.play().catch(() => {});
    }
  };
  const ready = Promise.all([
    new Promise<void>((r) => {
      if (video.readyState >= 1) r();
      video.addEventListener("loadedmetadata", () => r(), { once: true });
      video.addEventListener("error", () => r(), { once: true });
    }),
    poster?.decode().catch(() => {}),
  ]);
  // A seek is done once its frame is on screen (requestVideoFrameCallback;
  // "seeked" alone can come before the compositor shows it, which a busy
  // machine's screenshots caught). It also ends if a later render resets the
  // element ("emptied"), and after SEEK_TIMEOUT at worst: settled() must never hang.
  const presented = () =>
    new Promise<void>((r) => {
      const t = setTimeout(r, FRAME_WAIT);
      video.requestVideoFrameCallback?.(() => (clearTimeout(t), r()));
    });
  const seek = (t: number) =>
    new Promise<void>((r) => {
      const done = (e?: Event) => {
        clearTimeout(timer);
        for (const n of ENDS) video.removeEventListener(n, done);
        if (e?.type === "seeked" || e?.type === "loadeddata") presented().then(r);
        else r();
      };
      const timer = setTimeout(done, SEEK_TIMEOUT);
      for (const n of ENDS) video.addEventListener(n, done);
      if (Math.abs(video.currentTime - t) >= 1e-3) video.currentTime = t;
      else if (video.readyState >= 2) done();
    });

  // Web Animations for the picture: it never touches the style attribute,
  // which GSAP may own. Volume ramps by hand. The fade out holds at 0 (fill)
  // until the settled frame is in place and fades in over it; without the
  // hold, the mid-clip frame would pop back at full opacity first.
  let fading: Promise<void> | null = null;
  let faded: Animation | null = null; // the fade out, holding at 0
  let fadingIn: Animation | null = null;
  const fadeOut = () =>
    (fading ??= new Promise<void>((resolve) => {
      const v0 = video.volume;
      const t0 = performance.now();
      faded = video.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, fill: "forwards" });
      const tick = () => {
        const k = Math.min(1, (performance.now() - t0) / FADE_MS);
        video.volume = v0 * (1 - k);
        if (k < 1) return void requestAnimationFrame(tick);
        video.pause();
        video.volume = v0;
        fading = null;
        resolve();
      };
      requestAnimationFrame(tick);
    }));
  const clearFades = () => {
    faded?.cancel();
    fadingIn?.cancel();
    faded = fadingIn = null;
  };

  return {
    ready,
    // a little slack: the clip ends on its own clock before the engine settles
    duration: (b) => (b === beat && end() ? end() + 0.25 : 0),
    async render(b, p, live) {
      if (video.readyState < 1) await ready;
      if (b === beat && live && p < 1) {
        if (running) return;
        running = true;
        clearFades();
        void showPoster(false);
        const g = gen;
        await seek(p * end());
        if (g === gen) await play();
        return;
      }
      const g = ++gen;
      const wasRunning = running;
      running = false;
      if (b < beat || (b === beat && p === 0)) {
        video.pause();
        clearFades();
        await Promise.all([showPoster(true), seek(0)]); // under the poster, ready to play
        return;
      }
      void showPoster(false);
      // an advance mid-clip fades it out rather than cutting
      if (wasRunning && !video.paused && end() - video.currentTime > 0.1) fadeOut();
      if (fading) await fading;
      video.pause();
      await seek(b === beat ? p * end() : end());
      if (faded && g === gen) {
        fadingIn = video.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS });
        faded.cancel();
        faded = null;
        await fadingIn.finished.catch(() => {}); // cancelled by a later render: fine
        fadingIn = null;
      }
    },
  };
}
