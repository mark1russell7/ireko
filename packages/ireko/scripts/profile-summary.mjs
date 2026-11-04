#!/usr/bin/env node
// The summary of the CPU profiles of scripts/profile-shapes.mjs (SHAPEWIRE). It has no dependencies.
//
//   node scripts/profile-summary.mjs [--out summary.json] [--top 25] <label>=<file.cpuprofile> ...
//
// The label "hand" uses the groups of the code of ireko. Each other label (vex, module) uses the groups of the module.
// For each profile it gives:
//   1. the self time of each group (ms and share): each function goes into ONE group (the rules below), so the shares
//      sum to 1;
//   2. the same groups, with the large bodies of the module split by line (a heuristic, see LINE_RULES);
//   3. the top functions by self time, with their group;
//   4. the hot lines of the module (shape.generated.js), with the text of each line.
// It writes Markdown to stdout and to $GITHUB_STEP_SUMMARY, and all the numbers to --out.

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: "string" }, top: { type: "string", default: "25" } } });
const TOP = Number(values.top);
const MODULE_FILE = "shape.generated.js";
const GROUPS = ["wrap", "envelope", "alloc", "dispatch", "bandops", "other"];

// The names of the generated module come from `emitModule` of @mark1russell7/vex-compiler (packages/compiler/src/module.ts):
// the runtime helpers have one or two capital letters, a copied op is `op_<domain>_<index>`, a check of a kind is
// `k_<kind>`, a check of the validity of a domain is `v_<domain>`, a check of the schema of an input is `is_<kind>`, a
// function of the program is `fn<N>`, a column is `col<N>` (in the helper Q) and a constant is `c<N>` (in L or T).
// V8 gives no name to an arrow function in an argument. This script names it from the text of its line:
// `<helper> closure` for an arrow in a helper (`function Q(f) { ... return (j) => ...`), `<binding> body` for
// `const col11 = Q((j0) => ...`. The name `(anonymous)` remains for the others.
//
// Each rule has a group, a test of the file (the base name of the URL), a test of the name, and an optional side. The
// first rule that matches gives the group. A function that matches no rule is in `other`.
const RULES = [
  // ---- The side "hand": the code of ireko (shape.ts, at.ts), the reference. ----
  // bandops: all the code of ireko for the shapes. It holds its own loops and allocations, as one body. The groups of
  // the module do not exist in it, so the reference has only bandops, alloc (the GC) and other.
  { group: "bandops", side: "hand", file: /^(shape|at)\.ts$/ },

  // ---- The side "vex": the wrapper and the module. ----
  // wrap: the wrapper shape-vex.ts. It makes the records and the lists of Vex (listOf), and it reads the result back
  // (valuesOf, at). boxShape of shape.ts is its path for a node without children.
  { group: "wrap", side: "vex", file: /^(shape-vex|shape|at)\.ts$/ },
  // envelope: the boxing and unboxing of values and results, and the checks of kinds and of the schema.
  //   LI reads a vex.list of the input into the array of the module (it also allocates the pairs: the checks are larger).
  //   LO makes the vex.list of the output (its allocation is the boxing itself).
  //   G unboxes a value or throws, F throws the sentinel, T and C catch or throw, VW and CT count the items with values.
  //   k_* checks a kind, v_* the validity of a domain value, is_* the schema of an input value.
  { group: "envelope", file: /^shape\.generated\.js$/, name: /^(LI|LO|G|F|T|C|VW|CT)( closure)?$/ },
  { group: "envelope", file: /^shape\.generated\.js$/, name: /^(k|v|is)_\w+$/ },
  // alloc: the helpers that copy or make lists. AP concatenates two copies, AO appends to the own list (or copies), FI
  // makes n pairs, FL flattens into a new array. V filters out the error items: it is mainly a copy of the list (its
  // check is one compare for each item), so it is here, not in envelope.
  { group: "alloc", file: /^shape\.generated\.js$/, name: /^(AP|AO|FI|FL|V)( closure)?$/ },
  // dispatch: the loop machinery. Q is the memo of a column, L a lazy constant, SK the sort by a key (it applies the
  // key op, then sorts). nodeShape and fn<N> are the bodies of the program: the loops of each and fold, with the
  // envelope checks and the pushes of pairs inline. Dispatch is the largest part of them, so they are here (the second
  // table splits them by line). col<N> and c<N> are the bodies of the columns and constants (loops, and a push of a pair
  // for each item).
  { group: "dispatch", file: /^shape\.generated\.js$/, name: /^(Q|L|SK)( closure)?$/ },
  { group: "dispatch", file: /^shape\.generated\.js$/, name: /^(nodeShape|fn\d+|(col|c)\d+ body|\(anonymous\))$/ },
  // bandops: the ops of the band domain, copied into the module (sized, end, side, widen, cut, move, join, ...).
  { group: "bandops", file: /^shape\.generated\.js$/, name: /^op_\w+$/ },

  // ---- Both sides. ----
  // alloc: the garbage collector. The allocation of the other functions is in their self time.
  { group: "alloc", name: /^\(garbage collector\)$/ },
  // other: the rest, also (program), (idle), (root), the loop of profile-shapes.mjs and the builtins of V8.
];

