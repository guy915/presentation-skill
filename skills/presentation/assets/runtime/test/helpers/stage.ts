// In-page probes of what the room sees on the present beat, in stage
// coordinates (the stage's own size: talk.aspect, 1920x1080 at 16:9).
import type { Page } from "@playwright/test";

/** The action-safe inset, as a share of the stage's width and height. */
export const SAFE_SHARE = 0.05;

/** Notation is content, not a glance: code and typeset maths are exempt from
 *  the word, line-length and type-size ceilings by default (the floor and
 *  contrast still hold), as DENSE_TEXT entries are. */
export const NOTATION: Record<string, string> = {
  pre: "a code block",
  code: "inline code",
  ".katex": "typeset maths (KaTeX)",
};
/** Drawn smaller than the text around them by design: KaTeX's sub- and
 *  superscripts are exempt from the type floor; the main size of maths is not. */
const SCRIPTS: Record<string, string> = { ".katex .msupsub": "sub- and superscripts" };

export interface Found { el: string; text: string; value: number[]; why?: string }

/** Puts a probe on the present beat, in place of any earlier one: a div.probe
 *  holding `html`, styled by `css` (stage px). For tests of the checks themselves. */
export const inject = (page: Page, html: string, css = "position:absolute;left:200px;top:200px") =>
  page.evaluate(
    ([html, css]) => {
      document.querySelector(".probe")?.remove();
      const box = document.createElement("div");
      box.className = "probe";
      box.style.cssText = css;
      box.innerHTML = html;
      document.querySelector("#stage > .slides > section.present")!.append(box);
    },
    [html, css] as const,
  );

/** Runs `probe` in the page with shared helpers: visible elements and text of the present section. */
function inPage<A, R>(page: Page, arg: A, probe: string): Promise<R> {
  return page.evaluate(
    ([arg, probe]) => {
      const stage = document.getElementById("stage")!;
      const sr = stage.getBoundingClientRect();
      const W = stage.offsetWidth; // unscaled: stage px
      const H = stage.offsetHeight;
      const k = sr.width / W;
      const root = document.querySelector("#stage > .slides > section.present")!;
      const opacity = (el: Element) => {
        let o = 1;
        for (let n: Element | null = el; n && n !== stage; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity);
        return o;
      };
      const visible = (el: Element) =>
        el.checkVisibility({ visibilityProperty: true }) && opacity(el) > 0.05 && el.getBoundingClientRect().width > 0 && !el.closest(".katex-mathml"); // KaTeX's MathML for screen readers, clipped to nothing
      const box = (r: DOMRect) => [(r.left - sr.left) / k, (r.top - sr.top) / k, (r.right - sr.left) / k, (r.bottom - sr.top) / k];
      const name = (el: Element) => el.tagName.toLowerCase() + [...el.classList].map((c) => "." + c).join("");
      // a clip's poster (img.rt-poster, right after it) is exempt when its clip is: it covers the clip
      const exempt = (list: Record<string, string>, el: Element) => {
        const who = el.classList.contains("rt-poster") ? (el.previousElementSibling ?? el) : el;
        return Object.keys(list).some((s) => who.closest(s));
      };
      /** elements with their own visible text */
      const texts = () =>
        [...root.querySelectorAll("*")].filter(
          (el) => [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent!.trim()) && visible(el),
        );
      /** scale the element's transforms and its ancestors' apply inside the stage */
      const scale = (el: Element) => {
        let s = 1;
        for (let n: Element | null = el; n && n !== stage; n = n.parentElement) {
          const t = getComputedStyle(n).transform;
          const m = t !== "none" && t.match(/matrix(?:3d)?\(([^)]+)\)/);
          if (m) { const p = m[1].split(",").map(Number); s *= Math.hypot(p[0], p[1]); }
        }
        return s;
      };
      const h = { stage, W, H, root, k, sr, opacity, visible, box, name, exempt, texts, scale };
      return new Function("h", "arg", `return (${probe})(h, arg)`)(h, arg);
    },
    [arg, probe] as const,
  ) as Promise<R>;
}

/** Visible elements whose box leaves the safe area (inset in stage px). A box
 *  with zero width or zero height paints nothing (KaTeX's struts), so it is
 *  skipped. A ground is skipped too: an element with no text of its own that
 *  covers the whole stage (a section ground, a gradient, a photo) or has the
 *  class `ground` (one that bleeds past the stage's edges only in part). */
