// Video beats: the poster shows before the clip runs, forward play runs on
// the clip's own clock, other arrivals rest on the settled frame, the next
// beat's media preloads, and an advance mid-clip fades it out and moves on.
// The clip is found by its source (its beat's `assets`), wherever it sits in
// the manifest; waits poll, and scale with the clip's duration, so a loaded
// machine is slower but not wrong.
import { test, expect, type Page } from "@playwright/test";
import { open, settled, index, jump } from "./helpers/deck";
import { beats as manifest } from "./helpers/manifest";

const clip = manifest.findIndex((b) => b.assets?.some((a) => /\.(mp4|webm)$/.test(a)));
const src = clip < 0 ? "" : manifest[clip].assets!.find((a) => /\.(mp4|webm)$/.test(a))!;
const MID_CLIP = 1.2; // seconds: a clip shorter than this has no "mid-clip" to catch reliably

const video = (page: Page) =>
  page.evaluate((src) => {
    const v = document.querySelector(`video[src$="${src}"]`) as HTMLVideoElement;
    return { paused: v.paused, t: v.currentTime, d: v.duration, preload: v.preload, muted: v.muted };
  }, src);
const playing = async (page: Page) => {
  const v = await video(page);
  return !v.paused && v.t > 0;
};
/** Plays the clip's beat forward from the beat before, and waits until it has run `share` of its length. */
async function playInto(page: Page, share: number) {
  await jump(page, clip - 1);
  await page.keyboard.press("PageDown");
  const d = (await video(page)).d;
  await expect.poll(async () => (await video(page)).t, { timeout: 10_000 }).toBeGreaterThan(share * d);
  return d;
}

test.beforeEach(() => {
  test.skip(clip < 0, "no beat has a clip in its assets");
  test.skip(clip < 1, "the clip is on the first beat: nothing plays into it");
});

test("before its beat the clip rests at its start (poster), and preloads a beat ahead", async ({ page }) => {
  await open(page);
  if (clip >= 2) {
    await jump(page, clip - 2);
    expect((await video(page)).preload).toBe("metadata");
  }
  await jump(page, clip - 1);
  const v = await video(page);
  expect(v.paused && v.t).toBe(0);
  expect(v.preload).toBe("auto");
});

test("played forward it runs on its own clock; any other arrival rests on its last frame", async ({ page }) => {
  await open(page);
  await jump(page, clip - 1);
  test.skip((await video(page)).d < MID_CLIP, `the clip is shorter than ${MID_CLIP} s`);
  await playInto(page, 0.2);
  expect((await video(page)).paused).toBe(false);
  await settled(page);
  const end = await video(page);
  expect(end.paused).toBe(true);
  expect(end.t).toBeCloseTo(end.d, 1);
  if (clip + 1 < manifest.length) {
    await jump(page, clip + 1);
    await page.keyboard.press("PageUp"); // back: no replay
    await settled(page);
    const back = await video(page);
    expect(back.paused).toBe(true);
    expect(back.t).toBeCloseTo(back.d, 1);
  }
});

test("an advance mid-clip fades picture and sound out over ~300 ms, never pops back, and moves on in one press", async ({ page }) => {
  test.skip(clip + 1 >= manifest.length, "no beat after the clip");
  await open(page);
  await jump(page, clip - 1);
  test.skip((await video(page)).d < MID_CLIP, `the clip is shorter than ${MID_CLIP} s`);
  const d = await playInto(page, 0.25);
  // samples on every frame, stamped against the press (in-page clocks: the machine's load doesn't skew them)
  const samples = page.evaluate(
    (src) =>
      new Promise<{ t: number; o: number; v: number; at: number }[]>((resolve) => {
        const v = document.querySelector(`video[src$="${src}"]`) as HTMLVideoElement;
        const out: { t: number; o: number; v: number; at: number }[] = [];
        let pressed = 0;
        addEventListener("keydown", () => (pressed = performance.now()), { capture: true, once: true });
        const tick = () => {
          if (pressed) out.push({ t: performance.now() - pressed, o: parseFloat(getComputedStyle(v).opacity), v: v.volume, at: v.currentTime });
          !pressed || performance.now() - pressed < 1500 ? requestAnimationFrame(tick) : resolve(out);
        };
        requestAnimationFrame(tick);
      }),
    src,
  );
  await page.keyboard.press("PageDown");
  const s = await samples;
  await settled(page);
  expect(await index(page)).toBe(clip + 1);
  // the fade: from the press until the picture is nearly gone (a linear 300 ms fade passes 0.2 at 240 ms)
  const gone = s.findIndex((x) => x.o <= 0.2);
  expect(gone, "the picture fades out").toBeGreaterThan(0);
  const fade = s.slice(0, gone + 1);
  expect(fade.some((x) => x.o > 0.2 && x.o < 0.95), "a fade, not a cut").toBe(true);
  expect(fade.every((x, k) => !k || x.o <= fade[k - 1].o + 0.01), "opacity only falls").toBe(true);
  expect(s[gone].t, "about 300 ms").toBeGreaterThan(150);
  expect(s[gone].t, "about 300 ms").toBeLessThan(800);
  expect(s.some((x) => x.v > 0.05 && x.v < 0.95), "sound ramps too").toBe(true);
  // no pop: once the fade starts, no mid-clip frame shows at full opacity; the last frame fades in
  const dipped = s.findIndex((x) => x.o < 0.95);
  expect(s.slice(dipped).filter((x) => x.o >= 0.95 && x.at < d - 0.1), "a mid-clip frame at full opacity after the fade began").toEqual([]);
  const last = s.findIndex((x, k) => k > dipped && x.at >= d - 0.1);
  expect(s.slice(last).some((x) => x.o > 0.05 && x.o < 0.95), "the last frame fades in").toBe(true);
  expect((await video(page)).paused).toBe(true);
});

