/**
 * The text language of ireko. A document is a tree of node statements and edge statements:
 *
 * ```text
 * root grid(columns: 3) {
 *   api "API" radial nested { auth users billing }
 *   web nested { home search cart }
 * }
 * api -> web "calls"
 * ```
 *
 * A node statement is an identifier, then a label, a strategy, a mode, a fit and a size, then a block of children.
 * Each part after the identifier is optional. A word after the identifier is a part of the node only if it is a
 * keyword or the name of a strategy. Thus `{ auth users billing }` has three leaves, and needs no commas.
 */
import { at, atKey } from "../core/at.ts";
import { BUILTIN_STRATEGY_NAMES } from "../core/strategies/names.ts";
import type { EdgeSpec, Fit, LayoutInput, Mode, NodeSpec, Size } from "../core/index.ts";

/** A syntax error, with its place in the text. The editor of the site underlines it. */
export interface SyntaxIssue {
  readonly message: string;
  /** The place of the first character, from 0. */
  readonly offset: number;
  readonly length: number;
  /** The line, from 1. */
  readonly line: number;
  /** The column, from 1. */
  readonly column: number;
}

/** The result of `parse`: the input, or the first syntax error. */
export type ParseResult = { readonly ok: true; readonly input: LayoutInput } | { readonly ok: false; readonly error: SyntaxIssue };

/** The options of `parse`. */
export interface ParseOptions {
  /** The names of the strategies. The default is the built-in strategies: `grid`, `radial` and `tree`. Give the names of the strategies that you register. */
  readonly strategies?: readonly string[];
}

const MODE_WORDS: ReadonlyMap<string, Mode> = new Map<string, Mode>([
  ["nested", "nested"],
  ["linked", "linked"],
]);
const FIT_WORDS: ReadonlyMap<string, Fit> = new Map<string, Fit>([
  ["grow", "grow"],
  ["scale", "scale"],
  ["clip", "clip"],
]);

/** The words that set the mode or the fit of a node. */
export const KEYWORDS: ReadonlySet<string> = new Set([...MODE_WORDS.keys(), ...FIT_WORDS.keys()]);

type Kind = "word" | "id" | "string" | "arrow" | "{" | "}" | "(" | ")" | "," | ":" | ";" | "newline" | "end";

const PUNCTUATION: ReadonlyMap<string, Kind> = new Map<string, Kind>([
  ["{", "{"],
  ["}", "}"],
  ["(", "("],
  [")", ")"],
  [",", ","],
  [":", ":"],
  [";", ";"],
]);

interface Token {
  readonly kind: Kind;
  readonly text: string;
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}

class Failure extends Error {
  readonly issue: SyntaxIssue;
  constructor(issue: SyntaxIssue) {
    super(issue.message);
    this.issue = issue;
  }
}

const WORD = /[A-Za-z0-9_.@$+-]/;
const SIZE = /^(\d+(?:\.\d+)?|_)x(\d+(?:\.\d+)?|_)$/;

