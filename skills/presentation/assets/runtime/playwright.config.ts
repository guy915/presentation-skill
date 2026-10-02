import { defineConfig } from "@playwright/test";
import { ports } from "./scripts/lib/ports.ts";
import { stageSize } from "./src/runtime/manifest.ts";

// Two suites. `npm test` (or `npx playwright test`) runs the talk suite,
// test/*.spec.ts: the checks every talk passes, on this talk. `npm run
// test:runtime` runs the runtime's own tests, test/runtime/ (the tools, the
// checks themselves, the engine's rules, the speaker view), and the talk suite
// again, both on the fixture talk in test/fixtures/: a timeline, a canvas with
// a fallback, a clip and a placeholder, which an empty talk lacks. Its media
// is made with ffmpeg here, before the web server's build (which Playwright
// starts before any globalSetup), and kept while fresh.
const runtime = process.env.npm_lifecycle_event === "test:runtime";
if (runtime) {
  const { fixtureMedia, FIXTURE_MEDIA } = await import("./test/helpers/fixture-media.ts");
  fixtureMedia();
  Object.assign(process.env, {
    TALK_BEATS: "test/fixtures/engine.ts",
    TALK_SECTIONS: "test/fixtures/sections/index.ts",
    TALK_PUBLIC: FIXTURE_MEDIA,
  });
}
const { talk } = await import("./scripts/lib/talk.ts"); // after TALK_BEATS is set

// Tests run against the production build (what the room sees), on ports.test
// (TALK_PORT_BASE, default 4610).
const PORT = ports.test;

const talkSuite = [
  { name: "talk", testIgnore: [/test[\\/]runtime[\\/]/, /(^|[\\/])motion\.spec\.ts$/] },
  // Real-time frame timing: runs alone, after everything else, so other
  // workers don't steal the CPU it is measuring.
  { name: "motion", testMatch: /(^|[\\/])motion\.spec\.ts$/, dependencies: runtime ? ["talk", "runtime"] : ["talk"] },
];

export default defineConfig({
  testDir: "test",
  timeout: 120_000,
  projects: runtime ? [{ name: "runtime", testDir: "test/runtime" }, ...talkSuite] : talkSuite,
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: false,
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: stageSize(talk), // the room's screen, at the talk's aspect
    contextOptions: { reducedMotion: "no-preference" }, // pinned: the host's accessibility setting must not change what the tests see
  },
});
