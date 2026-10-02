// The fixture section: one of each scene kind the engine runs, on neutral
// shapes, for the runtime's own suite (test/fixtures/engine.ts). Not a talk:
// it exists so the tests have a timeline, a canvas with a fallback, a clip with
// its poster and a placeholder to drive.
// Beats: 0 heading fades in, 1 canvas bars grow (a played transition of 1.3 s),
// 2 clip, 3 placeholder.
import { gsap } from "gsap";
import type { Section } from "../../../src/runtime/section.ts";
import { combine } from "../../../src/runtime/section.ts";
import { timelineScene } from "../../../src/runtime/gsap.ts";
import { videoScene } from "../../../src/runtime/video.ts";
import { placeholder } from "../../../src/runtime/placeholder.ts";
import { reducedMotion } from "../../../src/runtime/motion.ts";
import { sizeCanvas, canvasScale } from "../../../src/runtime/canvas.ts";

const css = `
  .fx-title { position: absolute; left: 160px; top: 120px; margin: 0; font-size: 72px; }
  .fx-canvas { position: absolute; left: 160px; top: 300px; width: 760px; height: 420px; }
  .fx-clip { position: absolute; left: 1000px; top: 300px; width: 760px; height: 428px; background: #000; }
  .fx-ph { position: absolute; left: 160px; top: 780px; width: 1600px; height: 200px; }
`;

export const fixture: Section = {
  html: `<style>${css}</style>
    <h1 class="fx-title">Fixture section</h1>
    <canvas class="fx-canvas"></canvas>
    <video class="fx-clip" src="fixture/clip.webm" poster="fixture/clip-poster.jpg"></video>
    <div class="fx-ph">${placeholder("Fixture placeholder")}</div>`,

  mount(root) {
    const $ = (s: string) => root.querySelector(s) as HTMLElement;
    const canvas = $(".fx-canvas") as HTMLCanvasElement;
    const g = canvas.getContext("2d")!;
    sizeCanvas(canvas);
    const [W, H] = [760, 420]; // its CSS size: drawing is in stage px

    // drawn purely from (beat, progress)
    const bars = [0, 3, 3, 3]; // bars shown at rest on each beat
    const draw = (beat: number, p: number) => {
      const s = canvasScale(canvas);
      g.setTransform(s, 0, 0, s, 0, 0);
      g.clearRect(0, 0, W, H);
      const from = bars[beat - 1] ?? 0;
      const to = bars[beat];
      for (let k = 0; k < to; k++) {
        const grow = k < from ? 1 : p; // new bars grow in with progress
        const h = grow * (120 + k * 50);
        g.fillStyle = "#666";
        g.fillRect(20 + k * 140, H - h, 100, h);
      }
    };

    const scene = timelineScene(() =>
      gsap
        .timeline()
        // reduced motion: a fade without the rise
        .from($(".fx-title"), { opacity: 0, y: reducedMotion ? 0 : 40, duration: 0.6, ease: "power2.out" })
        .set([canvas, $(".fx-clip"), $(".fx-ph")], { autoAlpha: 0 }, 0)
        .addLabel("b0")
        .to(canvas, { autoAlpha: 1, duration: 0.3 })
        .to({}, { duration: 1 }) // the bars grow (drawn below); 1.3 s in all
        .addLabel("b1")
        .to($(".fx-clip"), { autoAlpha: 1, duration: 0.3 })
        .addLabel("b2")
        .to($(".fx-ph"), { autoAlpha: 1, duration: 0.5 })
        .addLabel("b3"),
    );

    return combine(
      scene,
      { render: (b, p) => draw(b, p) },
      videoScene($(".fx-clip") as HTMLVideoElement, 2),
    );
  },
};
