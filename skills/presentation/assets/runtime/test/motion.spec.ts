// Played motion: every transition is played in real time, as in the room,
// while a rAF recorder logs frame deltas; the bar is verdict() in
// helpers/motion.ts, judged against the display's own frame interval.
// TALK_CPU_THROTTLE=4 runs it as a laptop 4x slower than this machine: a
// stress check, where only a stall fails.
import { test, expect, type Page } from "@playwright/test";
import { open, settled, beats, jump } from "./helpers/deck";
import { verdict, LONG } from "./helpers/motion";

/** The display's frame interval, ms: a low percentile of idle frame deltas
 *  (a busy frame only makes a delta longer). */
const frameInterval = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      new Promise<number>((done) => {
        const d: number[] = [];
        let last = 0;
        const step = (now: number) => {
          if (last) d.push(now - last);
          last = now;
          if (d.length < 20) requestAnimationFrame(step);
          else done(d.sort((a, b) => a - b)[5]);
        };
        requestAnimationFrame(step);
      }),
  );

/** Plays beat i from the beat before; returns its frame deltas, ms. */
async function play(page: Page, i: number) {
  await jump(page, i - 1);
  await page.evaluate(() => {
    const w = window as any;
    w.__frames = [];
    let last = performance.now();
    const tick = (now: number) => {
      w.__frames.push(now - last);
      last = now;
      if (w.__frames) w.__raf = requestAnimationFrame(tick);
    };
    w.__raf = requestAnimationFrame(tick);
  });
  await page.keyboard.press("PageDown");
  await settled(page);
  return page.evaluate(() => {
    const w = window as any;
    cancelAnimationFrame(w.__raf);
    const f = w.__frames.slice(1) as number[]; // the first delta spans the key press itself
    w.__frames = null;
    return f;
  });
}

test("every transition plays without stalls or runs of long frames", async ({ page }) => {
  test.setTimeout(300_000);
  const throttle = Number(process.env.TALK_CPU_THROTTLE ?? 1);
  if (throttle > 1) await (await page.context().newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: throttle });
  await open(page);
  const list = await beats(page);
  const frame = await frameInterval(page);
  const report: string[] = [];
  const failed: string[] = [];
  for (let i = 1; i < list.length; i++) {
    const d = await play(page, i);
    if (d.length < 3) continue; // a cut: nothing plays
    const long = d.filter((x) => x > LONG * frame).length / d.length;
    const line = `beat ${i}: ${d.length} frames, max ${Math.max(...d).toFixed(1)} ms, long ${(long * 100).toFixed(1)}%, median ${[...d].sort((a, b) => a - b)[d.length >> 1].toFixed(1)} ms`;
    report.push(line);
    const why = verdict(d, { throttled: throttle > 1, frame });
    if (why) failed.push(`${line}: ${why}`);
  }
  console.log(`display: ${frame.toFixed(1)} ms a frame (${Math.round(1000 / frame)} Hz)\n${report.join("\n")}`);
  // a talk with played transitions measured none: something turned them into cuts
  if (list.some((b, i) => i > 0 && b.transition > 0)) expect(report.length, "transitions measured").toBeGreaterThan(0);
  expect(failed).toEqual([]);
});