/** This function gives the tokens of a text. It throws a `Failure` for a string without its end. */
function tokens(text: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  let line = 1;
  let lineStart = 0;
  const push = (kind: Kind, value: string, start: number, startLine: number, startColumn: number): void => {
    out.push({ kind, text: value, offset: start, line: startLine, column: startColumn });
  };
  while (i < text.length) {
    const c = text.charAt(i);
    const column = i - lineStart + 1;
    if (c === "\n") {
      push("newline", "\n", i, line, column);
      i++;
      line++;
      lineStart = i;
    } else if (c === " " || c === "\t" || c === "\r") {
      i++;
    } else if (c === "#" || (c === "/" && text.charAt(i + 1) === "/")) {
      while (i < text.length && text.charAt(i) !== "\n") i++;
    } else if (c === "-" && text.charAt(i + 1) === ">") {
      push("arrow", "->", i, line, column);
      i += 2;
    } else if (c === '"' || c === "'") {
      const start = i;
      let value = "";
      i++;
      while (i < text.length && text.charAt(i) !== c) {
        if (text.charAt(i) === "\n") break;
        if (text.charAt(i) === "\\" && i + 1 < text.length) {
          const next = text.charAt(i + 1);
          value += next === "n" ? "\n" : next;
          i += 2;
        } else {
          value += text.charAt(i);
          i++;
        }
      }
      if (text.charAt(i) !== c) throw new Failure({ message: `The text has a ${c === '"' ? "label" : "quoted identifier"} without its closing quote.`, offset: start, length: i - start, line, column });
      i++;
      push(c === '"' ? "string" : "id", value, start, line, column);
    } else if (PUNCTUATION.has(c)) {
      push(atKey(PUNCTUATION, c), c, i, line, column);
      i++;
    } else if (WORD.test(c)) {
      const start = i;
      while (i < text.length && WORD.test(text.charAt(i)) && !(text.charAt(i) === "-" && text.charAt(i + 1) === ">")) i++;
      push("word", text.slice(start, i), start, line, column);
    } else {
      throw new Failure({ message: `The character "${c}" is not permitted here.`, offset: i, length: 1, line, column });
    }
  }
  out.push({ kind: "end", text: "", offset: text.length, line, column: text.length - lineStart + 1 });
  return out;
}

/** This function reads a document of the text language. It gives the input, or the first syntax error. */
export function parse(text: string, options: ParseOptions = {}): ParseResult {
  try {
    return { ok: true, input: new Parser(tokens(text), new Set(options.strategies ?? BUILTIN_STRATEGY_NAMES)).document() };
  } catch (error) {
    if (error instanceof Failure) return { ok: false, error: error.issue };
    throw error;
  }
}

class Parser {
  private at = 0;
  private readonly edges: EdgeSpec[] = [];
  /** The first token of each root node, for the error message of a document with more than one root. */
  private readonly starts: Token[] = [];

  private readonly list: readonly Token[];
  private readonly strategies: ReadonlySet<string>;

  constructor(list: readonly Token[], strategies: ReadonlySet<string>) {
    this.list = list;
    this.strategies = strategies;
  }

  document(): LayoutInput {
    const roots = this.statements("end");
    if (roots.length === 0) this.fail(this.peek(), "The document has no node. Write one root node, for example: root { a b c }");
    if (roots.length > 1) this.fail(at(this.starts, 1), `The document has ${String(roots.length)} root nodes. Put them in one root node.`);
    const root = at(roots, 0);
    return this.edges.length > 0 ? { root, edges: this.edges } : { root };
  }

  /** This function reads statements until the token kind `until`, and gives the nodes. */
  private statements(until: "end" | "}"): NodeSpec[] {
    const nodes: NodeSpec[] = [];
    for (;;) {
      this.skipSeparators();
      const t = this.peek();
      if (t.kind === until) return nodes;
      if (t.kind === "end") this.fail(t, "The block has no closing brace.");
      if (t.kind !== "word" && t.kind !== "id") this.fail(t, `The text has ${describe(t)} where a node identifier must be.`);
      if (this.peek(1).kind === "arrow") this.edge();
      else {
        if (until === "end") this.starts.push(t);
        nodes.push(this.node());
      }
    }
  }

  private edge(): void {
    const source = this.next().text;
    this.next();
    const target = this.next();
    if (target.kind !== "word" && target.kind !== "id") this.fail(target, `The edge from "${source}" has no target. Write: ${source} -> target`);
    const label = this.peek().kind === "string" ? this.next().text : undefined;
    this.edges.push(label === undefined ? { source, target: target.text } : { source, target: target.text, label });
    this.endOfStatement();
  }

