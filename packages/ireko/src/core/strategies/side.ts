/** The side of a node where its linked children go, and the direction of the tree edges for each side. */
import type { Direction } from "../strategy.ts";

/** The sides of a node. */
export type Side = "bottom" | "top" | "left" | "right";

/** The direction of the tree edges for each side: the children below the node give edges that go down. */
export const DIRECTION: Readonly<Record<Side, Direction>> = { bottom: "down", top: "up", left: "left", right: "right" };
