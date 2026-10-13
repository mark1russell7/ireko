import { Vector } from "../../core/geometry";
import { 
    LayoutChildrenMode 
} from "../layout.enum";
import { Shapes } from "../../core/geometry";

/** Unit point in [0,1]² (center-based for grid centers). */
export type UnitPoint = Vector;

/** Compute unit point for i-th child among n, given a (cols,rows) heuristic. */
export type UnitIterator =  (
                                i       : number, 
                                n       : number, 
                                rowCol  : Vector
                            ) => UnitPoint;

/** Map a unit point into a concrete rectangle (top-left + size). */
export type RectMapper =    (
                                u       : UnitPoint, 
                                rect    : Shapes.Rectangle
                            ) => Vector;

export type AnchorIteratorParams =
{
    mode        : LayoutChildrenMode;
    parentSize  : Vector;
    spacing     : number;
}
/** Anchor offset for GRAPH placements (tree-below, etc.). */
export type AnchorIterator =    (  
                                    ctx : AnchorIteratorParams
                                ) => Vector;

/** Angle iterator for radial layouts (delegates tuning for start/cw/step). */
export type AngleIterator = (
                                i   : number, 
                                n   : number
                            ) => number;

/** Iterator object = composition of unit/angle + mapping + anchoring. */
export interface IteratorOps 
{
    unit?       : UnitIterator;           // e.g., grid center
    mapToRect?  : RectMapper;        // maps unit → rect coords
    anchor      : AnchorIterator;        // anchor for graph mode
    angle?      : AngleIterator;         // for radial
}

/** Concrete iterator with helpers to derive positions. */
export class Iterator 
{
    constructor (
                    private ops : IteratorOps
                ) 
    {
        
    }

    /** Centers inside rect using unit iterator (grid). */
    centersInRect   (
                        n       : number, 
                        rowCol  : Vector, 
                        rect    : Shapes.Rectangle
                    ) : Vector[] 
    {
        if  (
                    !this.ops.unit 
                ||  !this.ops.mapToRect
            ) 
        {
            return [];
        }
        const res : Vector[] = [];
        for (
                let i : number = 0; 
                i < n; 
                i++
            )
        {
            const u : UnitPoint = this  .ops
                                        .unit   (
                                                    i, 
                                                    n, 
                                                    rowCol
                                                );
            res.push(
                        this.ops.mapToRect  (
                                                u, 
                                                rect
                                            )
                    );
        }
        return res;
    }

    /** Anchored centers for graph mode; caller applies top-left later. */
    anchorOffset(
                    ctx :   { 
                                mode        : LayoutChildrenMode; 
                                parentSize  : Vector; 
                                spacing     : number 
                            }
                ) : Vector 
    {
        return this.ops.anchor(ctx);
    }

    /** Angles for radial iteration. */
    angles  (
                n : number
            ) : number[] 
    {
        if (!this.ops.angle) 
        {
            return [];
        }
        const res : number[] = [];
        for (
                let i : number = 0; 
                i < n; 
                i++
            ) 
            {
                res.push(this.ops.angle(i, n));
            }
        return res;
    }
}
