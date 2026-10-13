/**
 * The fuzz button of the playground: a random tree from a seed. The same seed gives the same tree.
 * Thus a link with the seed shows the same layout to each reader, and a defect that a reader finds can become a test.
 */
import type { NodeSpec } from "ireko";

/** This function gives a generator of numbers from 0 to 1 for a seed (mulberry32). */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** This function gives a random tree for a seed: up to four levels, mixed strategies and modes. */
export function randomTree(seed: number): NodeSpec {
  const next = random(seed);
  let count = 0;
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(next() * list.length)] as T;
  const make = (depth: number): NodeSpec => {
    const id = `n${String(count++)}`;
    const children = depth > 0 && next() < 0.75 ? Array.from({ length: 1 + Math.floor(next() * 4) }, () => make(depth - 1)) : [];
    const strategy = pick(["grid", "radial", "tree"] as const);
    const options =
      strategy === "grid" ? (next() < 0.3 ? { type: "grid", columns: 1 + Math.floor(next() * 3) } : "grid") : strategy === "radial" ? (next() < 0.3 ? { type: "radial", sweep: 120 + Math.floor(next() * 200) } : "radial") : "tree";
    return { id, ...(children.length > 0 ? { layout: options, mode: pick(["nested", "linked"] as const), children } : {}) };
  };
  return make(3);
}