  private node(): NodeSpec {
    const idToken = this.next();
    const spec: { -readonly [K in keyof NodeSpec]: NodeSpec[K] } = { id: idToken.text };
    for (;;) {
      const t = this.peek();
      if (t.kind === "string") {
        if (spec.label !== undefined) this.fail(t, `The node "${spec.id}" has two labels.`);
        spec.label = this.next().text;
      } else if (t.kind === "word" && MODE_WORDS.has(t.text)) {
        this.next();
        if (spec.mode !== undefined) this.fail(t, `The node "${spec.id}" has two modes.`);
        spec.mode = atKey(MODE_WORDS, t.text);
      } else if (t.kind === "word" && FIT_WORDS.has(t.text)) {
        this.next();
        if (spec.fit !== undefined) this.fail(t, `The node "${spec.id}" has two fit policies.`);
        spec.fit = atKey(FIT_WORDS, t.text);
      } else if (t.kind === "word" && SIZE.test(t.text)) {
        if (spec.size !== undefined) this.fail(t, `The node "${spec.id}" has two sizes.`);
        spec.size = sizeOf(this.next().text);
      } else if (t.kind === "word" && this.strategies.has(t.text)) {
        if (spec.layout !== undefined) this.fail(t, `The node "${spec.id}" has two strategies.`);
        this.next();
        spec.layout = this.peek().kind === "(" ? { type: t.text, ...this.args() } : t.text;
      } else if (t.kind === "{") {
        this.next();
        spec.children = this.statements("}");
        this.next();
        return spec;
      } else {
        return spec;
      }
    }
  }

  private args(): Record<string, unknown> {
    const open = this.next();
    const out: Record<string, unknown> = {};
    for (;;) {
      this.skipNewlines();
      const key = this.next();
      if (key.kind === ")") return out;
      if (key.kind !== "word") this.fail(key, `The options have ${describe(key)} where an option name must be.`);
      if (this.next().kind !== ":") this.fail(at(this.list, this.at - 1), `The option "${key.text}" needs a colon and a value, for example: ${key.text}: 3`);
      this.skipNewlines();
      const value = this.next();
      if (value.kind !== "word" && value.kind !== "string") this.fail(value, `The option "${key.text}" has no value.`);
      out[key.text] = value.kind === "string" ? value.text : valueOf(value.text);
      this.skipNewlines();
      const after = this.next();
      if (after.kind === ")") return out;
      if (after.kind !== ",") this.fail(after.kind === "end" ? open : after, after.kind === "end" ? "The options have no closing parenthesis." : `The options have ${describe(after)} where a comma or ")" must be.`);
    }
  }

  private endOfStatement(): void {
    const t = this.peek();
    if (t.kind === "newline" || t.kind === "," || t.kind === ";" || t.kind === "}" || t.kind === "end") return;
    this.fail(t, `The text has ${describe(t)} after the end of a statement.`);
  }

  private skipSeparators(): void {
    while (["newline", ",", ";"].includes(this.peek().kind)) this.at++;
  }

  private skipNewlines(): void {
    while (this.peek().kind === "newline") this.at++;
  }

  private peek(ahead = 0): Token {
    return at(this.list, Math.min(this.at + ahead, this.list.length - 1));
  }

  private next(): Token {
    const t = this.peek();
    if (t.kind !== "end") this.at++;
    return t;
  }

  private fail(t: Token, message: string): never {
    throw new Failure({ message, offset: t.offset, length: Math.max(1, t.text.length), line: t.line, column: t.column });
  }
}

function describe(t: Token): string {
  if (t.kind === "end") return "the end of the text";
  if (t.kind === "string") return `the label "${t.text}"`;
  return `"${t.text}"`;
}

/** This function reads a size, for example `120x48` or `120x_`. The caller matched the text with `SIZE` first. */
function sizeOf(text: string): Partial<Size> {
  const [w, h] = text.split("x");
  return { ...(w === "_" ? {} : { width: Number(w) }), ...(h === "_" ? {} : { height: Number(h) }) };
}

function valueOf(text: string): unknown {
  if (text === "true") return true;
  if (text === "false") return false;
  const n = Number(text);
  return text !== "" && Number.isFinite(n) ? n : text;
}
