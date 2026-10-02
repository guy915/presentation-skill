// The played-motion bar (test/motion.spec.ts), apart from the spec so the
// runtime's own tests can check it on made-up frame runs.
const STALL_MS = 100; // any single frame this long is a visible hitch
export const LONG = 1.5; // a frame over 1.5 display intervals missed at least one vsync (25 ms at 60 Hz)
const LONG_SHARE = 0.1; // at most this share of a transition's frames may be long

/** Why a played transition's frame deltas `d` (ms) fail the bar, or null.
 *  A stall always fails; unthrottled, so do too many long frames. Throttled
 *  (a slower laptop), only a stall fails. `frame` is the display's frame
 *  interval (16.7 ms at 60 Hz). */
export function verdict(d: number[], o: { throttled: boolean; frame: number }): string | null {
  if (Math.max(...d) > Math.max(STALL_MS, 2 * o.frame)) return "stall";
  if (o.throttled) return null;
  return d.filter((x) => x > LONG * o.frame).length / d.length > LONG_SHARE ? "long frames" : null;
}
