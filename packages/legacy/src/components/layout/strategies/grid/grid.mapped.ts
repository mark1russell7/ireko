import {
  Shapes,
  Vector
} from "../../../core/geometry";
import { 
    Grid, 
    GridItem 
} from "./grid";

export type MappedGridItemID = string;
export type MappedGridItemData = 
{
    id : MappedGridItemID;
};
export type MappedGridItemDataType = MappedGridItemData;
export  class   MappedGrid<T extends MappedGridItemDataType = MappedGridItemDataType> 
        extends Grid<T>
{
    static emptyMapped<T extends MappedGridItemDataType>(
        size : Vector,
        factory : () => T
    ) : MappedGrid<T> {
        return new MappedGrid<T>(
            size,
            Array
                .from(
                    { 
                        length : size.y 
                    }, 
                    () => Array
                            .from(
                                { 
                                    length : size.x 
                                }, 
                                () => new GridItem<T>(
                                                        new Vector(0, 0), 
                                                        new Shapes.Rectangle(
                                                                                new Vector(0, 0), 
                                                                                new Vector(0, 0)
                                                                            ),
                                                            factory()
                                                        )
                            )
                )
        )
    }
    protected map : Map<MappedGridItemID, Vector> = new Map();
    override set =  (   
                        cell : Vector, 
                        item : GridItem<T>
                    ) : void => 
    {
        this.grid[cell.y][cell.x] = item;
        this.map.set(item.data.id, cell);
    }
    getCell =   (
                    id : MappedGridItemID
                ) : Vector | undefined => 
                    this.map.get(id);
    getItem =   (
                    id : MappedGridItemID
                ) : GridItem<T | undefined> => 
    {
        const cell : Vector | undefined = this.getCell(id);
        if (!cell) 
        {
            throw new Error(`Cell not found for item ID: ${id}`);
        }
        return this.grid[cell.y][cell.x];
    }
}

 