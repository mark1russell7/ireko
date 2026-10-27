#!/usr/bin/env node
// This script writes src/core/engine/shape.generated.js: the shape of one linked node, as a standalone module of the
// Vex compiler (@mark1russell7/vex-compiler, emitModule). Start it with `pnpm --filter ireko vex:shapes`.
//
// The program and the band domain are copies of the Vex shapes pilot (mark1russell7/vex, packages/pilots/src,
// ireko-shapes.ts NODE_SHAPE and NODE_SCHEMA, and ireko-band.ts, at commit 1403f2b). Vex and ireko have the MIT
// license and the same author.
//
// The records of the program are the children of the node. Each child has its offset (`ox`, `oy`) and its shape as two
// lists of bands (`rows`, `cols`). The variables are the box of the node (`w`, `h`) and the limit of the bands. The
// value at each record is the shape of the node: a list of two lists of bands. The module copies the band ops, so it
// imports nothing.

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { app, axes, call, defineDomain, each, fn, fold, iterate, let_, lit, ref, v, vexList } from "@mark1russell7/vex";
import { emitModule } from "@mark1russell7/vex-compiler";
import { BoolDomain, NumDomain } from "@mark1russell7/vex-domains";

// The band domain (ireko-band.ts of the pilot). Each op is a function of plain data that reads no name outside itself.
const BandDomain = defineDomain({
  name: "Band",
  is: (u) =>
    typeof u === "object" &&
    u !== null &&
    [Object.prototype, null].includes(Object.getPrototypeOf(u)) &&
    Object.keys(u).length === 4 &&
    typeof u.from === "number" &&
    typeof u.to === "number" &&
    typeof u.min === "number" &&
    typeof u.max === "number",
  valid: (b) => Number.isFinite(b.from) && Number.isFinite(b.to) && Number.isFinite(b.min) && Number.isFinite(b.max),
  show: (b) => `[${b.from}, ${b.to}] at [${b.min}, ${b.max}]`,
  samples: () => [
    { from: 0, to: 0, min: 0, max: 0 },
    { from: 0, to: 40, min: 0, max: 120 },
    { from: -2.5, to: 3, min: -7, max: -1 },
    { from: 10, to: 30, min: 5, max: 5 },
  ],
  ops: {
    from: { fn: (a) => a.from, params: [], returns: "number" },
    to: { fn: (a) => a.to, params: [], returns: "number" },
    min: { fn: (a) => a.min, params: [], returns: "number" },
    max: { fn: (a) => a.max, params: [], returns: "number" },
    move: { fn: (a, along, across) => ({ from: a.from + along, to: a.to + along, min: a.min + across, max: a.max + across }), params: ["number", "number"], returns: "domain" },
    flip: { fn: (a) => ({ from: a.from, to: a.to, min: -a.max, max: -a.min }), params: [], returns: "domain" },
    join: {
      fn: (a, b) => ({ from: Math.min(a.from, b.from), to: Math.max(a.to, b.to), min: Math.min(a.min, b.min), max: Math.max(a.max, b.max) }),
      laws: ["commutative", "associative", "idempotent"],
      params: ["domain"],
      returns: "domain",
    },
    overlaps: { fn: (a, b) => a.from < b.to && b.from < a.to, laws: ["commutative"], params: ["domain"], returns: "boolean" },
  },
});

// The numbers of the pilot: only the op `band(from, to, min, max)`, which makes a band.
const BandNumDomain = defineDomain({
  name: "BandNum",
  is: (u) => typeof u === "number",
  primitive: "number",
  ops: {
    band: { fn: (from, to, min, max) => ({ from, to, min, max }), params: ["number", "number", "number"], returns: "domain:Band" },
  },
});

// NumDomain and BoolDomain come before BandDomain, so each op site of a number, a boolean or a band is static.
const DOMAINS = [NumDomain, BoolDomain, BandNumDomain, BandDomain];

// The program NODE_SHAPE of ireko-shapes.ts.
const op = (name, ...args) => app(name, ...args);
const EMPTY = lit(vexList([]));
const next = (i) => op("add", v(i), lit(1));
const ZERO = op("band", lit(0), lit(0), lit(0), lit(0));
// The list of one value: fill(1, x). Its key is "0", not the key of a record.
const single = (x) => op("fill", lit(1), x);
// An empty list whose items have the kind of x.
const none = (x) => op("fill", lit(0), x);
const NO_BANDS = none(ZERO);
const NO_NUMBERS = none(lit(0));

// A loop over the items of the list in the name `list`, in order. The name `i` is the position of the item.
const over = (list, init, step, result) => fold(axes.list(v(list)), { i: lit(0), ...init }, { i: next("i"), ...step(op("nth", v(list), v("i"))) }, result);

// The test of mergeBands: a band with a size on each axis.
const valid = (b) => op("and", op("gt", op("to", b), op("from", b)), op("gte", op("max", b), op("min", b)));

// The list `list` with each band moved: `along` on the axis of the list, and `across` on the other axis.
const moved = (list, along, across) => over(list, { acc: NO_BANDS }, (b) => ({ acc: op("append", v("acc"), single(op("move", b, along, across))) }), v("acc"));

