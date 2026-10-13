/**
 * Boxes that fit their labels. `fitText` gives a `measure` function for the layout options: each box is as wide as its
 * label, plus the padding. The default width of a text is an estimate from the widths of the characters of a common
 * sans-serif font. Thus the same input gives the same layout on a server and in a browser.
 * A page can give the exact width from a canvas: `widthOfCanvas` from `ireko/render`.
 */
import type { Size } from "./geometry.ts";
import type { NodeSpec } from "./model.ts";

/** The options of `fitText`. */
export interface FitTextOptions {
  /** The size of the font, in pixels. The default is 13, the size of the themes. */
  readonly fontSize?: number;
  /** The space between the label and the edge of the box, on each side. The default is 12 by 8. */
  readonly padding?: { readonly x: number; readonly y: number };
  /** The smallest width of a box. The default is 0. */
  readonly minWidth?: number;
  /** The smallest height of a box. The default is the height of one line of text and the padding. */
  readonly minHeight?: number;
  /** This function gives the width of a text, in pixels. The default is `estimateWidth`. */
  readonly widthOf?: (text: string, fontSize: number) => number;
}

/** The height of one line of text, as a factor of the size of the font. */
const LINE = 1.3;

/** This function gives a `measure` function: the size of each box is the size of its label, plus the padding. */
export function fitText(options: FitTextOptions = {}): (node: NodeSpec) => Size {
  const fontSize = options.fontSize ?? 13;
  const padding = options.padding ?? { x: 12, y: 8 };
  const widthOf = options.widthOf ?? estimateWidth;
  const height = Math.max(options.minHeight ?? 0, fontSize * LINE + 2 * padding.y);
  return (node) => ({
    width: Math.max(options.minWidth ?? 0, Math.ceil(widthOf(node.label ?? node.id, fontSize) + 2 * padding.x)),
    height: Math.ceil(height),
  });
}

/**
 * This function gives an estimate of the width of a text in a common sans-serif font, in pixels. It adds the width of
 * each character, as a part of the size of the font. The estimate is near the real width for Latin text.
 */
export function estimateWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const ch of text) em += widthOfCharacter(ch);
  return em * fontSize;
}

/** The narrow and the wide characters of a common sans-serif font. */
const NARROW = new Set("ijl.,:;|!'`".split(""));
const SEMI = new Set("ftrI()[]{}-/\\\"".split(""));
const WIDE = new Set("mwMW@%".split(""));

/** This function gives the width of one character, as a part of the size of the font. */
function widthOfCharacter(ch: string): number {
  if (ch === " ") return 0.28;
  if (NARROW.has(ch)) return 0.27;
  if (SEMI.has(ch)) return 0.36;
  if (WIDE.has(ch)) return 0.86;
  if (ch >= "A" && ch <= "Z") return 0.66;
  if (ch >= "0" && ch <= "9") return 0.56;
  if (ch >= "a" && ch <= "z") return 0.52;
  // A character of a wide script (CJK, kana, hangul) is approximately one em wide.
  return (ch.codePointAt(0) ?? 0) >= 0x2e80 ? 1 : 0.6;
}
