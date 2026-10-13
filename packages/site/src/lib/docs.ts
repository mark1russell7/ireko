/**
 * The shared parts of the figures of the guide. Each figure starts from a text of the text language, so the guide
 * shows the same source that the reader can type in the playground.
 */
import { createEngine, type Engine, type Layout, type LayoutOptions } from "ireko";
import { parse } from "ireko/text";
import { href } from "./site.ts";

/** The options of the figures: smaller boxes than the defaults of the library, so a figure fits the column. */
export const DOC_OPTIONS: LayoutOptions = { spacing: 12, nodeSize: { width: 64, height: 28 }, header: 20 };

const engine = createEngine();

/**
 * This function gives the layout of a text. A text with a syntax error stops the build, so a figure of the guide
 * cannot show a stale or broken example.
 */
export function layoutOfText(source: string, options: LayoutOptions = DOC_OPTIONS, use: Engine = engine): Layout {
  const parsed = parse(source, { strategies: [...use.strategies.keys()] });
  if (!parsed.ok) {
    const e = parsed.error;
    throw new Error(`ireko figure: line ${String(e.line)}, column ${String(e.column)}: ${e.message}\n${source}`);
  }
  return use.layout(parsed.input, options);
}

/** This function gives the address of the playground with the text in the hash. */
export function playgroundHref(source: string): string {
  return `${href("playground/")}#${encodeURIComponent(source.trim())}`;
}
