import "medium-zoom/dist/pure/index.js";

// Public additions provided by patches/medium-zoom@1.1.0.patch.
declare module "medium-zoom/dist/pure/index.js" {
  interface ZoomOptions {
    manual?: boolean;
    motion?: (
      images: HTMLImageElement[],
      overlay: HTMLDivElement,
      transform: string,
      opening: boolean,
    ) => Promise<unknown>;
  }
  interface Zoom {
    destroy(): Promise<void>;
  }
}
