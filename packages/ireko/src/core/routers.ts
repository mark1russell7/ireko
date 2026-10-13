/**
 * The built-in routers: `straight` and `orthogonal`.
 */
import { centerOf, type Point } from "./geometry.ts";
import { borderPoint, defineRouter, nestedPair, type Router } from "./router.ts";

/** The router `straight` draws one segment between the edges of the two boxes. */
export const straight: Router = defineRouter({
  type: "straight",
  description: "The straight router draws one segment between the edges of the two boxes, on the line between their centers.",
  route({ source, target }) {
    const a = centerOf(source);
    const b = centerOf(target);
    if (nestedPair(source, target)) return [a, b];
    return [borderPoint(source, b), borderPoint(target, a)];
  },
});

/**
 * The router `orthogonal` draws horizontal and vertical segments. The edge leaves the side of the source that faces
 * the target, and it turns at the middle of the gap between the boxes.
 */
export const orthogonal: Router = defineRouter({
  type: "orthogonal",
  description: "The orthogonal router draws horizontal and vertical segments. It turns at the middle of the gap between the boxes.",
  route({ source, target }) {
    const a = centerOf(source);
    const b = centerOf(target);
    if (nestedPair(source, target)) return [a, b];
    const dx = b.x - a.x;
    const dy = b.y - a.y;

    if (Math.abs(dy) >= Math.abs(dx)) {
      const down = dy > 0;
      const start: Point = { x: a.x, y: down ? source.y + source.height : source.y };
      const end: Point = { x: b.x, y: down ? target.y : target.y + target.height };
      // The boxes overlap on the vertical axis: there is no gap for the turn.
      if (down ? end.y < start.y : end.y > start.y) return straight.route({ id: "", kind: "tree", source, target });
      if (start.x === end.x) return [start, end];
      const mid = (start.y + end.y) / 2;
      return [start, { x: start.x, y: mid }, { x: end.x, y: mid }, end];
    }

    const right = dx > 0;
    const start: Point = { x: right ? source.x + source.width : source.x, y: a.y };
    const end: Point = { x: right ? target.x : target.x + target.width, y: b.y };
    if (right ? end.x < start.x : end.x > start.x) return straight.route({ id: "", kind: "tree", source, target });
    if (start.y === end.y) return [start, end];
    const mid = (start.x + end.x) / 2;
    return [start, { x: mid, y: start.y }, { x: mid, y: end.y }, end];
  },
});