export const overflows = (page: Page, inset: [number, number], bleed: Record<string, string>) =>
  inPage<unknown, Found[]>(page, { inset, bleed }, `(h, { inset: [x, y], bleed }) =>
    [...h.root.querySelectorAll("*")]
      .filter((el) => h.visible(el) && !h.exempt(bleed, el))
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
      .map((el) => ({ node: el, el: h.name(el), text: (el.textContent || "").trim().slice(0, 40), value: h.box(el.getBoundingClientRect()).map(Math.round) }))
      .filter(({ node, value: [l, t, r, b] }) => {
        const ownText = [...node.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
        const ground = !ownText && (node.classList.contains("ground") || (l <= 0 && t <= 0 && r >= h.W && b >= h.H));
        return !ground && (l < x - 0.5 || t < y - 0.5 || r > h.W - x + 0.5 || b > h.H - y + 0.5);
      })
      .map(({ node, ...found }) => found)`);

/** Visible text under `floor` px at stage scale (transforms inside the stage count). */
export const smallText = (page: Page, floor: number, allow: Record<string, string>) =>
  inPage<unknown, Found[]>(page, { floor, allow: { ...SCRIPTS, ...allow } }, `(h, { floor, allow }) =>
    h.texts()
      .filter((el) => !h.exempt(allow, el))
      .map((el) => ({ el: h.name(el), text: el.textContent.trim().slice(0, 40), value: [parseFloat(getComputedStyle(el).fontSize) * h.scale(el)] }))
      .filter((f) => f.value[0] < floor - 0.05)`);

export interface TypeStats { words: number; longest: { el: string; text: string; chars: number } | null; sizes: number[] }

/** What a glance has to take in on the present beat: words on the stage, the
 *  longest rendered line, and the distinct type sizes as the room sees them
 *  (transforms included; sizes within 5% count as one). Each word is measured
 *  where it renders, so text a camera move has pushed off the stage is not
 *  counted, and a heading with an inline span is counted once. */
export const typeStats = (page: Page, allow: Record<string, string>) =>
  inPage<unknown, TypeStats>(page, { allow: { ...NOTATION, ...allow } }, `(h, { allow }) => {
    const range = document.createRange();
    const blocks = new Map();
    const sized = new Set();
    let words = 0;
    const walk = document.createTreeWalker(h.root, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode()); ) {
      const el = n.parentElement;
      if (!n.textContent.trim() || !h.visible(el) || h.exempt(allow, el)) continue;
      let block = el;
      while (block !== h.root && getComputedStyle(block).display.startsWith("inline")) block = block.parentElement;
      for (const m of n.textContent.matchAll(/\\S+/g)) {
        range.setStart(n, m.index);
        range.setEnd(n, m.index + m[0].length);
        const r = range.getBoundingClientRect();
        const [l, t, rr, b] = h.box(r);
        if (!r.width || rr <= 0 || b <= 0 || l >= h.W || t >= h.H) continue;
        words++;
        sized.add(el);
        if (!blocks.has(block)) blocks.set(block, []);
        blocks.get(block).push({ w: m[0], top: r.top, bottom: r.bottom, mid: (r.top + r.bottom) / 2, left: r.left });
      }
    }
    const px = [...sized].map((el) => parseFloat(getComputedStyle(el).fontSize) * h.scale(el));
    // Words in DOM order; a new line starts when a word sits left of the last
    // one or outside its line's vertical extent.
    let longest = null;
    for (const [block, list] of blocks) {
      let line = [];
      const close = () => {
        const text = line.map((x) => x.w).join(" ");
        if (line.length && (!longest || text.length > longest.chars)) longest = { el: h.name(block), text: text.slice(0, 40), chars: text.length };
        line = [];
      };
      for (const x of list) {
        const last = line[line.length - 1];
        if (last && (x.left < last.left || x.mid < last.top || x.mid > last.bottom)) close();
        line.push(x);
      }
      close();
    }
    const sizes = [];
    for (const s of px.sort((a, b) => a - b)) if (!sizes.length || s > sizes[sizes.length - 1] * 1.05) sizes.push(Math.round(s));
    return { words, longest, sizes };
  }`);

/** Visible text: its colour, its line boxes (viewport px) and its opacity, for contrast sampling. */
export const textBoxes = (page: Page, allow: Record<string, string>) =>
  inPage<unknown, { el: string; text: string; color: number[]; rects: number[][] }[]>(page, { allow }, `(h, { allow }) =>
    h.texts().filter((el) => !h.exempt(allow, el)).map((el) => {
      const c = getComputedStyle(el).color.match(/[\\d.]+/g).map(Number);
      const range = document.createRange();
      const rects = [];
      for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !n.textContent.trim()) continue;
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) rects.push([r.left, r.top, r.width, r.height]);
      }
      return { el: h.name(el), text: el.textContent.trim().slice(0, 40), color: [c[0], c[1], c[2], (c[3] ?? 1) * h.opacity(el)], rects };
    })`);

/** All visible text on the present beat, joined. */
export const visibleText = (page: Page) =>
  inPage<unknown, string>(page, null, `(h) => h.texts().map((el) => el.textContent).join("\\n")`);

