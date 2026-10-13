// iteration/iterate.ts
import { Logger } from "../core/logging/logger";

import { LimitError } from "../errors";
export type LimitAction = "throw" | "truncate" | "warn";

export function enforceBound(
    label: string,
    count: number,
    limit: number,
    action: LimitAction,
    log?: Logger
): number {
  if (count <= limit) return count;
  const ctx = { label, count, limit, action };
  switch (action) {
    case "throw":
      throw new LimitError("LIMIT_MAX_NODES", `${label}: limit ${limit} exceeded (count=${count})`, ctx);
    case "warn":
      log?.warn(`${label}: trimming to limit`, ctx);
      return limit;
    case "truncate":
    default:
      return limit;
  }
}

export function timesBounded(
    n: number,
    limit: number,
    action: LimitAction,
    each: (i: number) => void,
    log?: Logger,
    label: string = "timesBounded"
): number {
    const k = enforceBound(label, n, limit, action, log);
    for (let i = 0; i < k; i++) each(i);
    return k;
}

export function mapIndexBounded<T>(
    n: number,
    limit: number,
    action: LimitAction,
    f: (i: number) => T,
    log?: Logger,
    label: string = "mapIndexBounded"
): T[] {
    const out: T[] = [];
    timesBounded(n, limit, action, (i) => out.push(f(i)), log, label);
    return out;
}

export function sliceBound<T>(arr: readonly T[], limit: number, action: LimitAction, log?: Logger, label = "sliceBound"): T[] {
    const k = enforceBound(label, arr.length, limit, action, log);
    return arr.slice(0, k);
}

//@tentative
export function forEachBounded<T>(
    arr: readonly T[],
    limit: number,
    action: LimitAction,
    each: (item: T, i: number) => void,
    log?: Logger,
    label: string = "forEachBounded"
): number {
    const k = enforceBound(label, arr.length, limit, action, log);
    for (let i = 0; i < k; i++) each(arr[i], i);
    return k;
}