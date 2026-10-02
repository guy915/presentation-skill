// The contract a section implements. `beat` is local to the section (0-based).
//
// render(beat, progress, live) must make the section's visual state a pure
// function of (beat, progress): progress 0..1 is how far the transition INTO
// `beat` has run, 1 = settled. The engine calls it every frame while playing
// forward, and with progress 1 for back, jumps, cold loads and reloads.
// `live` is true only while a transition plays in real time: media may then
// run on its own clock. Nothing else may read it.
export interface Scene {
  render(beat: number, progress: number, live: boolean): void | Promise<unknown>;
  /** Seconds the transition into `beat` takes (0 or absent = a cut). */
  duration?(beat: number): number;
  /** Resolves once async assets are in; must never reject. */
  ready?: Promise<unknown>;
}

export interface Section {
  /** Inner markup of the section's <section> (stage coordinates: 1080 lines, as wide as talk.aspect makes it, 1920 at 16:9). Classes, not ids. */
  html: string;
  /** Called once, after the markup is in the DOM. */
  mount(root: HTMLElement): Scene;
}

/** Runs several scenes as one transition, as long as the longest. Scenes
 *  that declare a duration keep their own speed (and rest once done); scenes
 *  without one (a canvas draw) stretch over the whole transition. */
export function combine(...scenes: Scene[]): Scene {
  const duration = (b: number) => Math.max(0, ...scenes.map((s) => s.duration?.(b) ?? 0));
  return {
    duration,
    render: (b, p, live) =>
      Promise.all(
        scenes.map((s) => {
          if (!s.duration) return s.render(b, p, live);
          const d = s.duration(b);
          return s.render(b, d > 0 ? Math.min(1, (p * duration(b)) / d) : 1, live);
        }),
      ),
    ready: Promise.all(scenes.map((s) => s.ready)),
  };
}
