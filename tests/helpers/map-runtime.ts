import { build } from "esbuild";
import { parseHTML } from "linkedom";
import { fileURLToPath } from "node:url";
import { initMaps as initMapsController } from "../../src/runtime/maps";
import type { MapData, Coordinates } from "../../src/maps/types";
export const initMaps: typeof initMapsController = (options) =>
  initMapsController({ styles: async () => {}, ...options });
export type MapRuntime = typeof import("../../src/runtime/map-view");
export const data: MapData = {
  name: "Test",
  points: [
    {
      id: "a.md",
      title: "<img src=x onerror=alert(1)>",
      url: "/a",
      coordinates: [0, 0],
      icon: "constructor",
      color: "#123456",
    },
    {
      id: "b.md",
      title: "Second",
      url: "/b",
      coordinates: [0, 0],
      icon: "plane",
      color: "red",
    },
    {
      id: "c.md",
      title: "Third",
      url: "/c",
      coordinates: [11, 22],
      icon: "map-pin",
      color: "blue",
    },
  ],
  minZoom: 0,
  maxZoom: 18,
  height: 400,
  tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
  attribution: "<img src=x onerror=alert(1)>",
};
export function dom() {
  const { document, window } = parseHTML(
    `<html><head></head><body><section data-map><astro-leaflet data-defer data-id="map" data-options='{"center":[0,0],"zoom":2}'><div id="map"></div></astro-leaflet><p class="map-status"></p><button class="map-retry" hidden>Retry</button></section></body></html>`,
  );
  const root = document.querySelector<HTMLElement>("[data-map]")!;
  root.dataset.map = JSON.stringify(data);
  return {
    document,
    window,
    root,
    retry: root.querySelector<HTMLButtonElement>(".map-retry")!,
    status: root.querySelector<HTMLElement>(".map-status")!,
  };
}
export const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
export const viewBundle = await build({
  entryPoints: [
    fileURLToPath(new URL("../../src/runtime/map-view.ts", import.meta.url)),
  ],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "MapRuntime",
  platform: "browser",
  external: ["astro-leaflet/leaflet"],
  plugins: [
    {
      name: "map-boundaries",
      setup(builder) {
        builder.onResolve({ filter: /^astro-leaflet\/hydrate$/ }, () => ({
          path: "register",
          namespace: "fixture",
        }));

        builder.onResolve({ filter: /^\.\/motion-value$/ }, () => ({
          path: "test-motion-value",
          external: true,
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: 'export const stylesheet = "/leaflet.css";',
        }));
      },
    },
  ],
});
export interface CameraAnimation {
  update(progress: number): void;
  duration: number;
  stopped: boolean;
}
export interface PopupDouble {
  options: { maxWidth?: number; maxHeight?: number };
  getElement(): HTMLElement;
  getLatLng(): Coordinates;
  update(): void;
}
