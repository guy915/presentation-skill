// Reduced motion: the OS setting (prefers-reduced-motion), or ?motion=reduced
// or ?motion=full on the deck's URL to rehearse either way. Chrome maps
// Windows' "Show animations" off to it, which managed lecture-hall PCs often
// set. It never turns the talk into cuts and never stops a clip: transitions
// carry the talk's meaning, and clips are content. A section reads it when it
// builds, to pick a gentler variant of motion that moves the room's eye a long
// way (a fade instead of a rise or a zoom, no parallax, no shake), and CSS can
// match html[data-motion="reduced"].
const param = new URLSearchParams(location.search).get("motion");

export const reducedMotion =
  param === "reduced" || (param !== "full" && matchMedia("(prefers-reduced-motion: reduce)").matches);

document.documentElement.dataset.motion = reducedMotion ? "reduced" : "full";
