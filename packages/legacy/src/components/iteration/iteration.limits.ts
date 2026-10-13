// iteration/limits.ts
// Hard bounds + policy everywhere (depth, nodes, children, edges, ops)

/** Simple guardable loop if you need it somewhere ad-hoc. */
export function boundedLoop(limit: number, body: (i: number) => boolean): void {
  let i = 0;
  for (; i < limit && body(i); i++);
  if (i >= limit) throw new Error(`boundedLoop: limit ${limit} reached`);
}
