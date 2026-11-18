/**
 * This module makes the report of the bench from its records. The functions have no input or output, so the tests
 * hold them.
 *
 * - The hashes show if the arms `base` and `head` give the same result on each case.
 * - Each time verdict compares one pair with the A/A pair (base, base) over all cases.
 * - A verdict with too few cases is `no read`. A `no read` is not a pass.
 *
 * @packageDocumentation
 */

import { type PairedTime, timeVerdict, type TimeVerdict } from "@mark1russell7/rigor-bench";
import { median } from "@mark1russell7/rigor-statistics";

/** The fewest cases of a time verdict: the A/A band needs them. */
export const MINIMUM_CASES = 5;

/** The records of the bench, by the id of the pair: `head`, `theta` and `base~aa`. */
export type Pairs = Readonly<Record<string, readonly PairedTime[]>>;

/** One line of the hash file of the bench. */
export interface HashLine {
  readonly arm: string;
  readonly case: string;
  readonly hash: string;
}

const isHashLine = (value: unknown): value is HashLine =>
  typeof value === "object" && value !== null && "arm" in value && typeof value.arm === "string" && "case" in value && typeof value.case === "string" && "hash" in value && typeof value.hash === "string";

/** This function reads the text of the hash file: one JSON line for each start of an arm. A line of another form is an error. */
export function hashLines(text: string): HashLine[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line): HashLine => {
      const value: unknown = JSON.parse(line);
      if (!isHashLine(value)) throw new TypeError(`The line is not a hash line: ${line}`);
      return { arm: value.arm, case: value.case, hash: value.hash };
    });
}

/** The row of one case. */
export interface CaseRow {
  readonly case: string;
  readonly rounds: number;
  /** The median time of `base` in the pair (base, head), in milliseconds. */
  readonly baseMs: number;
  readonly headMs: number;
  /** The median of the ratios head / base over the rounds. */
  readonly headRatio: number;
  /** The median time of `theta` in the pair (base, theta), or `undefined` with no record of that pair. */
  readonly thetaMs: number | undefined;
  /** The median of the ratios theta / base over the rounds. */
  readonly thetaRatio: number | undefined;
  /** `true` when each hash of `base` and `head` on the case is the same, `false` when they differ, and `undefined` with no hash. */
  readonly sameResult: boolean | undefined;
}

/** A read of a claim: the outcome of its verdict, or `no read` when the bench has too few cases for the verdict. */
export interface Read {
  readonly outcome: TimeVerdict["outcome"] | "no read";
  readonly reason: string;
}

/** The report of the bench. */
export interface Report {
  readonly cases: readonly CaseRow[];
  /** The time of `head` against `base`. */
  readonly head: Read;
  /** The time of `theta` against `base`. */
  readonly theta: Read;
}

/** This function gives `true`, `false` or `undefined` for the hashes of `base` and `head` on one case. */
function sameResult(hashes: readonly HashLine[], id: string): boolean | undefined {
  const of = (arm: string): Set<string> => new Set(hashes.filter((line) => line.case === id && line.arm === arm).map((line) => line.hash));
  const base = of("base");
  const head = of("head");
  if (base.size === 0 || head.size === 0) return undefined;
  return base.size === 1 && head.size === 1 && [...base][0] === [...head][0];
}

const casesOf = (records: readonly PairedTime[]): number => new Set(records.map((record) => record.case)).size;

/** This function gives the read of one pair against the A/A pair. */
function read(pair: readonly PairedTime[], aa: readonly PairedTime[]): Read {
  const fewest = Math.min(casesOf(pair), casesOf(aa));
  if (fewest < MINIMUM_CASES) return { outcome: "no read", reason: `The A/A band needs ${String(MINIMUM_CASES)} cases or more, and the bench has ${String(fewest)}.` };
  const verdict = timeVerdict(pair, aa);
  return { outcome: verdict.outcome, reason: verdict.reason };
}

/** This function makes the report of the bench. */
export function report(pairs: Pairs, hashes: readonly HashLine[]): Report {
  const head = pairs["head"] ?? [];
  const theta = pairs["theta"] ?? [];
  const aa = pairs["base~aa"] ?? [];
  const ids = [...new Set(head.map((record) => record.case))];
  const cases = ids.map((id): CaseRow => {
    const rows = head.filter((record) => record.case === id);
    const fast = theta.filter((record) => record.case === id);
    return {
      case: id,
      rounds: rows.length,
      baseMs: median(rows.map((record) => record.a)),
      headMs: median(rows.map((record) => record.b)),
      headRatio: median(rows.map((record) => record.b / record.a)),
      thetaMs: fast.length > 0 ? median(fast.map((record) => record.b)) : undefined,
      thetaRatio: fast.length > 0 ? median(fast.map((record) => record.b / record.a)) : undefined,
      sameResult: sameResult(hashes, id),
    };
  });
  return { cases, head: read(head, aa), theta: read(theta, aa) };
}

const fixed = (value: number | undefined, digits: number): string => (value === undefined ? "no read" : Number.isFinite(value) ? value.toFixed(digits) : String(value));

/** This function gives the report as Markdown for the summary of the job. `theta` is the value of the option in the arm `theta`. */
export function markdown(result: Report, theta: number): string {
  const name = `theta ${String(theta)}`;
  const lines = [
    "## The bench of relaxForces",
    "",
    `| Case | Rounds | base (ireko 0.2.4) ms | head ms | head / base | ${name} ms | ${name} / base | Same result as 0.2.4 |`,
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...result.cases.map(
      (row) =>
        `| ${row.case} | ${String(row.rounds)} | ${fixed(row.baseMs, 1)} | ${fixed(row.headMs, 1)} | ${fixed(row.headRatio, 3)} | ${fixed(row.thetaMs, 1)} | ${fixed(row.thetaRatio, 3)} | ${row.sameResult === undefined ? "no read" : row.sameResult ? "yes" : "NO"} |`,
    ),
    "",
    `- Time (head against base, with the A/A pair): **${result.head.outcome}**. ${result.head.reason}`,
    `- Time (${name} against base, with the A/A pair): **${result.theta.outcome}**. ${result.theta.reason}`,
    "",
  ];
  return lines.join("\n");
}
