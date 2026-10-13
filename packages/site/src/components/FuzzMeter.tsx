/**
 * The fuzz meter of the page "Why two passes". The browser of the reader lays out many random trees, and the audit of
 * each layout looks for overlaps and for boxes outside their container. The reader sees the count, not a promise.
 */
import { createEngine, type Layout } from "ireko";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { DOC_OPTIONS } from "../lib/docs.ts";
import { randomTree } from "../playground/fuzz.ts";
import LiveStage from "./LiveStage.tsx";

const engine = createEngine();
const TOTAL = 2000;
const BATCH = 40;
/** The measurement of the first version (docs/REVIEW.md, section 3.2): 1084 of 2000 random trees had overlaps. */
const OLD = { bad: 1084, total: 2000 } as const;

interface Score {
  readonly done: number;
  readonly bad: number;
  readonly boxes: number;
  readonly ms: number;
}

const ZERO: Score = { done: 0, bad: 0, boxes: 0, ms: 0 };

/** The meter. */
export default function FuzzMeter(): ReactElement {
  const [score, setScore] = useState<Score>(ZERO);
  const [running, setRunning] = useState(false);
  // The seed 35 gives a tree of 20 boxes with all strategies and modes: a good first picture.
  const [last, setLast] = useState<Layout>(() => engine.layout({ root: randomTree(35) }, DOC_OPTIONS));
  const [seed, setSeed] = useState(35);
  const timer = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const run = (): void => {
    clearTimeout(timer.current);
    const first = Math.floor(Math.random() * 1e9);
    let state = ZERO;
    setRunning(true);
    setScore(ZERO);
    const step = (): void => {
      let { done, bad, boxes, ms } = state;
      let shown: Layout | undefined;
      const end = Math.min(TOTAL, done + BATCH);
      for (; done < end; done++) {
        const root = randomTree(first + done);
        const start = performance.now();
        const out = engine.layout({ root }, DOC_OPTIONS);
        ms += performance.now() - start;
        boxes += out.nodes.length;
        if (out.issues.some((i) => i.code === "OVERLAP" || i.code === "ESCAPE")) bad++;
        shown = out;
      }
      state = { done, bad, boxes, ms };
      setScore(state);
      if (shown !== undefined) {
        setLast(shown);
        setSeed(first + done - 1);
      }
      if (done < TOTAL) timer.current = window.setTimeout(step, 16);
      else setRunning(false);
    };
    step();
  };

  const oldShare = OLD.bad / OLD.total;
  const newShare = score.done === 0 ? 0 : score.bad / score.done;

  return (
    <div className="ik-frame ik-fuzz not-content">
      <div className="ik-toolbar">
        <button type="button" className="ik-button" data-variant="primary" onClick={run} disabled={running}>
          {running ? "Running…" : score.done === 0 ? `Lay out ${String(TOTAL)} random trees` : "Run again"}
        </button>
        <span className="ik-spacer" />
        <span className="ik-chip">seed {seed}</span>
      </div>
      <div className="ik-fuzz-body">
        <div className="ik-fuzz-bars">
          <div className="ik-fuzz-row">
            <span className="ik-fuzz-name">The first version</span>
            <span className="ik-fuzz-bar" data-kind="old">
              <span style={{ width: `${String(oldShare * 100)}%` }} />
            </span>
            <span className="ik-fuzz-value">
              {OLD.bad} of {OLD.total} trees overlap
            </span>
          </div>
          <div className="ik-fuzz-row">
            <span className="ik-fuzz-name">ireko, in your browser</span>
            <span className="ik-fuzz-bar" data-kind="new">
              <span style={{ width: `${String(newShare * 100)}%` }} />
              <span className="ik-fuzz-progress" style={{ width: `${String((score.done / TOTAL) * 100)}%` }} />
            </span>
            <span className="ik-fuzz-value" aria-live="polite">
              {score.bad} of {score.done} trees overlap
            </span>
          </div>
          <p className="ik-fuzz-note">
            {score.done === 0
              ? "Each tree has up to four levels, with mixed strategies and modes. The audit of each layout looks for overlaps and for boxes outside their container."
              : `${score.boxes.toLocaleString("en")} boxes in ${score.ms.toFixed(0)} ms: ${(score.ms / score.done).toFixed(2)} ms for each tree on this device.`}
          </p>
        </div>
        <LiveStage layout={last} label="The last random tree" className="ik-fuzz-stage" duration={running ? 0 : 450} />
      </div>
    </div>
  );
}
