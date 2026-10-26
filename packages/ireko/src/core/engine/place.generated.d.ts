/** The types of the module `place.generated.js`, which the Vex compiler makes from the sheet of the place pass. */

/** The error of a run whose input does not keep the schema of the sheet. */
export declare class VexContractError extends Error {}

/** The value of a cell where the sheet gives an error of Vex. */
export declare const VEX_ERROR: { readonly vexError: true };

/**
 * The input of one node: the position of its parent or -1, its placement in the box of its parent, the size of its box,
 * and true for the nested mode.
 */
export interface PlaceRecord {
  readonly p: number;
  readonly px: number;
  readonly py: number;
  readonly ps: number;
  readonly bw: number;
  readonly bh: number;
  readonly nested: boolean;
}

/** The variables of a run: the origin of the layout. */
export interface PlaceVars {
  readonly ox: number;
  readonly oy: number;
}

/** A column of the sheet: the value at each node, or `VEX_ERROR` for a node where the sheet gives an error. */
export type PlaceColumn = readonly (number | typeof VEX_ERROR)[];

/**
 * The columns of the sheet. `ax`, `ay` and `as` are the absolute position and scale. `x` and `y` are the position with
 * 0 for a number that is almost 0. `container` is the position of the nested container of each node, or -1.
 */
export interface PlaceColumns {
  readonly ax: PlaceColumn;
  readonly ay: PlaceColumn;
  readonly as: PlaceColumn;
  readonly container: PlaceColumn;
  readonly x: PlaceColumn;
  readonly y: PlaceColumn;
  readonly width: PlaceColumn;
  readonly height: PlaceColumn;
}

/** This function fills the columns of the sheet over the tree of `parents`: the position of the parent of each node, or -1. */
export declare function placeOf(records: readonly PlaceRecord[], vars: PlaceVars, parents: readonly number[]): PlaceColumns;
