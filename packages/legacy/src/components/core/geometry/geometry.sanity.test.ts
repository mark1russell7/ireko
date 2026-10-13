import { Vector } from "./vectors";

export const geometrySanityNoop = () => {
    console.log(new Vector(3, 4).length()); // 5
    console.log(new Vector(1, 0).rotate(Math.PI / 2)); // ~ (0,1)
    console.log(new Vector(2, 3).crossProduct(new Vector(5, 7))); // 2*7 - 3*5 = -1
};