// GSAP beats: one paused timeline per section, with a label "b<n>" placed
// where beat n comes to rest. The transition into beat n is the stretch
// between b<n-1> (or 0) and b<n>; render(n, p) seeks to p of the way along it.
// Every beat needs its label, even one with nothing to animate (tl.addLabel).
import { gsap } from "gsap";
import type { Scene } from "./section.ts";

// 2D transforms only: GSAP switches to translate3d mid-tween by default,
// which would leave a played beat's DOM different from a jumped one.
// Measured (2026-09, headless Chromium, a 1600x860 grid of 400 shadowed,
// gradient tiles moved by a 2 s tween, raster time over the transition, 3 runs):
// force3D false 5150-5210 ms, "auto" 4930-5160 ms, true 4910-5100 ms; the
// same with `will-change: transform` on the moving layer: 4 ms. The engine
// seeks a paused timeline, so GSAP's "3D while playing" never promotes a
// layer; will-change does. Main-thread frame times were the same in all four
// (16.7 ms median, also at 4x CPU throttle). So: false, which keeps played and
// jumped DOM identical, and a heavy moving layer gets `will-change: transform`
// in its section's CSS (on that layer only: each one holds GPU memory).
gsap.config({ force3D: false });

export function timelineScene(build: () => gsap.core.Timeline): Scene {
  let tl: gsap.core.Timeline | undefined;
  const timeline = () => {
    if (!tl) {
      // Built on first render (the section is laid out by then), paused, and
      // run to the end and back so every tween records its start values now.
      tl = build().pause();
      tl.progress(1).progress(0);
    }
    return tl;
  };
  const at = (beat: number) => {
    if (beat < 0) return 0;
    const t = timeline().labels[`b${beat}`];
    if (t === undefined) throw new Error(`timeline has no label "b${beat}"`);
    return t;
  };
  return {
    // suppressEvents=false: onUpdate callbacks (count-ups) land their values
    render: (beat, p) => void timeline().seek(at(beat - 1) + p * (at(beat) - at(beat - 1)), false),
    duration: (beat) => at(beat) - at(beat - 1),
  };
}
