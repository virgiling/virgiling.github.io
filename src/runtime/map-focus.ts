import type {
  Map as LeafletMap,
  Popup,
  PopupEvent,
} from "astro-leaflet/leaflet";
import { popupAnchor } from "../maps/focus";
import { transitionValue } from "./motion-value";
import { durations } from "./timing";
export function createMapFocus(map: LeafletMap) {
  let active: Popup | undefined,
    animation: ReturnType<typeof transitionValue> | undefined,
    disposed = false;
  const cancel = () => {
    animation?.stop();
    animation = undefined;
  };
  function focus(popup: Popup, center: boolean) {
    if (disposed) return;
    const location = popup.getLatLng();
    if (!location) return;
    cancel();
    const size = map.getSize(),
      container = map.getContainer(),
      zoom = map.getZoom();
    // Leaflet provides the scroll area; avoid a second nested scrolling list.
    popup.options.maxWidth = Math.max(80, Math.min(320, size.x - 80));
    popup.options.maxHeight = Math.max(32, Math.min(240, size.y / 2 - 64));
    popup.update();
    const element = popup.getElement();
    if (!element) return;
    const box = element.getBoundingClientRect(),
      viewport = container.getBoundingClientRect();
    const position = map.latLngToContainerPoint(location);
    const desired = popupAnchor(
      size,
      {
        left: box.left - viewport.left - position.x,
        right: box.right - viewport.left - position.x,
        top: box.top - viewport.top - position.y,
        bottom: box.bottom - viewport.top - position.y,
      },
      center ? undefined : position,
    );
    const origin = map.project(map.getCenter(), zoom),
      point = map.project(location, zoom);
    const target = {
      x: point.x + size.x / 2 - desired.x,
      y: point.y + size.y / 2 - desired.y,
    };
    const update = (progress: number) => {
      if (disposed) return;
      map.panTo(
        map.unproject(
          [
            origin.x + (target.x - origin.x) * progress,
            origin.y + (target.y - origin.y) * progress,
          ],
          zoom,
        ),
        { animate: false },
      );
    };
    animation = transitionValue(
      update,
      center ? durations.mapFocus : 0,
      container.ownerDocument,
    );
  }
  const handlers = {
    popupopen(event: PopupEvent) {
      active = event.popup;
      focus(active, true);
    },
    popupclose(event: PopupEvent) {
      if (active === event.popup) {
        active = undefined;
        cancel();
      }
    },
    dragstart: cancel,
    zoomstart: cancel,
    zoomend() {
      if (active) focus(active, false);
    },
    resize() {
      if (active) focus(active, false);
    },
  };
  map.on(handlers);
  return {
    destroy() {
      disposed = true;
      cancel();
      map.off(handlers);
      active = undefined;
    },
  };
}
