/**
 * The exact width of a text in a browser, from a canvas. Give it to `fitText` from `ireko`, so each box fits its label
 * in the font of the page. Without a canvas (a server or a worker without OffscreenCanvas), it gives the estimate.
 */
import { estimateWidth } from "../core/text.ts";

/** The part of a 2D context that the measure uses. */
interface TextContext {
  font: string;
  measureText(text: string): { readonly width: number };
}

/** This function gives a 2D context for text, or undefined where no canvas exists. */
function contextOf(): TextContext | undefined {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(1, 1).getContext("2d") ?? undefined;
  if (typeof document !== "undefined") return document.createElement("canvas").getContext("2d") ?? undefined;
  return undefined;
}

/**
 * This function gives a function that gives the width of a text in the font family `fontFamily`.
 * It keeps one canvas, and it remembers the width of each text for each size.
 */
export function widthOfCanvas(fontFamily: string): (text: string, fontSize: number) => number {
  const ctx = contextOf();
  const known = new Map<string, number>();
  return (text, fontSize) => {
    if (ctx === undefined) return estimateWidth(text, fontSize);
    const key = `${String(fontSize)}\u0000${text}`;
    const found = known.get(key);
    if (found !== undefined) return found;
    ctx.font = `${String(fontSize)}px ${fontFamily}`;
    const width = ctx.measureText(text).width;
    known.set(key, width);
    return width;
  };
}
