/** The types of the module `tree.generated.js`, which the Vex compiler makes from the program of the strategy `tree`. */

/** The error of a run whose input does not keep the schema of the program. */
export declare class VexContractError extends Error {}

/** The value of a key where the program gives an error of Vex. */
export declare const VEX_ERROR: { readonly vexError: true };

/** One band, as the type `Band` of ireko. */
export interface TreeBand {
  readonly from: number;
  readonly to: number;
  readonly min: number;
  readonly max: number;
}

/**
 * The input of one child: its index, the size of its box, its extent relative to the top-left corner of its box, and
 * its shape. A child without a shape has the value false in `shaped` and two empty lists.
 */
export interface TreeRecord {
  readonly i: number;
  readonly bw: number;
  readonly bh: number;
  readonly ex: number;
  readonly ey: number;
  readonly ew: number;
  readonly eh: number;
  readonly shaped: boolean;
  readonly rows: readonly TreeBand[];
  readonly cols: readonly TreeBand[];
}

/** The variables of a run: the options of the strategy, the mode, the gap and the size of the box itself. */
export interface TreeVars {
  readonly side: string;
  readonly distance: number;
  readonly align: string;
  readonly mode: string;
  readonly gap: number;
  readonly selfW: number;
  readonly selfH: number;
}

/** The offset of one child, and the direction of the edges. The direction is empty in the nested mode. */
export interface TreeOffset {
  readonly x: number;
  readonly y: number;
  readonly direction: string;
}

/** This function gives the offset of each child, or `VEX_ERROR` for a child where the program gives an error. */
export declare function treeOf(records: readonly TreeRecord[], vars: TreeVars): readonly (TreeOffset | typeof VEX_ERROR)[];
