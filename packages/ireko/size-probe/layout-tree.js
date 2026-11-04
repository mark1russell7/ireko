// Case e of the size probe: `layout` on an engine whose strategy `tree` calls the tree module of this folder. A strategy
// with the type of a built-in strategy replaces it at run time. The list `builtinStrategies` still imports
// `src/core/strategies/tree.ts`, so this bundle holds that code and the module. The options of the strategy are the
// options of that code.
import { createEngine } from "../src/core/engine.ts";
import { tree } from "../src/core/strategies/tree.ts";
import { treeOf } from "./tree.generated.js";

function arrange({ mode, self, children, options, gap }) {
  const records = children.map((c, i) => ({
    i,
    bw: c.box.width,
    bh: c.box.height,
    ex: c.extent.x,
    ey: c.extent.y,
    ew: c.extent.width,
    eh: c.extent.height,
    shaped: c.shape !== undefined,
    rows: c.shape?.rows ?? [],
    cols: c.shape?.columns ?? [],
  }));
  const values = treeOf(records, { ...options, mode, gap, selfW: self.width, selfH: self.height });
  const offsets = values.map((o) => ({ x: o.x, y: o.y }));
  const direction = values[0]?.direction ?? "";
  return direction === "" ? { offsets } : { offsets, direction };
}

const engine = createEngine({ strategies: [{ ...tree, arrange }] });

export function layout(input, options) {
  return engine.layout(input, options);
}