// The cut points of the bands in the name `bands`: the two ends of each valid band, from the smallest, each value once.
const cuts = let_(
  {
    ends: over(
      "bands",
      { acc: NO_NUMBERS },
      (b) => ({ acc: let_({ b }, op("if", valid(v("b")), op("append", op("append", v("acc"), single(op("from", v("b")))), single(op("to", v("b")))), v("acc"))) }),
      v("acc"),
    ),
  },
  let_(
    { sorted: op("sortBy", v("ends")) },
    over(
      "sorted",
      { acc: NO_NUMBERS },
      (x) => ({ acc: op("if", op("or", op("eq", v("i"), lit(0)), op("not", op("eq", x, op("nth", v("sorted"), op("subtract", v("i"), lit(1)))))), op("append", v("acc"), single(x)), v("acc")) }),
      v("acc"),
    ),
  ),
);

// The band of the cut at the position `i`: from the cut to the next cut, across the active bands.
const segment = let_(
  { from: op("nth", v("cuts"), v("i")), to: op("nth", v("cuts"), next("i")) },
  fold(
    axes.list(v("starts")),
    { j: lit(0), any: lit(false), lo: lit(0), hi: lit(0) },
    (() => {
      const b = op("nth", v("starts"), v("j"));
      const active = op("and", valid(b), op("and", op("lte", op("from", b), v("from")), op("gt", op("to", b), v("from"))));
      return {
        j: next("j"),
        any: op("or", v("any"), active),
        lo: op("if", op("and", active, op("or", op("not", v("any")), op("lt", op("min", b), v("lo")))), op("min", b), v("lo")),
        hi: op("if", op("and", active, op("or", op("not", v("any")), op("gt", op("max", b), v("hi")))), op("max", b), v("hi")),
      };
    })(),
    op("if", v("any"), single(op("band", v("from"), v("to"), v("lo"), v("hi"))), EMPTY),
  ),
);

// The bands of each segment with an active band, in the order of the cuts.
const segments = over("cuts", { acc: NO_BANDS }, () => ({ acc: op("if", op("lt", next("i"), op("count", v("cuts"))), op("append", v("acc"), segment), v("acc")) }), v("acc"));

// The segments with neighbor bands of the same interval joined. The name `p` holds the last band.
const joined = over(
  "segments",
  { has: lit(false), p: ZERO, acc: NO_BANDS },
  (s) => {
    const same = op("and", v("has"), op("and", op("eq", op("to", v("p")), op("from", s)), op("and", op("eq", op("min", v("p")), op("min", s)), op("eq", op("max", v("p")), op("max", s)))));
    return {
      has: lit(true),
      p: op("if", same, op("band", op("from", v("p")), op("to", s), op("min", v("p")), op("max", v("p"))), s),
      acc: op("if", op("and", v("has"), op("not", same)), op("append", v("acc"), single(v("p"))), v("acc")),
    };
  },
  op("if", v("has"), op("append", v("acc"), single(v("p"))), v("acc")),
);

// One step of coarsen: each pair of neighbor bands becomes one band that covers both.
const pairs = over(
  "out",
  { odd: lit(false), a: ZERO, acc: NO_BANDS },
  (b) => ({ odd: op("not", v("odd")), a: b, acc: op("if", v("odd"), op("append", v("acc"), single(op("join", v("a"), b))), v("acc")) }),
  op("if", v("odd"), op("append", v("acc"), single(v("a"))), v("acc")),
);

// The function `merge`: mergeBands with the limit of the variable `limit`.
const MERGE = fn(
  ["bands"],
  let_(
    { starts: op("sortBy", v("bands"), lit({ by: "from" })), cuts },
    let_({ segments }, let_({ out: joined }, iterate(64, { out: v("out") }, { out: pairs }, v("out"), op("lte", op("count", v("out")), v("limit"))))),
  ),
);

const ROWS = { field: "rows", offset: "oy", cross: "ox", size: "h", crossSize: "w" };
const COLS = { field: "cols", offset: "ox", cross: "oy", size: "w", crossSize: "h" };

// The band of a box of the size `size` along the axis and `cross` across it, at the origin: boxShape.
const box = (size, cross) => op("band", lit(0), size, lit(0), cross);

// The shape of the node on one axis: its box joined with the bands of each child, moved by the offset of the child.
const nodeShapeOf = (a) => {
  const own = single(box(v(a.size), v(a.crossSize)));
  const child = let_({ part: ref(a.field), along: ref(a.offset), across: ref(a.cross) }, moved("part", v("along"), v("across")));
  return call("merge", op("append", own, op("flat", each(axes.all, child))));
};

const NODE_SHAPE = let_({ merge: MERGE }, let_({ rows: nodeShapeOf(ROWS), cols: nodeShapeOf(COLS) }, op("append", single(v("rows")), single(v("cols")))));

// A list of bands. Its keys come from fill, so they are not the keys of records.
const BANDS = { list: "domain:Band", texts: true };
const NODE_SCHEMA = {
  fields: { ox: "number", oy: "number", rows: BANDS, cols: BANDS },
  vars: { w: "number", h: "number", limit: "number" },
};

const m = emitModule(NODE_SHAPE, { domains: DOMAINS, schema: NODE_SCHEMA, name: "nodeShape" });
if (!m.ok) throw new Error(m.reason);
if (m.source.includes("import")) throw new Error("The module imports a name. It must stand alone.");
const out = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src", "core", "engine", "shape.generated.js");
writeFileSync(out, m.source);
process.stdout.write(`wrote ${out} (${String(m.source.length)} characters)\n`);