// The split by line of the bodies of the module in `dispatch` (the second table). The text of each line gives its group.
// The first rule that matches wins, and a line that matches none stays in dispatch. It is a heuristic: a line can mix
// parts, and the JIT moves code. Calls that the JIT does not inline are in their own functions, not in these lines.
const LINE_RULES = [
  // alloc: a new array, or the push of a pair [key, value] for each item.
  { group: "alloc", text: /\.push\(\[|=\s*\[\];/ },
  // envelope: a check of the sentinel, an unboxing (G), a check of a kind (k_*), a try or a catch, a check of the schema
  // of the input (typeof, C).
  { group: "envelope", text: /=== E\)|\bG\(|\bk_\w+\(|\btry\b|\bcatch\b|\btypeof\b|\bC\(/ },
  // bandops: a line that calls an op of the domain, and no helper of the rules above.
  { group: "bandops", text: /\bop_\d+_\d+\(/ },
  // alloc: a line that calls a list helper, inline.
  { group: "alloc", text: /\b(AP|AO|FI|FL)\(/ },
];

const sources = new Map();
/** This function gives the lines of the source of a URL, or undefined. */
function sourceLines(url) {
  if (!sources.has(url)) {
    let lines;
    try {
      lines = readFileSync(url.startsWith("file:") ? fileURLToPath(url) : url, "utf8").split("\n");
    } catch {
      lines = undefined;
    }
    sources.set(url, lines);
  }
  return sources.get(url);
}

/** This function gives the name of a function of the profile. An arrow without a name gets a name from its line. */
function nameOf(frame) {
  if (frame.functionName !== "") return frame.functionName;
  if (frame.url === "") return "(anonymous)";
  const text = sourceLines(frame.url)?.[frame.lineNumber] ?? "";
  const helper = /^\s*function (\w+)/.exec(text);
  if (helper) return `${helper[1]} closure`;
  const binding = /(?:const|let)\s+(\w+)\s*=\s*\w+\(\s*\(/.exec(text);
  if (binding) return `${binding[1]} body`;
  return "(anonymous)";
}

const fileOf = (url) => (url === "" ? "" : basename(url.startsWith("file:") ? fileURLToPath(url) : url));

function groupOf(side, file, name) {
  for (const r of RULES) {
    if (r.side !== undefined && r.side !== side) continue;
    if (r.file !== undefined && !r.file.test(file)) continue;
    if (r.name !== undefined && !r.name.test(name)) continue;
    return r.group;
  }
  return "other";
}

/**
 * This function gives, for each line of the module, the function of the source that holds it: a top-level declaration
 * (`function AP`, `const op_3_1 = ...`), or in `nodeShape` a function of the program (`fn103`), a column or a constant
 * (`col11 body`, `c104 body`) or `nodeShape` itself. V8 counts an inlined function in the self time of its caller, but
 * the ticks of its lines keep the lines of its source. Thus the line gives the function where the time is.
 */
function regionsOf(lines) {
  const out = [];
  let top = "(anonymous)";
  let inner;
  for (const text of lines) {
    const decl = /^(?:export )?(?:function (\w+)|const (\w+) =|class (\w+))/.exec(text);
    if (decl) {
      top = decl[1] ?? decl[2] ?? decl[3];
      inner = undefined;
    } else if (top === "nodeShape") {
      const helper = /^  (?:const|let) (\w+) = (?:Q|L|T)\(/.exec(text);
      const fn = /^  const (fn\d+) = /.exec(text);
      if (helper) inner = `${helper[1]} body`;
      else if (fn) inner = fn[1];
      else if (/^  [^ }]/.test(text)) inner = undefined;
    }
    out.push(inner ?? top);
  }
  return out;
}

const ms = (us) => us / 1000;

function lineGroupOf(text) {
  for (const r of LINE_RULES) if (r.text.test(text)) return r.group;
  return "dispatch";
}

function summarize(label, path) {
  const profile = JSON.parse(readFileSync(path, "utf8"));
  const side = label === "hand" ? "hand" : "vex";
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  // The time of each sample is the time to the next sample (the last one: to the end of the profile).
  const selfUs = new Map();
  let t = profile.startTime;
  const stamps = profile.timeDeltas.map((d) => (t += d));
  for (let i = 0; i < profile.samples.length; i++) {
    const next = i + 1 < stamps.length ? stamps[i + 1] : profile.endTime;
    const dt = Math.max(0, next - stamps[i]);
    selfUs.set(profile.samples[i], (selfUs.get(profile.samples[i]) ?? 0) + dt);
  }
  const totalUs = [...selfUs.values()].reduce((a, b) => a + b, 0);

  const fns = new Map();
  const groups = Object.fromEntries(GROUPS.map((g) => [g, 0]));
  const lineGroups = Object.fromEntries(GROUPS.map((g) => [g, 0]));
  const lines = new Map();
  const regions = new Map();
  for (const [id, us] of selfUs) {
    const node = byId.get(id);
    const frame = node.callFrame;
    const name = nameOf(frame);
    const file = fileOf(frame.url);
    const group = groupOf(side, file, name);
    const key = `${name} ${file}:${String(frame.lineNumber + 1)}`;
    const f = fns.get(key) ?? { name, file, line: frame.lineNumber + 1, group, us: 0 };
    f.us += us;
    fns.set(key, f);
    groups[group] += us;
    // The ticks of each line of the node: the self time of the node in the share of the ticks of the line.
    const ticks = node.positionTicks ?? [];
    const sum = ticks.reduce((s, p) => s + p.ticks, 0);
    const text = file === MODULE_FILE ? sourceLines(frame.url) : undefined;
    if (sum === 0 || text === undefined) {
      lineGroups[group] += us;
      continue;
    }
    if (!regions.has(frame.url)) regions.set(frame.url, regionsOf(text));
    const region = regions.get(frame.url);
    for (const p of ticks) {
      const share = (us * p.ticks) / sum;
      const lineText = text[p.line - 1]?.trim() ?? "";
      const lk = String(p.line);
      let l = lines.get(lk);
      if (l === undefined) {
        // The group of the line: the group of the function of the source that holds it. A line of a body in dispatch
        // gets its group from its text.
        const inFn = region[p.line - 1] ?? name;
        const g = groupOf(side, file, inFn);
        l = { line: p.line, text: lineText, in: inFn, group: g === "dispatch" ? lineGroupOf(lineText) : g, us: 0, profiled: new Set() };
        lines.set(lk, l);
      }
      l.us += share;
      l.profiled.add(name);
      lineGroups[l.group] += share;
    }
  }
  const rows = (o) => GROUPS.map((g) => ({ group: g, ms: ms(o[g]), share: totalUs === 0 ? 0 : o[g] / totalUs }));
  const top = [...fns.values()].toSorted((a, b) => b.us - a.us);
  const hot = [...lines.values()].toSorted((a, b) => b.us - a.us);
  return {
    label,
    file: basename(path),
    side,
    totalMs: ms(totalUs),
    samples: profile.samples.length,
    groups: rows(groups),
    groupsByLine: rows(lineGroups),
    top: top.slice(0, TOP).map((f) => ({ name: f.name, file: f.file, line: f.line, group: f.group, ms: ms(f.us), share: f.us / totalUs })),
    functions: top.map((f) => ({ name: f.name, file: f.file, line: f.line, group: f.group, ms: ms(f.us), share: f.us / totalUs })),
    hotLines: hot.slice(0, TOP).map((l) => ({ line: l.line, text: l.text, in: l.in, group: l.group, profiledIn: [...l.profiled], ms: ms(l.us), share: l.us / totalUs })),
  };
}

if (positionals.length === 0) throw new Error("profile-summary: give <label>=<file.cpuprofile> ...");
const results = positionals.map((arg) => {
  const eq = arg.indexOf("=");
  if (eq <= 0) throw new Error(`profile-summary: "${arg}" is not <label>=<file.cpuprofile>`);
  return summarize(arg.slice(0, eq), arg.slice(eq + 1));
});

const f = (x, d = 1) => x.toFixed(d);
const pct = (x) => `${(100 * x).toFixed(1)} %`;
const code = (s) => `\`${s.replaceAll("`", "'").replaceAll("|", "\\|")}\``;
const out = ["## SHAPEWIRE: the CPU profile of the shapes pass (full tree of 1111 nodes)", ""];
out.push("Self time of each group. Each function is in one group, so the shares sum to 1. The rules are in `scripts/profile-summary.mjs`.", "");
out.push(`| Group | ${results.map((r) => `${r.label} ms | ${r.label} share`).join(" | ")} |`);
out.push(`|---|${results.map(() => "---:|---:").join("|")}|`);
for (const g of GROUPS) out.push(`| ${g} | ${results.map((r) => { const x = r.groups.find((y) => y.group === g); return `${f(x.ms)} | ${pct(x.share)}`; }).join(" | ")} |`);
out.push(`| total | ${results.map((r) => `${f(r.totalMs)} | ${String(r.samples)} samples`).join(" | ")} |`, "");
const withLines = results.filter((r) => r.side === "vex");
if (withLines.length > 0) {
  out.push(
    "The same groups by the line of the source. V8 counts an inlined function in the self time of its caller, so the table above can put the time of `V` or `op_*` into `fn103`. Here each line of the module goes to the function of the source that holds it, and the lines of the bodies in `dispatch` (`nodeShape`, `fn<N>`, the column bodies) get a group from their text (a heuristic).",
    "",
  );
  out.push(`| Group | ${withLines.map((r) => `${r.label} ms | ${r.label} share`).join(" | ")} |`);
  out.push(`|---|${withLines.map(() => "---:|---:").join("|")}|`);
  for (const g of GROUPS) out.push(`| ${g} | ${withLines.map((r) => { const x = r.groupsByLine.find((y) => y.group === g); return `${f(x.ms)} | ${pct(x.share)}`; }).join(" | ")} |`);
  out.push("");
}
for (const r of results) {
  out.push(`### ${r.label}: the top ${String(TOP)} functions by self time (${f(r.totalMs)} ms in all)`, "");
  out.push("| # | Function | Where | Group | Self ms | Share |", "|---:|---|---|---|---:|---:|");
  r.top.forEach((x, i) => out.push(`| ${String(i + 1)} | ${code(x.name)} | ${x.file === "" ? "-" : `${x.file}:${String(x.line)}`} | ${x.group} | ${f(x.ms)} | ${pct(x.share)} |`));
  out.push("");
  if (r.hotLines.length > 0) {
    out.push(`### ${r.label}: the hot lines of \`${MODULE_FILE}\``, "");
    out.push("| Line | Text | In | Self time of (V8) | Group | Self ms | Share |", "|---:|---|---|---|---|---:|---:|");
    for (const l of r.hotLines) out.push(`| ${String(l.line)} | ${code(l.text.length > 90 ? `${l.text.slice(0, 87)}...` : l.text)} | ${code(l.in)} | ${l.profiledIn.join(", ")} | ${l.group} | ${f(l.ms)} | ${pct(l.share)} |`);
    out.push("");
  }
}
const text = out.join("\n");
process.stdout.write(`${text}\n`);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
if (values.out !== undefined) writeFileSync(values.out, `${JSON.stringify({ node: process.version, profiles: results }, null, 2)}\n`);
