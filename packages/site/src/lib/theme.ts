/**
 * The theme of the live renderers on the site. The DOM and Canvas renderers need real colors.
 * Thus this hook reads the family tokens (tokens.css), and reads them again when the reader changes the theme.
 */
import type { Theme } from "ireko/render";
import { useEffect, useState } from "react";

/** This function reads the colors of the current theme from the CSS variables of the page. */
export function readTheme(): Partial<Theme> {
  if (typeof document === "undefined") return {};
  const css = getComputedStyle(document.documentElement);
  const v = (name: string): string => css.getPropertyValue(name).trim();
  return {
    background: "transparent",
    nodeFill: v("--color-surface"),
    nodeStroke: v("--color-ink-secondary"),
    containerFill: v("--color-surface-sunken"),
    containerStroke: v("--color-rule-strong"),
    text: v("--color-ink"),
    mutedText: v("--color-ink-muted"),
    edge: v("--color-control-border"),
    extraEdge: v("--color-accent"),
    accent: v("--color-mark"),
    fontFamily: v("--font-sans"),
  };
}

/** This hook gives the theme of the page, and a new theme after each change of the theme. */
export function useSiteTheme(): Partial<Theme> {
  const [theme, setTheme] = useState<Partial<Theme>>({});
  useEffect(() => {
    const update = (): void => setTheme(readTheme());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", update);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, []);
  return theme;
}

/** This hook tells if the reader prefers reduced motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = (): void => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}
