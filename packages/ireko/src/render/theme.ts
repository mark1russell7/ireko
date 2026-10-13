/**
 * The theme of the renderers: colors, fonts and sizes. Each renderer and the SVG export use the same theme.
 */

/** The colors and the fonts of a renderer. */
export interface Theme {
  readonly background: string;
  readonly nodeFill: string;
  readonly nodeStroke: string;
  readonly containerFill: string;
  readonly containerStroke: string;
  readonly text: string;
  readonly mutedText: string;
  readonly edge: string;
  readonly extraEdge: string;
  /** The color of the box that a user selects. */
  readonly accent: string;
  readonly radius: number;
  readonly fontSize: number;
  readonly fontFamily: string;
}

/** The light theme: ink on paper, the same as the site. */
export const lightTheme: Theme = {
  background: "#f5f6f9",
  nodeFill: "#ffffff",
  nodeStroke: "#454f67",
  containerFill: "#eef1f6",
  containerStroke: "#aeb6c7",
  text: "#151c2e",
  mutedText: "#5f6880",
  edge: "#7a8399",
  extraEdge: "#2346c4",
  accent: "#2346c4",
  radius: 6,
  fontSize: 13,
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
};

/** The dark theme. */
export const darkTheme: Theme = {
  ...lightTheme,
  background: "#0e1220",
  nodeFill: "#151a2b",
  nodeStroke: "#b3bad0",
  containerFill: "#1c2236",
  containerStroke: "#46507a",
  text: "#e6e9f3",
  mutedText: "#949cb3",
  edge: "#6f7aa3",
  extraEdge: "#93abff",
  accent: "#93abff",
};

/** This function merges a partial theme with a base theme. */
export function themeOf(partial: Partial<Theme> | undefined, base: Theme = lightTheme): Theme {
  return partial === undefined ? base : { ...base, ...partial };
}
