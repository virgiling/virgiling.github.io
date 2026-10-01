import type { Map as LeafletMap, PointExpression } from "astro-leaflet/leaflet";

// Touchscreen pinch stays with Leaflet. Trackpad pinch is ctrl-wheel in
// Chromium/Firefox or GestureEvents in WebKit; neither may zoom the page here.
export function createMapPinch(map: LeafletMap) {
  const container = map.getContainer(),
    doc = container.ownerDocument;
  let touching = false,
    disposed = false;
  let gesture:
    { zoom: number; scale: number; anchor: PointExpression } | undefined;
  function zoomAround(anchor: PointExpression, zoom: number) {
    if (disposed || !Number.isFinite(zoom)) return;
    const bounded = Math.max(
      map.getMinZoom(),
      Math.min(map.getMaxZoom(), zoom),
    );
    if (bounded !== map.getZoom())
      map.setZoomAround(anchor, bounded, { animate: false });
  }
  function consume(event: Event) {
    event.preventDefault();
    event.stopPropagation();
  }
  function wheel(event: WheelEvent) {
    if (
      disposed ||
      doc.hidden ||
      !event.ctrlKey ||
      !Number.isFinite(event.deltaY) ||
      event.deltaY === 0
    )
      return;
    consume(event);
    if (touching || gesture) return;
    const pixels =
      event.deltaY *
      (event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? map.getSize().y
          : 1);
    zoomAround(
      map.mouseEventToContainerPoint(event),
      map.getZoom() - pixels / 100,
    );
  }
  function scale(event: Event) {
    return "scale" in event &&
      typeof event.scale === "number" &&
      Number.isFinite(event.scale) &&
      event.scale > 0
      ? event.scale
      : undefined;
  }
  function gestureStart(event: Event) {
    if (disposed || doc.hidden) return;
    const value = scale(event);
    if (value === undefined) return;
    consume(event);
    if (!touching) {
      const size = map.getSize();
      gesture = {
        zoom: map.getZoom(),
        scale: value,
        anchor: [size.x / 2, size.y / 2],
      };
    }
  }
  function gestureChange(event: Event) {
    if (disposed || doc.hidden) return;
    const value = scale(event);
    if (value === undefined) return;
    consume(event);
    if (gesture && !touching)
      zoomAround(
        gesture.anchor,
        map.getScaleZoom(value / gesture.scale, gesture.zoom),
      );
  }
  function gestureEnd(event: Event) {
    if (gesture) consume(event);
    gesture = undefined;
  }
  function touchStart(event: TouchEvent) {
    touching = event.touches.length > 0;
    gesture = undefined;
  }
  function touchEnd(event: TouchEvent) {
    touching = event.touches.length > 0;
  }
  function reset() {
    touching = false;
    gesture = undefined;
  }
  // Capture pinch even over a popup which stops bubbling wheel events; leave
  // ordinary wheel events untouched so popup/page scrolling remains native.
  container.addEventListener("wheel", wheel, { passive: false, capture: true });
  container.addEventListener("gesturestart", gestureStart, { passive: false });
  container.addEventListener("gesturechange", gestureChange, {
    passive: false,
  });
  container.addEventListener("gestureend", gestureEnd, { passive: false });
  container.addEventListener("touchstart", touchStart, { passive: true });
  doc.addEventListener("touchend", touchEnd, { passive: true });
  doc.addEventListener("touchcancel", touchEnd, { passive: true });
  doc.addEventListener("visibilitychange", reset);
  return {
    destroy() {
      disposed = true;
      reset();
      container.removeEventListener("wheel", wheel, true);
      container.removeEventListener("gesturestart", gestureStart);
      container.removeEventListener("gesturechange", gestureChange);
      container.removeEventListener("gestureend", gestureEnd);
      container.removeEventListener("touchstart", touchStart);
      doc.removeEventListener("touchend", touchEnd);
      doc.removeEventListener("touchcancel", touchEnd);
      doc.removeEventListener("visibilitychange", reset);
    },
  };
}
