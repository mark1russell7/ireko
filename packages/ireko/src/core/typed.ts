/**
 * The reads of the lists of numbers of the relaxation. Each function reads one kind of list only.
 *
 * The relaxation reads each pair of boxes many times, so the speed of a read sets its speed. `at` reads lists of each
 * kind, and a JavaScript engine cannot compile such a read to one load. An index is always valid by construction, so
 * a missing number is a defect of the engine, and each function throws.
 */

/** This function gives the number at the index `i` of a list of 64-bit numbers. */
export function num(list: Float64Array, i: number): number {
  const v = list[i];
  if (v === undefined) throw new RangeError(`ireko: internal error, no number at the index ${String(i)}.`);
  return v;
}

/** This function gives the integer at the index `i` of a list of 32-bit integers. */
export function int(list: Int32Array, i: number): number {
  const v = list[i];
  if (v === undefined) throw new RangeError(`ireko: internal error, no integer at the index ${String(i)}.`);
  return v;
}

/** This function gives the flag at the index `i` of a list of bytes: `true` if the byte is not 0. */
export function flag(list: Uint8Array, i: number): boolean {
  const v = list[i];
  if (v === undefined) throw new RangeError(`ireko: internal error, no flag at the index ${String(i)}.`);
  return v !== 0;
}
