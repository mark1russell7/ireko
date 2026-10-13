/**
 * The highlighter of the text language for the editors of the site. It gives the parts of a text with a class for each
 * part. It does not check the syntax: the parser of ireko does that.
 */
import { BUILTIN_STRATEGY_NAMES } from "ireko";
import { KEYWORDS } from "ireko/text";

/** A part of a highlighted text. */
export interface Part {
  readonly text: string;
  readonly kind: "id" | "strategy" | "keyword" | "string" | "number" | "comment" | "punct" | "space";
}

const SIZE = /^(\d+(?:\.\d+)?|_)x(\d+(?:\.\d+)?|_)$/;
const STARTS = new Set(["{", "}", ",", ";", "->"]);

/** This function splits a text into parts for the highlighter. */
export function highlight(text: string, strategies: ReadonlySet<string> = new Set(BUILTIN_STRATEGY_NAMES)): Part[] {
  const out: Part[] = [];
  const pattern = /(#[^\n]*|\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"?)|('(?:[^'\\\n]|\\.)*'?)|(->|[{}(),:;])|([A-Za-z0-9_.@$+-]+)|(\s+)|(.)/g;
  // A word is an identifier at the start of a statement: at the start of the text, after a line break, or after { } , ; ->
  let start = true;
  for (const m of text.matchAll(pattern)) {
    const [whole, comment, label, quoted, punct, word, space] = m;
    let kind: Part["kind"];
    if (comment !== undefined) kind = "comment";
    else if (label !== undefined) kind = "string";
    else if (quoted !== undefined) kind = "id";
    else if (punct !== undefined) kind = "punct";
    else if (space !== undefined) kind = "space";
    else if (word !== undefined) kind = start ? "id" : wordKind(word, strategies);
    else kind = "punct";
    out.push({ text: whole, kind });
    if (kind === "space") {
      if (whole.includes("\n")) start = true;
    } else if (kind !== "comment") {
      start = kind === "punct" && STARTS.has(whole);
    }
  }
  return out;
}

function wordKind(word: string, strategies: ReadonlySet<string>): Part["kind"] {
  if (KEYWORDS.has(word)) return "keyword";
  if (strategies.has(word)) return "strategy";
  if (SIZE.test(word) || /^-?\d+(\.\d+)?$/.test(word) || word === "true" || word === "false") return "number";
  return "id";
}
