import { Vector } from "../core/geometry";
import { LayoutTypes, LayoutChildrenMode } from "../layout/layout.enum";


export type NodeConfig = {
    id: string;
    label?: string;
    position?: Vector;
    children?: NodeConfig[];
    layout?: LayoutTypes;
    mode?: LayoutChildrenMode; // NEW
};
