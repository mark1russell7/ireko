/** The types of the module `radial.generated.js`, which the Vex compiler makes from the program of the strategy `radial`. */

/** The error of a run whose input does not keep the schema of the program. */
export declare class VexContractError extends Error {}

/** The value of a key where the program gives an error of Vex. */
export declare const VEX_ERROR: { readonly vexError: true };

/** The input of one child: its index, the size of its box, and its extent relative to the top-left corner of its box. */
export interface RadialRecord {
  readonly i: number;
  readonly bw: number;
  readonly bh: number;
  readonly ex: number;
  readonly ey: number;
  readonly ew: number;
  readonly eh: number;
}

/** The variables of a run: the options of the strategy, the mode, the gap and the size of the box itself. */
export interface RadialVars {
  readonly startAngle: number;
  readonly sweep: number;
  readonly clockwise: boolean;
  readonly distance: number;
  readonly mode: string;
  readonly gap: number;
  readonly selfW: number;
  readonly selfH: number;
}

/** The offset of one child. */
export interface RadialOffset {
  readonly x: number;
  readonly y: number;
}

/** This function gives the offset of each child, or `VEX_ERROR` for a child where the program gives an error. */
export declare function radialOf(records: readonly RadialRecord[], vars: RadialVars): readonly (RadialOffset | typeof VEX_ERROR)[];
