// The engine's own rules, apart from any talk: the stage's size from talk.aspect.
import { test, expect } from "@playwright/test";
import { stageSize } from "../../src/runtime/manifest.ts";

test("stageSize: 1080 lines, the width from talk.aspect (16:9 by default)", () => {
  expect(stageSize({})).toEqual({ width: 1920, height: 1080 });
  expect(stageSize({ aspect: "16:9" })).toEqual({ width: 1920, height: 1080 });
  expect(stageSize({ aspect: "4:3" })).toEqual({ width: 1440, height: 1080 });
  expect(stageSize({ aspect: "16:10" })).toEqual({ width: 1728, height: 1080 });
  expect(stageSize({ aspect: "21:9" })).toEqual({ width: 2520, height: 1080 });
  expect(() => stageSize({ aspect: "wide" })).toThrow(/aspect/);
});
