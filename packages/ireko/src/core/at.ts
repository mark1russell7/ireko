/**
 * This function gives the item at the index `i`. The engine uses it where the index is always valid by construction.
 * A missing item is a defect of the engine, so the function throws.
 */
export function at<T>(list: ArrayLike<T>, i: number): T {
  const v = list[i];
  if (v === undefined) throw new RangeError(`ireko: internal error, no item at the index ${String(i)}.`);
  return v;
}

/** This function gives the value of the key `key`. The engine uses it where the key is always present by construction. */
export function atKey<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  return at([map.get(key)].filter((v): v is V => v !== undefined), 0);
}
