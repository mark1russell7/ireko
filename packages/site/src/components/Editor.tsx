/**
 * The editor of the text language: a text area over a highlighted copy of its text. The parser gives the place of an
 * error, and the editor underlines it with red pencil.
 */
import type { SyntaxIssue } from "ireko/text";
import { useMemo, useRef, type KeyboardEvent, type ReactElement } from "react";
import { highlight, type Part } from "../lib/highlight.ts";

interface Props {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error?: SyntaxIssue | undefined;
  readonly strategies?: ReadonlySet<string>;
  readonly label: string;
  readonly className?: string;
  /** The identifier of the element that shows the error. The default is "ik-editor-error". */
  readonly errorId?: string;
}

/** The editor. Tab adds two spaces. */
export default function Editor({ value, onChange, error, strategies, label, className, errorId = "ik-editor-error" }: Props): ReactElement {
  const pre = useRef<HTMLPreElement>(null);
  const parts = useMemo(() => withError(highlight(value, strategies), error), [value, strategies, error]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key !== "Tab" || e.shiftKey) return;
    e.preventDefault();
    const area = e.currentTarget;
    const { selectionStart: start, selectionEnd: end } = area;
    onChange(`${value.slice(0, start)}  ${value.slice(end)}`);
    requestAnimationFrame(() => area.setSelectionRange(start + 2, start + 2));
  };

  return (
    <div className={`ik-editor ${className ?? ""}`}>
      <pre ref={pre} aria-hidden="true">
        {parts.map((p) => (
          <span key={p.at} className={`ik-tok-${p.kind === "space" ? "space" : p.kind}${p.error ? " ik-tok-error" : ""}`}>
            {p.text}
          </span>
        ))}
        {/* A last line break keeps the height of an empty last line. */}
        {"\n"}
      </pre>
      <textarea
        aria-label={label}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onScroll={(e) => {
          if (pre.current !== null) {
            pre.current.scrollTop = e.currentTarget.scrollTop;
            pre.current.scrollLeft = e.currentTarget.scrollLeft;
          }
        }}
        aria-invalid={error === undefined ? undefined : true}
        aria-errormessage={error === undefined ? undefined : errorId}
      />
    </div>
  );
}

/** This function marks the parts that the error covers. A part that the error cuts becomes two or three parts. */
function withError(parts: readonly Part[], error: SyntaxIssue | undefined): (Part & { readonly error?: boolean; readonly at: number })[] {
  if (error === undefined) {
    let offset = 0;
    return parts.map((p) => {
      const at = offset;
      offset += p.text.length;
      return { ...p, at };
    });
  }
  const from = error.offset;
  const to = error.offset + Math.max(1, error.length);
  const out: (Part & { error?: boolean; at: number })[] = [];
  let at = 0;
  for (const p of parts) {
    const start = at;
    const end = at + p.text.length;
    at = end;
    if (end <= from || start >= to) {
      out.push({ ...p, at: start });
      continue;
    }
    const a = Math.max(from, start) - start;
    const b = Math.min(to, end) - start;
    if (a > 0) out.push({ ...p, text: p.text.slice(0, a), at: start });
    out.push({ ...p, text: p.text.slice(a, b), error: true, at: start + a });
    if (b < p.text.length) out.push({ ...p, text: p.text.slice(b), at: start + b });
  }
  // An error at the end of the text gets one visible mark.
  if (from >= at) out.push({ text: " ", kind: "space", error: true, at });
  return out;
}
