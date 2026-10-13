/**
 * The state of the playground that a link holds: the text, the renderer, the router and the spacing.
 * The hash of the URL holds it: "#z:..." (compressed JSON) or "#<text>" (the text only, URL-encoded).
 */
import { decodeState, encodeState } from "../lib/share.ts";

/** The renderers of the playground. */
export type RendererKind = "svg" | "dom" | "canvas" | "xyflow";

/** The state of the playground. */
export interface PlaygroundState {
  readonly text: string;
  readonly renderer: RendererKind;
  readonly router: "straight" | "orthogonal" | "avoid";
  readonly spacing: number;
}

const RENDERERS: readonly RendererKind[] = ["svg", "dom", "canvas", "xyflow"];

/** This function gives the state of a hash, or undefined for an empty or bad hash. */
export async function readHash(hash: string, fallback: PlaygroundState): Promise<PlaygroundState | undefined> {
  const value = hash.replace(/^#/, "");
  if (value === "") return undefined;
  if (!value.startsWith("z:")) {
    try {
      return { ...fallback, text: decodeURIComponent(value) };
    } catch {
      return undefined;
    }
  }
  const json = await decodeState(value);
  if (json === undefined) return undefined;
  try {
    const data = JSON.parse(json) as Partial<Record<keyof PlaygroundState, unknown>>;
    return {
      text: typeof data.text === "string" ? data.text : fallback.text,
      renderer: RENDERERS.find((r) => r === data.renderer) ?? fallback.renderer,
      router: data.router === "orthogonal" || data.router === "avoid" ? data.router : "straight",
      spacing: typeof data.spacing === "number" && Number.isFinite(data.spacing) ? Math.min(64, Math.max(0, data.spacing)) : fallback.spacing,
    };
  } catch {
    return undefined;
  }
}

/** This function gives the hash of a state. */
export async function writeHash(state: PlaygroundState): Promise<string> {
  return `#${await encodeState(JSON.stringify(state))}`;
}
