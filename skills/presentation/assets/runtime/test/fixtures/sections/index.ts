// The fixture talk's sections (TALK_SECTIONS=test/fixtures/sections/index.ts,
// in place of src/sections/index.ts), and its text face: ../theme.css plays
// the part of a talk's src/theme.css, loaded after it.
import "../theme.css";
import type { Section } from "../../../src/runtime/section.ts";
import { fixture } from "./fixture.ts";

export const sections: Record<string, Section> = { fixture };
