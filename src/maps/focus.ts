export interface Pixel {
  x: number;
  y: number;
}
export interface PopupExtent {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
/** Keep the marker centered unless its popup needs a small visibility correction. */
export function popupAnchor(
  size: Pixel,
  extent: PopupExtent,
  desired: Pixel = { x: size.x / 2, y: size.y / 2 },
  padding = 16,
): Pixel {
  const clamp = (value: number, min: number, max: number) =>
    min <= max ? Math.max(min, Math.min(max, value)) : (min + max) / 2;
  return {
    x: clamp(desired.x, padding - extent.left, size.x - padding - extent.right),
    y: clamp(desired.y, padding - extent.top, size.y - padding - extent.bottom),
  };
}
