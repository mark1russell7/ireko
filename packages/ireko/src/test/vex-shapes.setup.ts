// The setup of `vitest.vex-shapes.config.ts`: it turns the switch of the shapes on before each test file.
import { setLinkedShape } from "../core/engine/shape.ts";
import { vexLinkedShape } from "../core/engine/shape-vex.ts";

setLinkedShape(vexLinkedShape);
