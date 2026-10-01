import {
  createElement,
  MapPin,
  Plane,
  Compass,
  Award,
  BookOpen,
  GraduationCap,
  Terminal,
  type IconNode,
} from "lucide";
import { markerColor, type MapPoint } from "./types";
const icons: Record<string, IconNode> = {
  "map-pin": MapPin,
  plane: Plane,
  compass: Compass,
  award: Award,
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  terminal: Terminal,
};
export function markerElement(points: MapPoint[], doc = document) {
  const node = doc.createElement("span");
  node.className = "map-marker-badge";
  node.style.setProperty("--marker-color", markerColor(points[0].color));
  const icon = createElement(
    Object.hasOwn(icons, points[0].icon) ? icons[points[0].icon] : MapPin,
    { "aria-hidden": "true", focusable: "false" },
  );
  node.append(icon);
  if (points.length > 1) {
    const count = doc.createElement("span");
    count.className = "map-marker-count";
    count.textContent = String(points.length);
    node.append(count);
  }
  return node;
}
export function popupElement(points: MapPoint[], doc = document) {
  const node = doc.createElement("div"),
    list = doc.createElement("ul");
  node.className = "map-popup";
  for (const point of points) {
    const row = doc.createElement("li"),
      link = doc.createElement("a");
    link.textContent = point.title;
    link.href = point.url;
    const icon = markerElement([point], doc);
    icon.classList.add("map-popup-icon");
    row.append(icon, link);
    list.append(row);
  }
  const location = doc.createElement("p");
  location.className = "map-popup-coordinate";
  location.textContent = points[0].coordinates.join(", ");
  node.append(list, location);
  return node;
}
