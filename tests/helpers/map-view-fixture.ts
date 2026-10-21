import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { rect } from "./dom";
import { data, dom, viewBundle } from "./map-runtime";
import type { CameraAnimation, MapRuntime, PopupDouble } from "./map-runtime";
import type { Coordinates } from "../../src/maps/types";
export function viewFixture({
  failInvalidate = false,
  animated = false,
  retina = false,
} = {}) {
  const fixture = dom();
  let removed = 0,
    zoom = 3,
    center: Coordinates = [10, 20];
  const viewport = fixture.document.querySelector<HTMLElement>("#map")!;
  viewport.getBoundingClientRect = () => rect(10, 20, 400, 480);
  const events = new Map<string, (event: Record<string, unknown>) => void>();
  const views: Array<{
      coordinates: Coordinates;
      zoom: number;
      options: unknown;
    }> = [],
    fits: unknown[] = [];
  const zooms: Array<{
    anchor: unknown;
    zoom: number;
    options: { animate?: boolean };
  }> = [];
  const pans: Array<{
      offset: [number, number];
      options: { animate?: boolean };
    }> = [],
    animations: CameraAnimation[] = [];
  const map = {
    on(handlers: Record<string, (event: Record<string, unknown>) => void>) {
      for (const [name, callback] of Object.entries(handlers))
        events.set(name, callback);
    },
    off(handlers: Record<string, unknown>) {
      for (const name of Object.keys(handlers)) events.delete(name);
    },
    fire(name: string, event: Record<string, unknown> = {}) {
      events.get(name)?.(event);
    },
    panBy(offset: [number, number], options: { animate?: boolean } = {}) {
      pans.push({ offset, options });
      return this;
    },
    panTo(coordinates: Coordinates, options: unknown) {
      center = coordinates;
      views.push({ coordinates, zoom, options });
      return this;
    },
    setView(coordinates: Coordinates, level: number, options: unknown) {
      zoom = level;
      center = coordinates;
      views.push({ coordinates, zoom, options });
      return this;
    },
    fitBounds(bounds: unknown, options: unknown) {
      fits.push({ bounds, options });
      return this;
    },
    getZoom: () => zoom,
    getMinZoom: () => data.minZoom,
    getMaxZoom: () => data.maxZoom,
    getScaleZoom: (scale: number, level: number) => level + Math.log2(scale),
    mouseEventToContainerPoint: (event: MouseEvent) => ({
      x: event.clientX - 10,
      y: event.clientY - 20,
    }),
    setZoomAround(
      anchor: unknown,
      level: number,
      options: { animate?: boolean },
    ) {
      this.fire("zoomstart");
      zoom = level;
      zooms.push({ anchor, zoom, options });
      this.fire("zoomend");
      return this;
    },
    getCenter: () => center,
    getContainer: () => viewport,
    getSize: () => ({ x: 400, y: 480 }),
    project: (coordinates: Coordinates) => ({
      x: coordinates[1] * 10,
      y: coordinates[0] * 10,
    }),
    unproject: (point: [number, number]): Coordinates => [
      point[1] / 10,
      point[0] / 10,
    ],
    latLngToContainerPoint(coordinates: Coordinates) {
      return {
        x: 200 + (coordinates[1] - center[1]) * 10,
        y: 240 + (coordinates[0] - center[0]) * 10,
      };
    },
    invalidateSize() {
      if (failInvalidate) throw new Error("size failure");
    },
    remove() {
      removed++;
    },
  };
  const layers: Array<{
    events: Map<string, () => void>;
    options: {
      attribution: string;
      detectRetina: boolean;
      maxZoom: number;
      maxNativeZoom?: number;
    };
  }> = [];
  const points: Array<{
    coordinates: Coordinates;
    options: Record<string, unknown>;
    popup?: HTMLElement;
    popupHandle?: PopupDouble;
    opened: number;
    open(): void;
    close(): void;
  }> = [];
  const leaflet = {
    Browser: { retina },
    tileLayer(_url: string, options: (typeof layers)[number]["options"]) {
      const layer = { events: new Map<string, () => void>(), options };
      layers.push(layer);
      return {
        on(name: string, callback: () => void) {
          layer.events.set(name, callback);
        },
        off(name: string) {
          layer.events.delete(name);
        },
        addTo() {},
      };
    },
    divIcon: (options: Record<string, unknown>) => options,
    latLngBounds: (coordinates: Coordinates[]) => ({
      coordinates,
      getCenter: () => coordinates[0],
    }),
    marker(coordinates: Coordinates, options: Record<string, unknown>) {
      let popup: PopupDouble | undefined;
      const point = {
        coordinates,
        options,
        popup: undefined as HTMLElement | undefined,
        popupHandle: undefined as PopupDouble | undefined,
        opened: 0,
        open() {
          point.opened++;
          map.fire("popupopen", { popup });
        },
        close() {
          map.fire("popupclose", { popup });
        },
      };
      points.push(point);
      const marker = {
        addTo() {
          return marker;
        },
        bindPopup(node: HTMLElement) {
          point.popup = node;
          popup = {
            options: {},
            getLatLng: () => coordinates,
            getElement: () => node,
            update() {},
          };
          point.popupHandle = popup;
          node.getBoundingClientRect = () => {
            const anchor = map.latLngToContainerPoint(coordinates),
              width = Math.min(260, popup!.options.maxWidth ?? 260) + 26,
              height = Math.min(180, popup!.options.maxHeight ?? 180) + 26;
            return rect(
              10 + anchor.x - width / 2,
              20 + anchor.y - height + 7,
              width,
              height,
            );
          };
          return marker;
        },
      };
      return marker;
    },
  };
  const host = fixture.root.querySelector<HTMLElement>("astro-leaflet")!;
  Object.assign(host, {
    leafletElement: undefined,
    activate() {
      Object.assign(host, { leafletElement: map });
    },
    disconnectedCallback() {
      if (Reflect.get(host, "leafletElement")) map.remove();
      Object.assign(host, { leafletElement: undefined });
    },
  });
  const context = {
    document: fixture.document,
    URL,
    MapRuntime: {} as MapRuntime,
    require: (name: string) => {
      if (name === "astro-leaflet/leaflet") return leaflet;
      assert.equal(name, "test-motion-value");
      return {
        transitionValue(update: (progress: number) => void, duration: number) {
          const animation: CameraAnimation = {
            update,
            duration,
            stopped: false,
          };
          animations.push(animation);
          if (!animated || duration === 0) update(1);
          else update(0);
          return {
            stop() {
              animation.stopped = true;
            },
          };
        },
      };
    },
  };
  runInNewContext(viewBundle.outputFiles[0].text, context);
  return {
    ...fixture,
    runtime: context.MapRuntime,
    layers,
    points,
    views,
    fits,
    pans,
    zooms,
    map,
    events,
    animations,
    removed: () => removed,
  };
}
export function input(
  fixture: ReturnType<typeof viewFixture>,
  type: string,
  values: Record<string, unknown> = {},
  target: HTMLElement | Document = fixture.map.getContainer(),
) {
  const event = Object.assign(
    new fixture.window.Event(type, { bubbles: true, cancelable: true }),
    values,
  );
  target.dispatchEvent(event);
  return event;
}
export const wheelValues = {
  ctrlKey: true,
  deltaY: -25,
  deltaMode: 0,
  clientX: 110,
  clientY: 120,
};
