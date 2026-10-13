import { Vector } from "./vectors";


export type VectorBrand = "Any" | "Position" | "Size" | "Offset" | "Center";
export enum Dimension { X = "x", Y = "y" }

export type Fold = (value: number) => number;
export type NestFold = (vector: Vector) => number;
export type FoldWith = (value1: number, value2: number) => number;
export type Reduce<T = number> = (x: number, y: number) => T;
