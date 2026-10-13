import { Branded } from "../ids-branding/brand";
import { Vector } from "./vectors";


export namespace Shapes {
  export class Rectangle {
    constructor(public size: Vector, public position: Vector) {
      this.size = size.as("Size");
      this.position = position.as("Position");
    }
    getPosition(): Branded<Vector, "Position"> { return this.position.as("Position"); }
    getSize(): Branded<Vector, "Size"> { return this.size.as("Size"); }
  }

  export class Box extends Rectangle {
    constructor(
      public id: string,
      position: Vector,
      size: Vector,
      public parentId?: string,
      public depth: number = 0
    ) {
      super(size, position);
    }
    setDepth(d: number): this { this.depth = d; return this; }
  }
}