/** The grey placeholder box (src/runtime/placeholder.ts): what a section shows
 *  before it is built, and a built section's stand-in for an unfinished visual. */
export const PLACEHOLDER = ".rt-placeholder";

const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+|math|emoji|fangsong|-apple-system|blinkmacsystemfont)$/i;

/** Visible text that renders in something other than a bundled face (a
 *  @font-face of the talk's) that has loaded: a generic or installed family
 *  renders in whatever the venue machine has, with other line breaks. Checked
 *  per character, as the browser picks a face: the first family in the stack
 *  with a face whose unicode-range covers it. A character no bundled face
 *  covers (λ, ≈, ₂ outside a Latin subset) falls through to a system font.
 *  Inside notation (NOTATION: pre, code, .katex) only the stack's first
 *  family is checked, not each character. Placeholder boxes (PLACEHOLDER) are
 *  exempt: they come before the treatment picks the talk's face and may render
 *  in --font-text's generic fallback; every other text, a finished section's
 *  included, is checked. */
export const unbundledText = (page: Page) =>
  inPage<unknown, Found[]>(page, { generic: GENERIC.source, notation: Object.keys(NOTATION).join(","), placeholder: PLACEHOLDER }, `(h, { generic, notation, placeholder }) => {
    const unquote = (s) => s.trim().replace(/^["']|["']$/g, "");
    const isGeneric = (f) => new RegExp(generic, "i").test(f);
    // each bundled family's faces, with their unicode-range as [from, to] pairs
    const faces = new Map();
    for (const f of document.fonts) {
      const ranges = f.unicodeRange.split(",").map((r) => {
        const [a, b] = r.trim().replace(/^U\\+/i, "").split("-");
        return a.includes("?") ? [parseInt(a.replace(/\\?/g, "0"), 16), parseInt(a.replace(/\\?/g, "F"), 16)] : [parseInt(a, 16), parseInt(b ?? a, 16)];
      });
      const family = unquote(f.family);
      if (!faces.has(family)) faces.set(family, []);
      faces.get(family).push({ loaded: f.status === "loaded", ranges });
    }
    const stacks = new Map(); // font-family value -> its families, once per distinct stack
    /** Why this character renders outside the bundled faces, or "" if one covers it. */
    const why = (stack, cp) => {
      for (const family of stack) {
        if (isGeneric(family)) return family + " (generic)";
        const mine = faces.get(family);
        if (!mine) return family + " (not bundled)";
        const covering = cp === undefined ? mine : mine.filter((f) => f.ranges.some(([a, b]) => cp >= a && cp <= b));
        if (covering.length) return covering.some((f) => f.loaded) ? "" : family + " (not loaded)";
      }
      return "no bundled face covers it";
    };
    const found = new Map(); // element -> reason -> characters
    const walk = document.createTreeWalker(h.root, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode()); ) {
      const el = n.parentElement;
      if (!n.textContent.trim() || !h.visible(el) || el.closest(placeholder)) continue;
      const value = getComputedStyle(el).fontFamily;
      if (!stacks.has(value)) stacks.set(value, value.split(",").map(unquote));
      const stack = stacks.get(value);
      // notation: the stack's first family only (cp undefined); elsewhere every character
      const cps = el.closest(notation) ? [undefined] : [...new Set(n.textContent.replace(/\\s+/g, ""))].map((c) => c.codePointAt(0));
      for (const cp of cps) {
        const w = why(stack, cp);
        if (!w) continue;
        if (!found.has(el)) found.set(el, new Map());
        const chars = found.get(el);
        if (!chars.has(w)) chars.set(w, []);
        if (cp !== undefined) chars.get(w).push(String.fromCodePoint(cp) + " U+" + cp.toString(16).toUpperCase().padStart(4, "0"));
      }
    }
    return [...found].map(([el, reasons]) => ({
      el: h.name(el), text: el.textContent.trim().slice(0, 40), value: [],
      why: [...reasons].map(([w, chars]) => w + (chars.length ? ": " + chars.slice(0, 6).join(", ") + (chars.length > 6 ? ", …" : "") : "")).join("; "),
    }));
  }`);

/** @font-face sources that are not files shipped with the talk: local() is an
 *  installed font by another name, and a remote URL needs the network. */
export const remoteFaces = (page: Page) =>
  page.evaluate(() =>
    [...document.styleSheets]
      .flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } })
      .filter((r): r is CSSFontFaceRule => r instanceof CSSFontFaceRule)
      .map((r) => r.style.getPropertyValue("src"))
      .filter((src) => /local\(/.test(src) || [...src.matchAll(/url\(["']?([^"')]+)/g)].some(([, u]) => new URL(u, location.href).origin !== location.origin && !u.startsWith("data:"))),
  );
