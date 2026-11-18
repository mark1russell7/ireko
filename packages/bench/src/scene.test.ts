import { relaxForces } from "ireko/strategies/force";
import { describe, expect, it } from "vitest";
import { ARMS, caseOf, CASES, PICTURE, sceneOf, THETA } from "./scene.ts";

describe("the cases", () => {
  it("has 5 cases or more, each with its own id and its own count of boxes", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(5);
    expect(new Set(CASES.map((spec) => spec.id)).size).toBe(CASES.length);
    expect(new Set(CASES.map((spec) => spec.boxes)).size).toBe(CASES.length);
    expect(CASES.map((spec) => spec.id)).toContain("picture-800");
  });

  it("finds a case by its id, and refuses an id that is not a case", () => {
    expect(caseOf("picture-100")).toEqual({ id: "picture-100", boxes: 100 });
    expect(() => caseOf("picture-7")).toThrow(/no case picture-7/);
  });

  it("has the three arms, and a theta in the range of the option", () => {
    expect(ARMS).toEqual(["base", "head", "theta"]);
    expect(THETA).toBeGreaterThan(0);
    expect(THETA).toBeLessThanOrEqual(1);
  });
});

describe("sceneOf", () => {
  it("gives the same scene for the same case", () => {
    expect(sceneOf(caseOf("picture-200"))).toEqual(sceneOf(caseOf("picture-200")));
  });

  it("gives the count of boxes of the case, with identifiers in their order", () => {
    for (const spec of CASES) {
      const { nodes } = sceneOf(spec);
      const ids = nodes.map((node) => node.id);
      expect(ids.length).toBe(spec.boxes);
      expect(new Set(ids).size).toBe(spec.boxes);
      expect(ids.toSorted()).toEqual(ids);
    }
  });

  it("starts on a grid in the bound, as the strategy force makes it", () => {
    const { nodes, options } = sceneOf({ id: "small", boxes: 30 });
    // 30 boxes: 6 columns and 5 rows. The largest box is 260 by 120, and the margin is 56.
    expect(options.bound).toEqual({ width: 6 * (260 + 56), height: 5 * (120 + 56) });
    expect(nodes[0]?.rect).toEqual({ x: 0, y: 0, width: 260, height: 64 });
    expect(nodes[7]?.rect).toEqual({ x: 316, y: 176, width: 240, height: 88 });
    expect(nodes[29]?.rect).toEqual({ x: 5 * 316, y: 4 * 176, width: 200, height: 120 });
    expect(options).toMatchObject({ iterations: PICTURE.iterations, springLength: 240, repulsion: 240 * 240, margin: 56, inset: 0 });
  });

  it("gives each card a spring to a topic, and no spring from a box to the same box", () => {
    const { nodes, edges } = sceneOf(caseOf("picture-100"));
    const ids = new Set(nodes.map((node) => node.id));
    const topics = new Set(nodes.filter((_, index) => index % 12 === 0).map((node) => node.id));
    expect(topics.size).toBe(9);
    expect(edges.every((edge) => ids.has(edge.from) && ids.has(edge.to) && edge.from !== edge.to)).toBe(true);
    const cards = nodes.filter((node) => !topics.has(node.id));
    for (const card of cards) expect(edges.filter((edge) => edge.from === card.id && topics.has(edge.to) && edge.strength === PICTURE.strength).length).toBe(1);
    // Each topic has cards.
    for (const topic of topics) expect(edges.some((edge) => edge.to === topic && edge.strength === PICTURE.strength)).toBe(true);
    // The weak springs: one for each third box.
    expect(edges.filter((edge) => edge.strength === 0.02).length).toBe(33);
  });

  it("refuses a count of boxes that is not a whole number of 1 or more", () => {
    expect(() => sceneOf({ id: "none", boxes: 0 })).toThrow(RangeError);
    expect(() => sceneOf({ id: "part", boxes: 2.5 })).toThrow(RangeError);
  });

  it("is an input of relaxForces: each box gets a finite place, and the option theta changes the places", () => {
    const scene = sceneOf(caseOf("picture-50"));
    const each = relaxForces(scene.nodes, scene.edges, scene.options);
    const far = relaxForces(scene.nodes, scene.edges, { ...scene.options, theta: THETA });
    expect(each.size).toBe(50);
    expect([...each.values(), ...far.values()].every((place) => Number.isFinite(place.x) && Number.isFinite(place.y))).toBe(true);
    expect(scene.nodes.some((node) => each.get(node.id)?.x !== far.get(node.id)?.x)).toBe(true);
  });
});
