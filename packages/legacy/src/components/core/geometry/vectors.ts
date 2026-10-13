import { VectorBrand, Dimension, Fold, Reduce, NestFold, FoldWith } from "./types";
import { Branded, brand } from "../ids-branding/brand";
import { add, multiply, subtract } from "../math";


export class Vector {


  static scalar = (scalar: number) => new Vector(scalar, scalar);
  static conjugate = (v1: Vector, v2: Vector) => [new Vector(v1.x, v2.x), new Vector(v1.y, v2.y)];
  // static circumscribedRectangle = (p1 : Vector, p2 : Vector) => new Shapes.Rectangle
  public traverseGridTo = (target: Vector, visit: (p: Vector) => void) => {
    for (let x = this.x; x <= target.x; x++) {
      for (let y = this.y; y <= target.y; y++) {
        visit(new Vector(x, y));
      }
    }
  };

  constructor(public readonly x: number, public readonly y: number) { }

  public as<B extends VectorBrand>(b: B): Branded<Vector, B> { return brand(this, b); }
  public asPosition() { return this.as("Position"); }
  public asSize() { return this.as("Size"); }
  public asOffset() { return this.as("Offset"); }
  public asCenter() { return this.as("Center"); }


  public some = (predicate: (value: number) => boolean) => this.reduce<boolean>((x, y) => predicate(x) || predicate(y));
  public every = (predicate: (value: number) => boolean) => this.reduce<boolean>((x, y) => predicate(x) && predicate(y));
  public and = this.every;
  public or = this.some;

  public allLessThan = (value: number) => this.every((x) => x < value);
  public anyLessThan = (value: number) => this.some((x) => x < value);
  public allLessEqual = (value: number) => this.every((x) => x <= value);
  public anyLessEqual = (value: number) => this.some((x) => x <= value);
  public allGreaterThan = (value: number) => this.every((x) => x > value);
  public anyGreaterThan = (value: number) => this.some((x) => x > value);
  public allGreaterEqual = (value: number) => this.every((x) => x >= value);
  public anyGreaterEqual = (value: number) => this.some((x) => x >= value);
  public allEqual = (value: number) => this.every((x) => x === value);
  public anyEqual = (value: number) => this.some((x) => x === value);
  public allPositive = () => this.every((x) => x > 0);
  public anyPositive = () => this.some((x) => x > 0);
  public allNegative = () => this.every((x) => x < 0);
  public anyNegative = () => this.some((x) => x < 0);
  public allZero = () => this.every((x) => x === 0);
  public anyZero = () => this.some((x) => x === 0);
  public allNonZero = () => this.every((x) => x !== 0);
  public anyNonZero = () => this.some((x) => x !== 0);
  public allNonNegative = () => this.every((x) => x >= 0);
  public anyNonNegative = () => this.some((x) => x >= 0);
  public allNonPositive = () => this.every((x) => x <= 0);
  public anyNonPositive = () => this.some((x) => x <= 0);


  public reflect = (axis: Dimension) => (axis === Dimension.X ? new Vector(this.x, -this.y) : new Vector(-this.x, this.y));
  public scale = (factor: number) => this.multiply(Vector.scalar(factor));
  public sum = () => this.reduce(add);
  public crossProduct = (vector: Vector) => this.reflect(Dimension.X).dotProduct(vector.swap());

  /** Safe normalize (guards zero-length). */
  public normalize = (eps = 1e-6) => {
    const len = this.length();
    return len > eps ? this.scale(1 / len) : new Vector(0, 0);
  };

  public length = () => Math.sqrt(this.dotProduct(this));
  public round = () => this.map(Math.round);
  public ceil = () => this.map(Math.ceil);
  public floor = () => this.map(Math.floor);
  public map = (f: Fold) => this.fold(f, f);
  public reduce = <T>(f: Reduce<T>) => f(this.x, this.y);
  public trig = () => this.fold(Math.cos, Math.sin);
  public swap = () => new Vector(this.y, this.x);
  public area = () => this.reduce(multiply);

  /** Safe aspect ratio (y=0 → Infinity). */
  public aspectRatio = () => (this.y === 0 ? Infinity : this.x / this.y);

  public add = (vector: Vector) => this.mapWith(add, vector);
  public multiply = (vector: Vector) => this.mapWith(multiply, vector);
  /** Safe component-wise divide (0 divisor → 0). */
  public divide = (vector: Vector) => new Vector(vector.x === 0 ? 0 : this.x / vector.x, vector.y === 0 ? 0 : this.y / vector.y);

  public subtract = (vector: Vector) => this.mapWith(subtract, vector);
  public max = () => this.reduce(Math.max);
  public min = () => this.reduce(Math.min);
  public negate = () => this.scale(-1);
  public halve = () => this.scale(1 / 2);
  public dotProduct = (vector: Vector) => this.multiply(vector).sum();
  public rotate = (radians: number) => Vector.scalar(radians)
    .trig()
    .nestFold(
      (v: Vector) => v.reflect(Dimension.X).multiply(this).sum(),
      (v: Vector) => v.swap().multiply(this).sum()
    );
  public clamp = (min: number = -Infinity, max: number = Infinity) => this.map((x: number) => Math.min(Math.max(x, min), max));
  public nestFold = (left: NestFold, right: NestFold) => new Vector(left(this), right(this));
  public mapWith = (f: FoldWith, vector: Vector) => this.foldWith(f, f, vector);
  public foldWith = (left: FoldWith, right: FoldWith, vector: Vector) => new Vector(left(this.x, vector.x), right(this.y, vector.y));
  public fold = (left: Fold, right: Fold) => new Vector(left(this.x), right(this.y));
}
