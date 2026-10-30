/** The types of the module `shape.generated.js`, which the Vex compiler makes from the program of the shape of one linked node. */

/** The error of a run whose input does not keep the schema of the program. */
export declare class VexContractError extends Error {}

/** The value of a key where the program gives an error of Vex. */
export declare const VEX_ERROR: { readonly vexError: true };

/** One band, as the type `Band` of ireko. */
export interface VexBand {
  readonly from: number;
  readonly to: number;
  readonly min: number;
  readonly max: number;
}

/** A list of the module: the values of its items, in order (the option `lists: "plain"`). An error item is `VEX_ERROR`. */
export type VexList<T> = readonly (T | typeof VEX_ERROR)[];

/** One record of the program: a child, with its offset and its shape as two lists of bands. */
export interface ShapeRecord {
  readonly ox: number;
  readonly oy: number;
  readonly rows: readonly VexBand[];
  readonly cols: readonly VexBand[];
}

/** The variables of a run: the box of the node and the largest number of bands on each axis. */
export interface ShapeVars {
  readonly w: number;
  readonly h: number;
  readonly limit: number;
}

/**
 * This function gives the shape of the node at each record: a list of two lists of bands, the rows and the columns,
 * as plain arrays.
 * It gives `VEX_ERROR` where the program gives an error of Vex.
 */
export declare function nodeShape(records: readonly ShapeRecord[], vars: ShapeVars): readonly (VexList<VexList<VexBand>> | typeof VEX_ERROR)[];
