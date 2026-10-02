// Intentional exceptions to the visual guards: the ONLY file in test/ a talk
// may edit, and every entry needs its reason. Keys are CSS selectors; an
// element is exempt when it or an ancestor matches.
export const BLEED: Record<string, string> = {
  ".rt-fallback": "a fallback still fills the stage by design",
};
export const SMALL_TEXT: Record<string, string> = {};
export const LOW_CONTRAST: Record<string, string> = {};
// Text the word, line-length and type-size ceilings would misjudge (code and
// typeset maths, pre, code and .katex, are exempt already), text that is
// itself the subject (a quotation, a poem, a specimen, a table the room reads,
// labels whose size is the data), and labels on a map or diagram that the eye
// visits one at a time or that a camera move scales. Exempt from those ceilings;
// the floor and contrast still hold.
export const DENSE_TEXT: Record<string, string> = {};
// Phrases in the spoken notes that only look like build history (a "round 2"
// in a boxing talk, an airport's "gate 12", a product called "v8"). Exact
// text, case-sensitive; exempt from the notes test's history check.
export const NOTES_ALLOW: Record<string, string> = {};
