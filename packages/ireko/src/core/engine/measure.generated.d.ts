/** The types of the module `measure.generated.js`, which the Vex compiler makes from the sheet of the fit of the measure pass. */

/** The error of a run whose input does not keep the schema of the sheet. */
export declare class VexContractError extends Error {}

/** The value of a cell where the sheet gives an error of Vex. */
export declare const VEX_ERROR: { readonly vexError: true };

/**
 * One record of the sheet. The record 0 is the node, with `p` -1 and 0 in each other field. Each other record is a
 * child, with `p` 0: its offset from the strategy (`ox`, `oy`) and the extent of its subtree (`ex`, `ey`, `ew`, `eh`).
 */
export interface MeasureRecord {
  readonly p: number;
  readonly ox: number;
  readonly oy: number;
  readonly ex: number;
  readonly ey: number;
  readonly ew: number;
  readonly eh: number;
}

/**
 * The variables of a run: the node. `linked` is true in the linked mode. `content` is true when the strategy gives a
 * content area (`cx`, `cy`, `cw`, `ch`). `ownW` and `ownH` are the own size, and `expW` and `expH` the explicit size.
 * `hasW` and `hasH` tell if the spec gives a width and a height (`nodeW`, `nodeH`). `grow`, `scale` and `clip` are the fit.
 */
export interface MeasureVars {
  readonly linked: boolean;
  readonly content: boolean;
  readonly cx: number;
  readonly cy: number;
  readonly cw: number;
  readonly ch: number;
  readonly ownW: number;
  readonly ownH: number;
  readonly expW: number;
  readonly expH: number;
  readonly hasW: boolean;
  readonly hasH: boolean;
  readonly nodeW: number;
  readonly nodeH: number;
  readonly padding: number;
  readonly header: number;
  readonly grow: boolean;
  readonly scale: boolean;
  readonly clip: boolean;
}

/** A column of the sheet: the value at each record, or `VEX_ERROR` for a record where the sheet gives an error. */
export type MeasureColumn<T = number> = readonly (T | typeof VEX_ERROR)[];

/**
 * The columns of the sheet. At the record 0 (the node): `bx`, `by`, `bw` and `bh` are the union of the placed children
 * with the start rectangle. `firstW` and `firstH` are the size before the check of the padding, `small` tells if the
 * check failed, and `sw` and `sh` are the box in the nested mode. At each child: `lx`, `ly` and `ls` are its placement.
 */
export interface MeasureColumns {
  readonly bx: MeasureColumn;
  readonly by: MeasureColumn;
  readonly bw: MeasureColumn;
  readonly bh: MeasureColumn;
  readonly top: MeasureColumn;
  readonly needW: MeasureColumn;
  readonly needH: MeasureColumn;
  readonly firstW: MeasureColumn;
  readonly firstH: MeasureColumn;
  readonly small: MeasureColumn<boolean>;
  readonly sw: MeasureColumn;
  readonly sh: MeasureColumn;
  readonly freeW: MeasureColumn;
  readonly freeH: MeasureColumn;
  readonly sc: MeasureColumn;
  readonly sx: MeasureColumn;
  readonly sy: MeasureColumn;
  readonly lx: MeasureColumn;
  readonly ly: MeasureColumn;
  readonly ls: MeasureColumn;
}

/** This function fills the columns of the sheet over the tree of `parents`: -1 for the node, and 0 for each child. */
export declare function measureOf(records: readonly MeasureRecord[], vars: MeasureVars, parents: readonly number[]): MeasureColumns;
