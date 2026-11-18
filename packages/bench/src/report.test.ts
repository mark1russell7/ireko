import type { PairedTime } from "@mark1russell7/rigor-bench";
import { describe, expect, it } from "vitest";
import { type HashLine, hashLines, markdown, MINIMUM_CASES, report } from "./report.ts";

const ROUNDS = 7;

/** The records of one pair: `cases` cases, each with 7 rounds. The ratio b / a of a record is near `ratio`. */
function pair(cases: number, ratio: number, base = 100): PairedTime[] {
  const records: PairedTime[] = [];
  for (let c = 0; c < cases; c++) {
    for (let round = 0; round < ROUNDS; round++) {
      // A small change of each record, with no random value.
      const a = base * (c + 1) * (1 + 0.004 * (((c * 3 + round * 5) % 7) - 3));
      const b = a * ratio * (1 + 0.004 * (((c * 5 + round * 3) % 7) - 3));
      records.push({ case: `picture-${String(c)}`, round, first: (round + c) % 2 === 0 ? "a" : "b", a, b });
    }
  }
  return records;
}

const line = (arm: string, id: string, hash: string): HashLine => ({ arm, case: id, hash });

describe("report", () => {
  it("gives the medians of each case: the times of the arms and the ratios to the base", () => {
    const head: PairedTime[] = [
      { case: "one", round: 0, first: "a", a: 100, b: 50 },
      { case: "one", round: 1, first: "b", a: 120, b: 90 },
      { case: "one", round: 2, first: "a", a: 110, b: 44 },
      { case: "two", round: 0, first: "b", a: 10, b: 10 },
    ];
    const theta: PairedTime[] = [
      { case: "one", round: 0, first: "a", a: 100, b: 10 },
      { case: "one", round: 1, first: "b", a: 100, b: 30 },
      { case: "one", round: 2, first: "a", a: 100, b: 20 },
    ];
    const result = report({ head, theta, "base~aa": [] }, []);
    expect(result.cases).toEqual([
      { case: "one", rounds: 3, baseMs: 110, headMs: 50, headRatio: 0.5, thetaMs: 20, thetaRatio: 0.2, sameResult: undefined },
      { case: "two", rounds: 1, baseMs: 10, headMs: 10, headRatio: 1, thetaMs: undefined, thetaRatio: undefined, sameResult: undefined },
    ]);
  });

  it("reads the hashes: the same result, another result, and no read", () => {
    const head = pair(4, 1);
    const hashes = [
      // The same hash in each arm.
      line("base", "picture-0", "aa"), line("base", "picture-0", "aa"), line("head", "picture-0", "aa"),
      // Another hash in the arm head.
      line("base", "picture-1", "aa"), line("head", "picture-1", "bb"),
      // Two hashes in one arm.
      line("base", "picture-2", "aa"), line("head", "picture-2", "aa"), line("head", "picture-2", "cc"),
      // No hash of the arm base. The hash of the arm theta is not a part of the claim.
      line("head", "picture-3", "aa"), line("theta", "picture-3", "dd"),
    ];
    expect(report({ head }, hashes).cases.map((row) => row.sameResult)).toEqual([true, false, false, undefined]);
  });

  it("gives no read for fewer cases than the A/A band needs", () => {
    const few = MINIMUM_CASES - 1;
    const result = report({ head: pair(6, 0.5), theta: pair(few, 0.2), "base~aa": pair(6, 1) }, []);
    expect(result.head.outcome).not.toBe("no read");
    expect(result.theta).toEqual({ outcome: "no read", reason: `The A/A band needs 5 cases or more, and the bench has ${String(few)}.` });
    // No A/A pair gives no read for each pair.
    const none = report({ head: pair(6, 0.5), theta: pair(6, 0.2) }, []);
    expect([none.head.outcome, none.theta.outcome]).toEqual(["no read", "no read"]);
    expect(none.head.reason).toMatch(/has 0\.$/);
    // No records give no rows.
    expect(report({}, []).cases).toEqual([]);
  });

  it("gives the time verdict of each pair against the A/A pair", () => {
    const result = report({ head: pair(6, 0.7), theta: pair(6, 1.6), "base~aa": pair(6, 1) }, []);
    expect(result.head.outcome).toBe("faster");
    expect(result.theta.outcome).toBe("slower");
    expect(result.head.reason.length).toBeGreaterThan(0);
    expect(report({ head: pair(6, 1), theta: pair(6, 1), "base~aa": pair(6, 1) }, []).head.outcome).toBe("same");
  });
});

describe("hashLines", () => {
  it("reads one hash line for each line of the text, and ignores an empty line", () => {
    const text = '{"arm":"base","case":"picture-50","hash":"aa"}\n\n{"arm":"head","case":"picture-50","hash":"aa","more":1}\n';
    expect(hashLines(text)).toEqual([line("base", "picture-50", "aa"), line("head", "picture-50", "aa")]);
    expect(hashLines("")).toEqual([]);
  });

  it("refuses a line of another form", () => {
    expect(() => hashLines('{"arm":"base","case":"picture-50"}')).toThrow(TypeError);
    expect(() => hashLines('{"arm":"base","case":7,"hash":"aa"}')).toThrow(/not a hash line/);
    expect(() => hashLines("null")).toThrow(TypeError);
    expect(() => hashLines("not JSON")).toThrow(SyntaxError);
  });
});

describe("markdown", () => {
  it("gives a table with a row for each case, and a line for each verdict", () => {
    const hashes = [line("base", "picture-0", "aa"), line("head", "picture-0", "aa"), line("base", "picture-1", "aa"), line("head", "picture-1", "bb")];
    const text = markdown(report({ head: pair(3, 0.5), theta: pair(2, 0.25), "base~aa": pair(3, 1) }, hashes), 0.9);
    const rows = text.split("\n").filter((row) => row.startsWith("| picture-"));
    expect(text).toContain("## The bench of relaxForces");
    expect(text).toContain("| Case | Rounds | base (ireko 0.2.4) ms | head ms | head / base | theta 0.9 ms | theta 0.9 / base | Same result as 0.2.4 |");
    expect(rows.length).toBe(3);
    expect(rows[0]).toMatch(/^\| picture-0 \| 7 \| 100\.0 \| 50\.\d \| 0\.50\d \| 25\.\d \| 0\.25\d \| yes \|$/);
    expect(rows[1]).toMatch(/\| NO \|$/);
    // The third case has no record of the arm theta and no hash.
    expect(rows[2]).toMatch(/\| no read \| no read \| no read \|$/);
    expect(text).toContain("- Time (head against base, with the A/A pair): **no read**. The A/A band needs 5 cases or more, and the bench has 3.");
    expect(text).toContain("- Time (theta 0.9 against base, with the A/A pair): **no read**.");
  });

  it("shows a time that is not a finite number as it is", () => {
    const text = markdown({ cases: [{ case: "one", rounds: 1, baseMs: Number.NaN, headMs: Infinity, headRatio: 1, thetaMs: 2, thetaRatio: 0.5, sameResult: true }], head: { outcome: "same", reason: "A." }, theta: { outcome: "faster", reason: "B." } }, 0.5);
    expect(text).toContain("| one | 1 | NaN | Infinity | 1.000 | 2.0 | 0.500 | yes |");
    expect(text).toContain("- Time (theta 0.5 against base, with the A/A pair): **faster**. B.");
  });
});
