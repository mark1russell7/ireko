/**
 * The configurator of the strategies page. The reader selects a strategy, a mode and options, and sees the layout,
 * the text and the TypeScript code. The controls come from the option schema of each strategy.
 */
import { createEngine, type LayoutWithOptions, type Mode, type NodeSpec, type OptionSpec } from "ireko";
import { print } from "ireko/text";
import { useMemo, useState, type ReactElement } from "react";
import { DOC_OPTIONS, playgroundHref } from "../lib/docs.ts";
import LiveStage from "./LiveStage.tsx";
import SourceView from "./SourceView.tsx";

const engine = createEngine();
const STRATEGIES = [...engine.strategies.keys()];
const NAMES = "abcdefghijklmnop";
const NO_OPTIONS: Readonly<Record<string, unknown>> = Object.freeze({});

/** The range of a slider for a number option without a maximum in its schema. */
const SLIDER_MAX: Readonly<Record<string, number>> = { columns: 6, distance: 80 };

/** This function makes the children: leaves, and with `subtrees`, a small subtree in each third child. */
function childrenOf(count: number, subtrees: boolean): NodeSpec[] {
  return Array.from({ length: count }, (_, i) => {
    const id = NAMES.charAt(i);
    if (!subtrees || i % 3 !== 1) return { id };
    return { id, children: [{ id: `${id}1` }, { id: `${id}2` }, { id: `${id}3` }] };
  });
}

/** This function gives the TypeScript code of the builder for a root node. */
function codeOf(type: string, mode: Mode, options: Readonly<Record<string, unknown>>, children: readonly NodeSpec[]): string {
  const opts = Object.entries(options);
  const head = `${type}${mode === "nested" ? ".nested" : ""}("root"${opts.length === 0 ? "" : `, { ${opts.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ")} }`}`;
  const kids = children.map((c) => (c.children === undefined ? JSON.stringify(c.id) : `grid(${JSON.stringify(c.id)}, ${c.children.map((g) => JSON.stringify(g.id)).join(", ")})`));
  return `import { grid, layout${type === "grid" ? "" : `, ${type}`} } from "ireko";\n\nconst root = ${head},\n  ${kids.join(", ")},\n);\nconst result = layout({ root });`;
}

/** The configurator. */
export default function Configurator(): ReactElement {
  const [type, setType] = useState("radial");
  const [mode, setMode] = useState<Mode>("linked");
  const [count, setCount] = useState(6);
  const [subtrees, setSubtrees] = useState(true);
  const [values, setValues] = useState<Readonly<Record<string, Readonly<Record<string, unknown>>>>>({});
  const schema = engine.strategies.get(type)?.options ?? {};
  const options = values[type] ?? NO_OPTIONS;

  const setOption = (key: string, value: unknown, spec: OptionSpec): void => {
    const next: Record<string, unknown> = { ...options, [key]: value };
    if (value === spec.default) delete next[key];
    setValues({ ...values, [type]: next });
  };

  const children = useMemo(() => childrenOf(count, subtrees), [count, subtrees]);
  const root = useMemo<NodeSpec>(() => {
    const layout: LayoutWithOptions | string = Object.keys(options).length === 0 ? type : { type, ...options };
    return { id: "root", layout, mode, children };
  }, [type, options, mode, children]);
  const out = useMemo(() => engine.layout({ root }, DOC_OPTIONS), [root]);
  const text = print({ root });

  return (
    <div className="ik-frame ik-config not-content">
      <div className="ik-toolbar">
        <div className="ik-segmented" role="group" aria-label="The strategy">
          {STRATEGIES.map((s) => (
            <button key={s} type="button" aria-pressed={s === type} onClick={() => setType(s)}>
              {s}
            </button>
          ))}
        </div>
        <div className="ik-segmented" role="group" aria-label="The mode">
          {(["linked", "nested"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={m === mode} onClick={() => setMode(m)}>
              {m}
            </button>
          ))}
        </div>
        <label>
          <span>Children {count}</span>
          <input className="ik-input" type="range" min={1} max={12} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </label>
        <label>
          <input type="checkbox" checked={subtrees} onChange={(e) => setSubtrees(e.target.checked)} />
          <span>Subtrees</span>
        </label>
      </div>
      <div className="ik-config-body">
        <fieldset className="ik-config-options">
          <legend>
            The options of <code>{type}</code>
          </legend>
          {Object.entries(schema).map(([key, spec]) => (
            <Control key={`${type}.${key}`} name={key} spec={spec} value={options[key]} onChange={(v) => setOption(key, v, spec)} />
          ))}
          <button type="button" className="ik-button ik-small" disabled={Object.keys(options).length === 0} onClick={() => setValues({ ...values, [type]: {} })}>
            Use the defaults
          </button>
        </fieldset>
        <LiveStage layout={out} label={`The strategy ${type} in the ${mode} mode`} className="ik-config-stage" />
      </div>
      <div className="ik-config-code">
        <SourceView source={text} label="The text of the layout" />
        <pre className="ik-source" tabIndex={0} aria-label="The TypeScript code of the layout">
          <code>{codeOf(type, mode, options, children)}</code>
        </pre>
      </div>
      <p className="ik-caption ik-figure-caption">
        <span>
          {out.nodes.length} boxes. The audit finds {out.issues.length === 0 ? "no defect" : `${String(out.issues.length)} findings`}.
        </span>
        <a href={playgroundHref(text)}>Open in the playground →</a>
      </p>
    </div>
  );
}

/** One control. Its type comes from the schema of the option. */
function Control({ name, spec, value, onChange }: { readonly name: string; readonly spec: OptionSpec; readonly value: unknown; readonly onChange: (value: unknown) => void }): ReactElement {
  if (spec.type === "boolean") {
    const checked = typeof value === "boolean" ? value : spec.default;
    return (
      <label className="ik-config-field" title={spec.description}>
        <span>{name}</span>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      </label>
    );
  }
  if (spec.type === "enum") {
    const current = typeof value === "string" ? value : spec.default;
    return (
      <label className="ik-config-field" title={spec.description}>
        <span>{name}</span>
        <select className="ik-select" value={current} onChange={(e) => onChange(e.target.value)}>
          {spec.values.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const current = typeof value === "number" ? value : spec.default;
  const min = spec.min ?? 0;
  const max = spec.max ?? SLIDER_MAX[name] ?? 100;
  return (
    <label className="ik-config-field" title={spec.description}>
      <span>
        {name} <output>{current}</output>
      </span>
      <input className="ik-input" type="range" min={min} max={max} step={spec.integer === true ? 1 : max - min > 100 ? 5 : 1} value={current} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
