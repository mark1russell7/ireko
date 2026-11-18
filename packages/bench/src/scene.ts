/**
 * The scenes of the bench of `relaxForces`. A scene has the boxes, the springs and the options that the strategy
 * `force` gives to the relaxation for a picture of a conversation. It has no random values, so each arm reads the
 * same input.
 *
 * - Each 12th box is a topic, and each other box is a card. The cards have 4 widths and 5 heights.
 * - Each card has a spring to one topic. The topic of a card is not the nearest topic of the start.
 * - Each third box also has a weak spring to the box before it.
 * - The start is a grid in the order of the identifiers, as the strategy `force` makes it.
 *
 * @packageDocumentation
 */

import type { RelaxEdge, RelaxNode } from "ireko/strategies/force";

/** The arms of the bench. */
export const ARMS = ["base", "head", "theta"] as const;

/** The id of an arm. */
export type ArmId = (typeof ARMS)[number];

/** The value of the option `theta` in the arm `theta`. It is the usual value of the method of Barnes and Hut. */
export const THETA = 0.9;

/** The settings of a picture of a conversation: the options of the strategy `force` that the picture sets. */
export const PICTURE = { iterations: 300, springLength: 240, margin: 56, strength: 0.08 } as const;

/** The count of the boxes of one topic: the topic and its cards. */
const GROUP = 12;
const TOPIC = { width: 260, height: 64 } as const;
const CARD_WIDTHS = [180, 200, 220, 240] as const;
const CARD_HEIGHTS = [56, 72, 88, 104, 120] as const;
/** The strength of the spring between a box and the box before it. */
const WEAK = 0.02;

/** One case of the bench: a picture with a count of boxes. */
export interface CaseSpec {
  readonly id: string;
  /** The count of the boxes. */
  readonly boxes: number;
}

/** The cases of the bench. The A/A band of a time verdict needs 5 cases or more. */
export const CASES: readonly CaseSpec[] = [50, 100, 200, 400, 800, 1600].map((boxes): CaseSpec => ({ id: `picture-${String(boxes)}`, boxes }));

/** The options of the relaxation of a scene. Each arm adds its own `theta`. */
export interface SceneOptions {
  readonly iterations: number;
  readonly springLength: number;
  readonly repulsion: number;
  readonly margin: number;
  readonly inset: number;
  readonly bound: { readonly width: number; readonly height: number };
}

/** The input of one use of `relaxForces`. */
export interface Scene {
  readonly nodes: readonly RelaxNode[];
  readonly edges: readonly RelaxEdge[];
  readonly options: SceneOptions;
}

/** This function gives the case with the id `id`. An id that is not in `CASES` is an error. */
export function caseOf(id: string): CaseSpec {
  const spec = CASES.find((entry) => entry.id === id);
  if (spec === undefined) throw new RangeError(`There is no case ${id}. The cases are: ${CASES.map((entry) => entry.id).join(", ")}.`);
  return spec;
}

const pick = (list: readonly number[], index: number): number => list[index % list.length] ?? 0;
const idOf = (index: number): string => `b${String(index).padStart(5, "0")}`;

/** This function makes the scene of a case. The same case gives the same scene. */
export function sceneOf(spec: CaseSpec): Scene {
  const count = spec.boxes;
  if (!Number.isSafeInteger(count) || count < 1) throw new RangeError(`The count of the boxes is ${String(count)}. It must be a whole number of 1 or more.`);
  const sizes = Array.from({ length: count }, (_, index) => (index % GROUP === 0 ? TOPIC : { width: pick(CARD_WIDTHS, index), height: pick(CARD_HEIGHTS, index) }));
  const { margin } = PICTURE;
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const cellW = Math.max(...sizes.map((size) => size.width)) + margin;
  const cellH = Math.max(...sizes.map((size) => size.height)) + margin;
  const nodes = sizes.map((size, index): RelaxNode => ({
    id: idOf(index),
    rect: { x: (index % columns) * cellW, y: Math.floor(index / columns) * cellH, width: size.width, height: size.height },
  }));
  const topics = Math.ceil(count / GROUP);
  const edges: RelaxEdge[] = [];
  for (let index = 0; index < count; index++) {
    // The factor 7 puts the cards of one topic at many places of the start.
    if (index % GROUP !== 0) edges.push({ from: idOf(index), to: idOf(GROUP * ((index * 7) % topics)), strength: PICTURE.strength });
    if (index % 3 === 1) edges.push({ from: idOf(index - 1), to: idOf(index), strength: WEAK });
  }
  return {
    nodes,
    edges,
    options: {
      iterations: PICTURE.iterations,
      springLength: PICTURE.springLength,
      repulsion: PICTURE.springLength * PICTURE.springLength,
      margin,
      inset: 0,
      bound: { width: columns * cellW, height: rows * cellH },
    },
  };
}
