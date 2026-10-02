// A canvas's backing store, sized to the pixels it covers on screen: its CSS
// box (stage px) × devicePixelRatio × the stage's scale. The stage is scaled
// with a CSS transform, so a canvas sized in stage px alone is upscaled, and
// soft, on a 4K output or a HiDPI laptop. The engine sizes every canvas
// registered here again whenever the stage refits (the window moved to the
// projector, or went fullscreen), then renders the current beat again: a
// resize clears a canvas.
//
//   const canvas = root.querySelector("canvas")!;   // its size set in CSS
//   sizeCanvas(canvas);                             // in mount
//   const draw = () => {
//     const k = canvasScale(canvas);
//     g.setTransform(k, 0, 0, k, 0, 0);             // then draw in stage px
//     ...
//   };
// WebGL: gl.viewport(0, 0, canvas.width, canvas.height) on each draw.
const MAX_RATIO = 2; // backing px per stage px: a 4K output of a 1080-line stage
const MAX_SIDE = 4096; // per side: the texture size every GPU takes

const sized = new Set<HTMLCanvasElement>();
let stageScale = 1;

/** Sizes the canvas's backing store for the screen it is on; again on every refit. Returns backing px per stage px. */
export function sizeCanvas(canvas: HTMLCanvasElement): number {
  sized.add(canvas);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return canvasScale(canvas); // not laid out (display: none): keep what it has
  const k = Math.min(MAX_RATIO, devicePixelRatio * stageScale, MAX_SIDE / w, MAX_SIDE / h);
  const [bw, bh] = [Math.round(w * k), Math.round(h * k)];
  if (canvas.width !== bw) canvas.width = bw;
  if (canvas.height !== bh) canvas.height = bh;
  return k;
}

/** Backing px per stage px: the scale to draw at (ctx.setTransform(k, 0, 0, k, 0, 0)). */
export const canvasScale = (canvas: HTMLCanvasElement) => canvas.width / (canvas.clientWidth || canvas.width);

/** The engine, when the stage refits: whether any backing store changed (and so was cleared). */
export function refitCanvases(scale: number): boolean {
  stageScale = scale;
  let changed = false;
  for (const c of sized) {
    if (!c.isConnected) sized.delete(c);
    else {
      const was = [c.width, c.height];
      sizeCanvas(c);
      changed ||= c.width !== was[0] || c.height !== was[1];
    }
  }
  return changed;
}
