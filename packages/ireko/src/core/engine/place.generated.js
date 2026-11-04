// The switch of the time run.
export { VexContractError, VEX_ERROR } from "../../../scripts/reprint-arms/place-old.generated.js";
export function placeOf(...args) {
  const state = globalThis.__reprint;
  if (state.log !== undefined) state.log.place.push(args);
  return state.fn.place(...args);
}
