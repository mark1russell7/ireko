/** The small playground of the page "Write a strategy", with the strategy "spiral" in its engine. */
import type { ReactElement } from "react";
import { spiralEngine } from "../lib/spiral.ts";
import Try from "./Try.tsx";

/** The widget. */
export default function SpiralTry({ source }: { readonly source: string }): ReactElement {
  return <Try source={source} engine={spiralEngine} title="The strategy spiral" height="24rem" />;
}
