#!/usr/bin/env node
// This script writes src/core/engine/shape.generated.js: the shape of one linked node, as a standalone module of the
// Vex compiler (@mark1russell7/vex-compiler, emitModule). Start it with `pnpm --filter ireko vex:shapes`.
//
// The program and the band domain are copies of the Vex shapes pilot (mark1russell7/vex, packages/pilots/src,
// ireko-shapes.ts NODE_SHAPE and NODE_SCHEMA, and ireko-band.ts, at commit 0ea8fa6). Vex and ireko have the MIT
// license and the same author.
//
// The records of the program are the children of the node. Each child has its offset (`ox`, `oy`) and its shape as two
// lists of bands (`rows`, `cols`). The variables are the box of the node (`w`, `h`) and the limit of the bands. The
// value at each record is the shape of the node: a list of two lists of bands. The module copies the band ops, so it
// imports nothing. The merge is one sweep over the sorted ends of the bands, so it costs O(n log n) for n bands.

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { app, axes, call, defineDomain, each, fn, fold, iterate, let_, lit, ref, v } from "@mark1russell7/vex";
import { emitModule } from "@mark1russell7/vex-compiler";
import { BoolDomain, NumDomain } from "@mark1russell7/vex-domains";

// The band domain (ireko-band.ts of the pilot). Each op is a function of plain data that reads no name outside itself.
// A field can be Infinity: ireko keeps an infinite end on a band that overflows. Only NaN makes a band that is not
// valid. The ops after `overlaps` are the steps of the sweep. They compare the ends inside the op, so the program gets
// no infinite end as a number.
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
  valid: (b) => !Number.isNaN(b.from) && !Number.isNaN(b.to) && !Number.isNaN(b.min) && !Number.isNaN(b.max),
  show: (b) => `[${b.from}, ${b.to}] at [${b.min}, ${b.max}]`,
  samples: () => [
    { from: 0, to: 0, min: 0, max: 0 },
    { from: 0, to: 40, min: 0, max: 120 },
    { from: -2.5, to: 3, min: -7, max: -1 },
    { from: 10, to: 30, min: 5, max: 5 },
    { from: Number.NEGATIVE_INFINITY, to: Number.POSITIVE_INFINITY, min: -3, max: Number.POSITIVE_INFINITY },
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
    sized: { fn: (a) => a.to > a.from && a.max >= a.min, params: [], returns: "boolean" },
    end: { fn: (a) => ({ from: a.to, to: a.to, min: 0, max: 0 }), params: [], returns: "domain" },
    side: { fn: (a) => (a.from === Number.NEGATIVE_INFINITY ? -1 : a.from === Number.POSITIVE_INFINITY ? 1 : 0), params: [], returns: "number" },
    aligned: { fn: (a, b) => a.from === b.from, laws: ["commutative"], params: ["domain"], returns: "boolean" },
    outlasts: { fn: (a, b) => a.to > b.from, params: ["domain"], returns: "boolean" },
    widen: { fn: (a, b) => ({ from: a.from, to: a.to, min: b.min < a.min ? b.min : a.min, max: b.max > a.max ? b.max : a.max }), params: ["domain"], returns: "domain" },
    cut: { fn: (c, a, b) => ({ from: a.from, to: b.from, min: c.min, max: c.max }), params: ["domain", "domain"], returns: "domain" },
    continues: { fn: (a, b) => a.to === b.from && a.min === b.min && a.max === b.max, params: ["domain"], returns: "boolean" },
    extend: { fn: (a, b) => ({ from: a.from, to: b.to, min: a.min, max: a.max }), params: ["domain"], returns: "domain" },
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
const ZERO = op("band", lit(0), lit(0), lit(0), lit(0));
// The list of one value: fill(1, x). Its key is "0", not the key of a record.
const single = (x) => op("fill", lit(1), x);
// An empty list whose items have the kind of x. A filter gives it for an item that it does not keep.
const none = (x) => op("fill", lit(0), x);
const NO_BANDS = none(ZERO);

// A map over the items of the list `list`, in order. The names of `as` hold the item and its position.
const loop = (list, as, body) => each(axes.list(list), body, undefined, as);
// A filter: its body gives a list of one item or an empty list, and flat joins these lists.
const keep = (list, as, body) => op("flat", loop(list, as, body));
// A fold over the items of the list `list`, in order. Its steps read the item through the names of `as`.
const over = (list, as, init, step, result) => fold(axes.list(list), init, step, result, undefined, as);

// The test of mergeBands: a band with a size on each axis. The op `sized` compares the ends inside the band.
const valid = (b) => op("sized", b);

// The list `list` with each band moved: `along` on the axis of the list, and `across` on the other axis.
const moved = (list, along, across) => loop(v(list), ["b"], op("move", v("b"), along, across));

// The events of the sweep, before the sort. Each valid band gives its start event (the band itself) and its end event
// end(b), a band from `to` to `to`. An end event has no size, so the op `sized` tells the two kinds apart.
const UNSORTED = keep(v("bands"), ["b"], op("if", valid(v("b")), op("append", single(v("b")), single(op("end", v("b")))), NO_BANDS));

// The events in the name `raw` on one side: -1 at -Infinity, 0 at a finite position and 1 at Infinity.
const onSide = (side) => keep(v("raw"), ["e"], op("if", op("eq", op("side", v("e")), lit(side)), single(v("e")), NO_BANDS));

// The events in the order of their positions. An infinite key of sortBy is an error, so only the events at a finite
// position go through sortBy. The events at -Infinity come before them, and the events at Infinity come after them.
const events = let_({ raw: UNSORTED }, op("append", op("append", onSide(-1), op("sortBy", onSide(0), lit({ by: "from" }))), onSide(1)));

// The band from the start of the event `x` to the start of the event `to`, across the open bands. The name `c` holds
// the lowest `min` and the highest `max` of the open bands.
const span = (to) =>
  over(v("open"), ["b"], { any: lit(false), c: ZERO }, { any: lit(true), c: op("if", v("any"), op("widen", v("c"), v("b")), v("b")) }, op("cut", v("c"), v("x"), to));

// The join of the segment `seg` into the bands of the sweep, when `emit` is true. The name `pend` holds the last band,
// and `held` tells if it exists. A segment that continues the last band with the same interval extends it.
const absorb = () => {
  const seg = v("seg");
  const pend = v("pend");
  const same = op("and", v("held"), op("continues", pend, seg));
  return {
    held: op("or", v("held"), v("emit")),
    pend: op("if", v("emit"), op("if", same, op("extend", pend, seg), seg), pend),
    out: op("if", op("and", v("emit"), op("and", v("held"), op("not", same))), op("append", v("out"), single(pend)), v("out")),
  };
};

// The merged bands of the name `bands`, before the limit: one fold over the sorted events, as the sweep of ireko. The
// name `x` holds the first event at the current cut, and `open` holds the open bands in the order of ireko.
const sweep = over(
  v("events"),
  ["e"],
  { has: lit(false), x: ZERO, open: NO_BANDS, emit: lit(false), seg: ZERO, held: lit(false), pend: ZERO, out: NO_BANDS },
  (() => {
    const e = v("e");
    const moves = op("and", v("has"), op("not", op("aligned", e, v("x"))));
    const still = keep(v("open"), ["b"], op("if", op("outlasts", v("b"), e), single(v("b")), NO_BANDS));
    return {
      has: lit(true),
      x: op("if", op("and", v("has"), op("not", moves)), v("x"), e),
      // A start event is a valid band, so it has a size. An end event has no size.
      open: let_({ base: op("if", moves, still, v("open")) }, op("if", valid(e), op("append", v("base"), single(e)), v("base"))),
      emit: op("and", moves, op("gt", op("count", v("open")), lit(0))),
      seg: op("if", op("and", moves, op("gt", op("count", v("open")), lit(0))), span(e), ZERO),
      ...absorb(),
    };
  })(),
  (() => {
    const last = absorb();
    return let_({ held2: last.held, pend2: last.pend, out2: last.out }, op("if", v("held2"), op("append", v("out2"), single(v("pend2"))), v("out2")));
  })(),
);

// One step of coarsen: each pair of neighbor bands becomes one band that covers both. The name `a` holds the first band
// of a pair.
const pairs = over(
  v("out"),
  ["b"],
  { odd: lit(false), a: ZERO, acc: NO_BANDS },
  { odd: op("not", v("odd")), a: v("b"), acc: op("if", v("odd"), op("append", v("acc"), single(op("join", v("a"), v("b")))), v("acc")) },
  op("if", v("odd"), op("append", v("acc"), single(v("a"))), v("acc")),
);

// The function `merge`: mergeBands with the limit of the variable `limit`. Each step of coarsen halves the bands.
const MERGE = fn(["bands"], let_({ events }, let_({ out: sweep }, iterate(64, { out: v("out") }, { out: pairs }, v("out"), op("lte", op("count", v("out")), v("limit"))))));

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
