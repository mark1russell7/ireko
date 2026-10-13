/**
 * The printer of the text language. It writes an input as text, in the canonical form.
 * The canonical form has two spaces of indentation, and it puts a block of leaves on one line.
 * `parse(print(input))` gives the input again. It loses only the data of the user and the identifiers of the edges.
 */
import type { LayoutInput, NodeSpec } from "../core/index.ts";
import { KEYWORDS } from "./parse.ts";

/** The options of `print`. */
export interface PrintOptions {
  /** The names of the strategies. An identifier with one of these names gets quotes. The default is `grid` and `radial`. */
  readonly strategies?: readonly string[];
  /** The largest length of a line of leaves. The default is 80. */
  readonly width?: number;
}

const BARE = /^[A-Za-z0-9_.@$+-]+$/;
const SIZE_LIKE = /^(\d+(?:\.\d+)?|_)x(\d+(?:\.\d+)?|_)$/;

/** This function writes an input as text of the language. */
export function print(input: LayoutInput, options: PrintOptions = {}): string {
  const strategies = new Set(options.strategies ?? ["grid", "radial"]);
  const width = options.width ?? 80;
  const lines: string[] = [];
  const id = (value: string): string => (BARE.test(value) && !value.includes("->") && !KEYWORDS.has(value) && !strategies.has(value) && !SIZE_LIKE.test(value) ? value : `'${escape(value, "'")}'`);

  const head = (n: NodeSpec): string => {
    const parts = [id(n.id)];
    if (n.label !== undefined && n.label !== n.id) parts.push(`"${escape(n.label, '"')}"`);
    if (n.layout !== undefined) {
      if (typeof n.layout === "string") parts.push(n.layout);
      else {
        const args = Object.entries(n.layout).filter(([k, v]) => k !== "type" && v !== undefined);
        parts.push(args.length === 0 ? n.layout.type : `${n.layout.type}(${args.map(([k, v]) => `${k}: ${valueText(v)}`).join(", ")})`);
      }
    }
    if (n.mode === "nested") parts.push("nested");
    if (n.fit !== undefined && n.fit !== "grow") parts.push(n.fit);
    if (n.size !== undefined && (n.size.width !== undefined || n.size.height !== undefined)) parts.push(`${dim(n.size.width)}x${dim(n.size.height)}`);
    return parts.join(" ");
  };

  const write = (n: NodeSpec, indent: string): void => {
    const children = n.children ?? [];
    if (children.length === 0) {
      lines.push(indent + head(n));
      return;
    }
    const leaves = children.every((c) => (c.children ?? []).length === 0);
    const inline = leaves ? `${indent}${head(n)} { ${children.map(head).join(" ")} }` : "";
    if (leaves && inline.length <= width) {
      lines.push(inline);
      return;
    }
    lines.push(`${indent}${head(n)} {`);
    for (const c of children) write(c, `${indent}  `);
    lines.push(`${indent}}`);
  };

  write(input.root, "");
  for (const e of input.edges ?? []) lines.push(`${id(e.source)} -> ${id(e.target)}${e.label === undefined ? "" : ` "${escape(e.label, '"')}"`}`);
  return `${lines.join("\n")}\n`;
}

function dim(v: number | undefined): string {
  return v === undefined ? "_" : String(v);
}

function valueText(v: unknown): string {
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const text = typeof v === "string" ? v : JSON.stringify(v);
  return BARE.test(text) && text !== "true" && text !== "false" && !Number.isFinite(Number(text)) ? text : `"${escape(text, '"')}"`;
}

function escape(text: string, quote: string): string {
  return text.replace(/\\/g, "\\\\").replace(new RegExp(quote, "g"), `\\${quote}`).replace(/\n/g, "\\n");
}
