/** The types of the module `grid.generated.js`, which the Vex compiler makes from the program of the strategy `grid`. */

/** The error of a run whose input does not keep the schema of the program. */
export declare class VexContractError extends Error {}

/** The value of a key where the program gives an error of Vex. */
export declare const VEX_ERROR: { readonly vexError: true };

/** The input of one child: its index and its extent. */
export interface GridRecord {
  readonly i: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The variables of a run: the options of the strategy, the mode, the gap and the size of the box itself. */
export interface GridVars {
  readonly columns: number;
  readonly justify: string;
  readonly align: string;
  readonly uniform: boolean;
  readonly side: string;
  readonly distance: number;
  readonly mode: string;
  readonly gap: number;
  readonly selfW: number;
  readonly selfH: number;
}

/** The cell of one child: its offset, and the size of the grid. */
export interface GridCell {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** This function gives the cell of each child, or `VEX_ERROR` for a child where the program gives an error. */
export declare function gridOf(records: readonly GridRecord[], vars: GridVars): readonly (GridCell | typeof VEX_ERROR)[];
