/**
 * A read-only text of the text language, with the colors of the editor. Astro pages use it with no script, and the
 * islands use it in the browser.
 */
import type { ReactElement } from "react";
import { highlight, type Part } from "../lib/highlight.ts";

interface Props {
  readonly source: string;
  readonly className?: string;
  /** The label of the code for assistive technology. */
  readonly label?: string;
}

/** The highlighted source. */
export default function SourceView({ source, className, label }: Props): ReactElement {
  // The key of a part is its place in the text.
  const parts: (Part & { readonly key: number })[] = [];
  let at = 0;
  for (const p of highlight(source.trim())) {
    parts.push({ ...p, key: at });
    at += p.text.length;
  }
  return (
    <pre className={`ik-source ${className ?? ""}`} aria-label={label} tabIndex={0}>
      <code>
        {parts.map((p) => (
          <span key={p.key} className={`ik-tok-${p.kind}`}>
            {p.text}
          </span>
        ))}
      </code>
    </pre>
  );
}
