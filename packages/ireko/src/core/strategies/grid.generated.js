// The switch of the time run.
export { VexContractError, VEX_ERROR } from "../../../scripts/reprint-arms/grid-old.generated.js";
export function gridOf(...args) {
  const state = globalThis.__reprint;
  if (state.log !== undefined) state.log.grid.push(args);
  return state.fn.grid(...args);
}
