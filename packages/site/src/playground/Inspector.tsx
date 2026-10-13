/**
 * The inspector of the playground: the settings of the selected node. The controls of the options come from the
 * option schema of each strategy, so a new strategy gets controls with no new code.
 */
import type { Engine, Fit, Mode, NodeSpec, OptionSpec } from "ireko";
import type { ReactElement } from "react";
import { joinLayout, layoutParts, without } from "./spec.ts";

interface Props {
  readonly node: NodeSpec;
  readonly engine: Engine;
  readonly onChange: (node: NodeSpec) => void;
  readonly onClose: () => void;
}

const COMMON: readonly [string, string][] = [
  ["gap", "The distance between two children."],
  ["padding", "The space inside the edge of a nested container."],
  ["header", "The smallest space above the content of a nested container."],
];

/** The inspector. */
export default function Inspector({ node, engine, onChange, onClose }: Props): ReactElement {
  const { type, options } = layoutParts(node.layout);
  const strategy = engine.strategies.get(type);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const setOption = (key: string, value: unknown): void => onChange({ ...node, layout: joinLayout(type, { ...options, [key]: value }) });

  return (
    <section className="pg-panel" aria-label={`The settings of the node ${node.id}`}>
      <header className="pg-panel-head">
        <h2>
          <code>{node.id}</code>
        </h2>
        <button type="button" className="ik-button ik-small" onClick={onClose}>
          Close
        </button>
      </header>
      {hasChildren ? null : <p className="pg-hint">This node has no children. Its strategy and mode take effect when it gets children.</p>}

      <label className="pg-field">
        <span>Label</span>
        <input className="ik-input" value={node.label ?? ""} placeholder={node.id} onChange={(e) => onChange(e.target.value === "" ? without(node, "label") : { ...node, label: e.target.value })} />
      </label>

      <div className="pg-field">
        <span>Mode</span>
        <div className="ik-segmented" role="group" aria-label="Mode">
          {(["linked", "nested"] as const satisfies readonly Mode[]).map((m) => (
            <button key={m} type="button" aria-pressed={(node.mode ?? "linked") === m} onClick={() => onChange(m === "linked" ? without(node, "mode") : { ...node, mode: m })}>
              {m}
            </button>
          ))}
        </div>
      </div>

      <label className="pg-field">
        <span>Strategy</span>
        <select className="ik-select" value={type} onChange={(e) => onChange({ ...node, layout: e.target.value })}>
          {[...engine.strategies.keys()].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      {strategy === undefined ? null : <p className="pg-hint">{strategy.description}</p>}

      {node.mode === "nested" ? (
        <label className="pg-field">
          <span>Fit</span>
          <select className="ik-select" value={node.fit ?? "grow"} onChange={(e) => onChange(e.target.value === "grow" ? without(node, "fit") : { ...node, fit: e.target.value as Fit })}>
            <option value="grow">grow</option>
            <option value="scale">scale</option>
            <option value="clip">clip</option>
          </select>
        </label>
      ) : null}

      <fieldset className="pg-group">
        <legend>Size</legend>
        {(["width", "height"] as const).map((k) => (
          <label key={k} className="pg-field pg-inline">
            <span>{k}</span>
            <input
              className="ik-input"
              type="number"
              min={1}
              value={node.size?.[k] ?? ""}
              placeholder="auto"
              onChange={(e) => {
                const value = e.target.value === "" ? undefined : Number(e.target.value);
                const size = { ...node.size, [k]: value };
                const kept = Object.fromEntries(Object.entries(size).filter(([, v]) => v !== undefined));
                onChange(Object.keys(kept).length === 0 ? without(node, "size") : { ...node, size: kept });
              }}
            />
          </label>
        ))}
      </fieldset>

      {strategy === undefined ? null : (
        <fieldset className="pg-group">
          <legend>The options of {type}</legend>
          {Object.entries(strategy.options).map(([key, spec]) => (
            <OptionControl key={key} name={key} spec={spec} value={options[key]} onChange={(v) => setOption(key, v)} />
          ))}
          {COMMON.map(([key, description]) => (
            <OptionControl key={key} name={key} spec={{ type: "number", default: Number.NaN, min: 0, description }} value={options[key]} onChange={(v) => setOption(key, v)} />
          ))}
          <button type="button" className="ik-button ik-small" onClick={() => onChange({ ...node, layout: type })}>
            Use the defaults
          </button>
        </fieldset>
      )}
    </section>
  );
}

function OptionControl({ name, spec, value, onChange }: { name: string; spec: OptionSpec; value: unknown; onChange: (value: unknown) => void }): ReactElement {
  if (spec.type === "boolean") {
    return (
      <label className="pg-field pg-inline" title={spec.description}>
        <input type="checkbox" checked={typeof value === "boolean" ? value : spec.default} onChange={(e) => onChange(e.target.checked === spec.default ? undefined : e.target.checked)} />
        <span>{name}</span>
      </label>
    );
  }
  if (spec.type === "enum") {
    return (
      <label className="pg-field pg-inline" title={spec.description}>
        <span>{name}</span>
        <select className="ik-select" value={typeof value === "string" ? value : spec.default} onChange={(e) => onChange(e.target.value === spec.default ? undefined : e.target.value)}>
          {spec.values.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="pg-field pg-inline" title={spec.description}>
      <span>{name}</span>
      <input
        className="ik-input"
        type="number"
        min={spec.min}
        max={spec.max}
        step={spec.integer === true ? 1 : "any"}
        value={typeof value === "number" ? value : ""}
        placeholder={Number.isNaN(spec.default) ? "auto" : String(spec.default)}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    </label>
  );
}
