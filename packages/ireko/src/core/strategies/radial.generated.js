// The switch of the time run.
export { VexContractError, VEX_ERROR } from "../../../scripts/reprint-arms/radial-old.generated.js";
export function radialOf(...args) {
  const state = globalThis.__reprint;
  if (state.log !== undefined) state.log.radial.push(args);
  return state.fn.radial(...args);
}
