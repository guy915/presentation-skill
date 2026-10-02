// Deck <-> speaker view, over BroadcastChannel (same origin, no opener needed).
// The channel is named for the talk's directory, so two talks on one origin
// (GitHub Pages, one localhost port) stay apart, and every message carries the
// deck's session id, so a stale tab of the same talk stays out too.
export type Message =
  // deck -> speaker view: the beat, and when the talk's clock started (epoch ms; 0 = not yet).
  // The deck owns the clock (sessionStorage), so a speaker view opened or reloaded mid-talk shows the real time.
  // `settled`: false while a played transition (a clip included) runs on this beat; the deck
  // sends the message again when it comes to rest. Absent counts as true.
  | { kind: "beat"; index: number; started: number; settled?: boolean }
  | { kind: "hello" } // speaker view -> deck: say where you are
  | { kind: "key"; key: string }; // speaker view -> deck: a next or back key pressed there

/** False in the speaker view's preview iframes: they render, but never
 *  announce, listen, take input or make sound. */
export const isTop = window.self === window.top;

const talkDir = location.pathname.replace(/[^/]*$/, "");
const chan = new BroadcastChannel(`talk:${talkDir}`);


/** The speaker view gets its deck's session in its URL (?s=); a deck keeps
 *  its own per tab (sessionStorage), so a reload still reaches its speaker view. */
export const session = new URLSearchParams(location.search).get("s") ?? ownSession();
function ownSession() {
  const fresh = Math.random().toString(36).slice(2);
  try {
    const s = sessionStorage.getItem("talk-session") ?? fresh;
    sessionStorage.setItem("talk-session", s);
    return s;
  } catch {
    return fresh; // storage blocked: the session lasts until reload
  }
}

/** The localStorage key of the rehearsal log (Rehearsal in manifest.ts), per
 *  talk and deck tab: the deck writes it while its clock runs, its speaker view
 *  reads it to save it, and another tab of the talk keeps its own. */
export const REHEARSAL = `talk-rehearsal:${talkDir}:${session}`;

export const send = (msg: Message) => chan.postMessage({ ...msg, s: session });
export const listen = (fn: (msg: Message) => void) =>
  chan.addEventListener("message", (e) => e.data?.s === session && fn(e.data));
