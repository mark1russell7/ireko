/** The escape of text for SVG and HTML. It is not a part of the public API. */

/** This function escapes the characters that have a meaning in XML. */
export function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
