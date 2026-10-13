import {
  Vector,
  Shapes
} from "../../../core/geometry";
export class GridItem<T> 
{
    constructor(
        public cell       : Vector,
        public dimensions : Shapes.Rectangle,
        public data       : T
    ) 
    { 

    }
}


export class Grid<T> 
{
    static empty<T>(
        size : Vector,
        factory : (
            x : number,
            y : number
        ) => T
    ) : Grid<T>{
        return new Grid<T>(
            size,
            Array
                .from(
                    { 
                        length : size.y 
                    }, 
                    (
                        y : number
                    ) => Array
                            .from(
                                { 
                                    length : size.x 
                                }, 
                                (
                                    x : number
                                ) => new GridItem<T>(
                                                        new Vector(0, 0), 
                                                        new Shapes.Rectangle(
                                                                                new Vector(0, 0), 
                                                                                new Vector(0, 0)
                                                                            ),
                                                        factory(x, y)
                                                    )
                            )
                )
        )
    }
    constructor(
        public size : Vector,
        public grid : GridItem<T>[][]
    ) 
    {}
    set =   (
                cell : Vector, 
                item : GridItem<T>
            ) 
            : void =>
                void (this.grid[cell.y][cell.x] = item);
    get =   (
                cell : Vector
            ) 
            : GridItem<T | undefined> => 
                this.grid[cell.y][cell.x];
}
