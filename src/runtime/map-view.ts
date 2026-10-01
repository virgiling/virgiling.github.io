// The patched hydration entry exposes CSS as a URL, not an eager side effect.
import { stylesheet } from "astro-leaflet/hydrate";
export { stylesheet };
import L, {
  type Map as LeafletMap,
  type TileLayer,
} from "astro-leaflet/leaflet";
import { groupPoints, readMapData, type MapData } from "../maps/types";
import { markerElement, popupElement } from "../maps/markers";
import { createMapFocus } from "./map-focus";
import { createMapPinch } from "./map-pinch";
const { marker, divIcon, tileLayer, latLngBounds } = L;
interface MapHost extends HTMLElement {
  leafletElement?: LeafletMap;
  activate(): void;
  disconnectedCallback(): void;
}
export function mountMapView(root: HTMLElement, source: MapData | string) {
  const data = typeof source === "string" ? readMapData(source) : source;
  const host = root.querySelector<MapHost>("astro-leaflet");
  if (!host) throw new Error("Map host missing");
  host.activate();
  const map = host.leafletElement;
  if (!map) throw new Error("Map initialization failed");
  // Native keyboard/box panning remains instantaneous. Focus interpolation is
  // driven separately by shared Motion, never by Leaflet's PosAnimation.
  const originalPanBy = map.panBy;
  map.panBy = (offset, options) =>
    originalPanBy.call(map, offset, { ...options, animate: false });
  const layers: TileLayer[] = [];
  let focus: ReturnType<typeof createMapFocus> | undefined;
  let pinch: ReturnType<typeof createMapPinch> | undefined;
  const onTileError = () => {
    const status = root.querySelector<HTMLElement>(".map-status");
    if (status) {
      status.hidden = false;
      status.textContent = "底图暂时无法加载，地点仍可浏览。";
    }
  };
  function destroy() {
    focus?.destroy();
    pinch?.destroy();
    for (const layer of layers) layer.off("tileerror", onTileError);
    map!.panBy = originalPanBy;
    host!.disconnectedCallback();
  }
  try {
    focus = createMapFocus(map);
    pinch = createMapPinch(map);
    for (const url of data.tiles) {
      // Leaflet's attribution control accepts HTML; serialize DOM-built links
      // and escaped scalar credits, never authored markup.
      const attribution = root.ownerDocument.createElement("span");
      const osm = new URL(url).hostname === "tile.openstreetmap.org";
      if (osm) {
        if (data.attribution !== "© OpenStreetMap contributors")
          attribution.append(data.attribution + " · ");
        const link = root.ownerDocument.createElement("a");
        link.href = "https://www.openstreetmap.org/copyright";
        link.textContent = "© OpenStreetMap contributors";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        attribution.append(link);
      } else attribution.textContent = data.attribution;
      // Native @2x providers use {r}; other raster services use four tiles from
      // the next zoom level. Compensate Leaflet's retina maxZoom adjustment.
      const retina = L.Browser.retina && !url.includes("{r}");
      const layer = tileLayer(url, {
        attribution: attribution.innerHTML,
        detectRetina: !url.includes("{r}"),
        maxZoom: data.maxZoom + (retina ? 1 : 0),
        maxNativeZoom: osm ? 19 - (retina ? 1 : 0) : undefined,
      });
      layers.push(layer);
      layer.on("tileerror", onTileError);
      layer.addTo(map);
    }
    for (const points of groupPoints(data.points)) {
      marker(points[0].coordinates, {
        icon: divIcon({
          html: markerElement(points, root.ownerDocument),
          className: "map-marker",
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
        title:
          points.length === 1 ? points[0].title : `${points.length} 篇笔记`,
        alt: points.map((point) => point.title).join("；"),
        keyboard: true,
      })
        .addTo(map)
        .bindPopup(popupElement(points, root.ownerDocument), {
          autoPan: false,
          keepInView: false,
        });
    }
    const bounds = latLngBounds(data.points.map((point) => point.coordinates));
    if (!data.center && data.zoom === undefined)
      map.fitBounds(bounds, {
        padding: [24, 24],
        maxZoom: Math.min(data.maxZoom, 12),
        animate: false,
      });
    else
      map.setView(
        data.center ?? bounds.getCenter(),
        data.zoom ?? Math.min(data.maxZoom, 12),
        { animate: false },
      );
    map.invalidateSize({ animate: false, pan: false });
    return { destroy };
  } catch (error) {
    destroy();
    throw error;
  }
}
