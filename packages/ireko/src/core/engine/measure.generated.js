// The switch of the time run.
export { VexContractError, VEX_ERROR } from "../../../scripts/reprint-arms/measure-old.generated.js";
export function measureOf(...args) {
  const state = globalThis.__reprint;
  if (state.log !== undefined) state.log.measure.push(args);
  return state.fn.measure(...args);
}
