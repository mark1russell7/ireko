import type { LayoutSnapshot } from "../../layout/types";
import type { Theme } from "../../adapters/theme";
import { ViewportController } from "./viewport";

export type MountOptions = {
  viewport? : ViewportController;
  interactive? : boolean;
}

export interface RenderSession {
  draw(snapshot: LayoutSnapshot): void;  // full draw
  destroy(): void;
  // setViewport?:(v : Partial<{x : number, y : number, scale : number}>) => void;
  // getViewport?:() => { x : number, y : number, scale : number };
}

export interface RenderPort {
  mount(
    container: HTMLElement,
    initial: LayoutSnapshot,
    theme: Theme,
    opts?: { viewport?: ViewportController; interactive?: boolean }
  ): RenderSession;
}
