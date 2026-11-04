// The switch of the time run.
export { VexContractError, VEX_ERROR } from "../../../scripts/reprint-arms/shape-old.generated.js";
export function nodeShape(...args) {
  const state = globalThis.__reprint;
  if (state.log !== undefined) state.log.shape.push(args);
  return state.fn.shape(...args);
}
