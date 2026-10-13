import { 
    Config 
} from "../config";
import { Vector } from "../core/geometry";
import { AnchorIteratorParams } from "./iterator/iterator.types";
import { 
    LayoutChildrenMode 
} from "./layout.enum";

export type LayoutTuning = 
{
    /* paddings */
    outerPad                :   (spacing: number) => number;     // nested parent content padding
    itemPad                 :   (spacing: number) => number;     // inner cell padding (grid-only)

    /* grid row/col heuristic — return Vector(cols, rows) */
    rowCol                  :   (n: number) => Vector;

    /* anchor for GRAPH placements (tree-below) */
    anchor                  :   (
                                    ctx :   { 
                                                mode        : LayoutChildrenMode; 
                                                parentSize  : Vector; 
                                                spacing     : number 
                                            }
                                ) => Vector;

    /* RADIAL knobs */
    startAngle              :   () => number;                  // radians (0 = 3 o’clock)
    clockwise               :   () => boolean;                 // direction
    angleOf                 :   (
                                    i       : number, 
                                    n       : number, 
                                    start   : number, 
                                    cw      : boolean
                                ) => number;

    /* GRAPH radial radius: r = base(nodeSize, spacing) * (1 + level * levelScale) */
    radialBase              :   (
                                    nodeSize    : Vector, 
                                    spacing     : number
                                ) => number;
    radialLevelScale        :   () => number;
    minRadius               :   () => number;

    /* NESTED radial preferred size if no size is provided (root-only or free): */
    nestedRadialPreferred   :   (
                                    count       : number, 
                                    nodeSize    : Vector, 
                                    spacing     : number) => Vector;
    nestedNodeScale         :   (level: number) => number;  // NEW
    nestedContainerScale    :   (level: number) => number;   // NEW
    nestedChildMaxFraction  :   () => number;        // NEW: cap child box vs parent inner (radial nested)
};

export const defaultTuning : LayoutTuning = 
{
    outerPad: (s :  number) : number => Math.max(0, Math.round(s * 1.0)),
    itemPad : (s :  number) : number => Math.max(0, Math.round(s * 0.25)),

    rowCol: (n :  number) : Vector => {
        const rows : number = Math.ceil(Math.sqrt(Math.max(1, n)));
        const cols : number = Math.ceil(n / rows);
        return new Vector(cols, rows);
    },

    anchor: ({ mode, parentSize, spacing } : AnchorIteratorParams) : Vector =>
        mode === LayoutChildrenMode.GRAPH
            ? new Vector(0, (parentSize?.y ?? 0) / 2 + spacing * 1.25)
            : new Vector(0, 0),

    startAngle  : () : number => 0,
    clockwise   : () : boolean => true,
    angleOf     : 
                (  
                    i       : number, 
                    n       : number, 
                    start   : number, 
                    cw      : boolean
                ) : number => 
        start + (cw ? 1 : -1) * (i / Math.max(1, n)) * Math.PI * 2,

    radialBase              :   (
                                    nodeSize    : Vector, 
                                    spacing     : number
                                ) : number => nodeSize.max() + spacing * 3, // was “*3”
    radialLevelScale        :   () => 0.6,                                      // was “0.6”
    minRadius               :   () => 8,

    nestedNodeScale         :   (level : number) : number => Math.pow(0.85, level + 1), // NEW: ~15% smaller per depth
    nestedContainerScale    :   (level : number) : number => Math.pow(0.85, level + 1),
    // sensible default: grows gently with child count
    nestedRadialPreferred   :   (
                                    count       : number, 
                                    nodeSize    : Vector, 
                                    spacing     : number
                                ) : Vector => 
    {
        const ring  : number = Math.max(1, count);
        const r     : number = Math.max (   
                                            nodeSize.max() + spacing * 2, 
                                            nodeSize.max() * (1 + 0.15 * ring)
                                        );
        const d     : number = 2 * r + 2 * Math.max(12, spacing * 1.0);
        return Vector.scalar(d);
    },
    nestedChildMaxFraction: () => 0.45,                    // child’s longest side <= 45% of parent
};

export const LayoutTuningConfig = new Config<LayoutTuning>(defaultTuning);