test("the speaker view's previews never make sound", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const f = document.createElement("iframe");
    f.src = location.href;
    document.body.append(f);
  });
  const frame = page.frames()[1];
  await frame.waitForFunction(() => (window as any).__deck);
  expect(await frame.evaluate(() => [...document.querySelectorAll("video")].every((v) => v.muted))).toBe(true);
});

test("seek(clip, p) lands on that point of the clip, from any state", async ({ page }) => {
  await open(page);
  // from < 0: arrive from the beat before (the engine renders the rest frame, then p)
  for (const [p, from] of [[0.5, 1], [0.25, 0], [0.75, 0.5], [0, 1], [1, 0], [0.5, -1], [0, -1]]) {
    await page.evaluate(([i, q]) => ((window as any).__deck.seek(q < 0 ? i - 1 : i, q < 0 ? 1 : q), (window as any).__deck.settled()), [clip, from]);
    const done = page.evaluate(([i, q]) => ((window as any).__deck.seek(i, q), (window as any).__deck.settled()), [clip, p]);
    await expect(done, `seek to ${p} from ${from} settles`).resolves.toBeUndefined();
    const v = await video(page);
    expect(v.t, `seek to ${p} from ${from}`).toBeCloseTo(p * v.d, 1);
  }
});

/** What Chrome does to an unmuted play() in a window with no user activation (a reload, keys over the channel). */
const blockSound = () => {
  const play = HTMLMediaElement.prototype.play;
  (window as any).__blockSound = true;
  HTMLMediaElement.prototype.play = function () {
    if ((window as any).__blockSound && !this.muted) return Promise.reject(new DOMException("play() needs a gesture", "NotAllowedError"));
    return play.call(this);
  };
};

test("sound blocked by the autoplay policy: the clip plays muted, and the next play tries sound again", async ({ page, context }) => {
  await context.addInitScript(blockSound);
  await open(page);
  await jump(page, clip - 1);
  await page.keyboard.press("PageDown");
  // it still plays: picture without sound beats a frozen frame
  await expect.poll(() => playing(page)).toBe(true);
  expect((await video(page)).muted).toBe(true);
  await settled(page);
  // the speaker clicks the audience window: the next play has sound
  await page.evaluate(() => ((window as any).__blockSound = false));
  await jump(page, clip - 1);
  await page.keyboard.press("PageDown");
  await expect.poll(() => playing(page)).toBe(true);
  expect((await video(page)).muted).toBe(false);
});

test("sound blocked by the autoplay policy: the next press or key in the audience window gives the running clip its sound", async ({ page, context }) => {
  await context.addInitScript(blockSound);
  await open(page);
  await jump(page, clip - 1);
  await page.keyboard.press("PageDown"); // as if from the speaker view: no activation, so muted
  await expect.poll(() => playing(page)).toBe(true);
  const v = await video(page);
  expect(v.muted).toBe(true);
  test.skip(v.d - v.t < MID_CLIP, "the clip is too short to catch mid-play");
  await page.evaluate(() => ((window as any).__blockSound = false)); // what the key's activation allows
  await page.keyboard.press("x"); // a key the deck leaves alone
  const after = await video(page);
  expect(after.muted, "sound back").toBe(false);
  expect(after.paused, "still playing").toBe(false);
  expect(await index(page)).toBe(clip);
});

test("back before the clip shows its poster without reloading it, and a quick forward still plays it", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__loads = 0;
    const load = HTMLMediaElement.prototype.load;
    HTMLMediaElement.prototype.load = function () {
      (window as any).__loads++;
      return load.call(this);
    };
  });
  await open(page);
  await jump(page, clip + 1 < manifest.length ? clip + 1 : clip); // the clip has shown frames
  // a slow network: anything the clip asks for from now on takes 2 s
  await page.route(`**/${src}`, async (r) => (await new Promise((f) => setTimeout(f, 2000)), r.continue()));
  await page.evaluate(() => ((window as any).__loads = 0));
  await jump(page, clip - 1);
  expect(await page.evaluate(() => (window as any).__loads), "load() calls").toBe(0);
  const poster = await page.evaluate((src) => {
    const v = document.querySelector(`video[src$="${src}"]`) as HTMLVideoElement;
    const img = v.nextElementSibling as HTMLImageElement | null;
    return img?.classList.contains("rt-poster") && !img.hidden ? new URL(img.src).pathname.endsWith(v.getAttribute("poster") ?? "\0") : false;
  }, src);
  expect(poster, "the poster covers the clip").toBe(true);
  await page.keyboard.press("PageDown");
  await expect.poll(() => playing(page), { timeout: 1500 }).toBe(true);
});

test("seek(clip, p) goes straight to p, never through the settled frame first", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__times = [];
    const d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime")!;
    Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
      ...d,
      set(t: number) {
        (window as any).__times.push(t);
        d.set!.call(this, t);
      },
    });
  });
  await open(page);
  await jump(page, clip - 1);
  const d = (await video(page)).d;
  await page.evaluate(() => ((window as any).__times = []));
  await page.evaluate((i) => ((window as any).__deck.seek(i, 0.1), (window as any).__deck.settled()), clip);
  const times: number[] = await page.evaluate(() => (window as any).__times);
  expect(times.filter((t) => t > 0.5 * d), "seeks past the middle on the way to 10%").toEqual([]);
});
