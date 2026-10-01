export type Coordinates = [latitude: number, longitude: number];
export interface MapPoint {
  id: string;
  title: string;
  url: string;
  coordinates: Coordinates;
  icon: string;
  color: string;
}
export interface MapData {
  name: string;
  points: MapPoint[];
  center?: Coordinates;
  zoom?: number;
  minZoom: number;
  maxZoom: number;
  height: number;
  tiles: string[];
  attribution: string;
}
export type JourneyMap =
  | { status: "ready"; data: MapData }
  | { status: "unavailable" | "error"; message: string };

export function coordinates(value: unknown): Coordinates | undefined {
  const values = typeof value === "string" ? value.split(",") : value;
  if (!Array.isArray(values) || values.length < 2) return;
  const number = (part: unknown) =>
    typeof part === "number"
      ? part
      : typeof part === "string" && part.trim()
        ? Number(part)
        : NaN;
  const lat = number(values[0]),
    lng = number(values[1]);
  if (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  )
    return [lat, lng];
}
export function markerColor(value: unknown) {
  return typeof value === "string" &&
    /^(?:#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})|[a-z]{1,30}|(?:rgb|rgba|hsl|hsla)\([\d.%+\-,\s]+\)|var\(--[\w-]+\))$/i.test(
      value.trim(),
    )
    ? value.trim()
    : "#75665a";
}
export function readMapData(source: string): MapData {
  const value: unknown = JSON.parse(source);
  const object = (input: unknown): input is Record<string, unknown> =>
    input !== null && typeof input === "object" && !Array.isArray(input);
  const finite = (input: unknown): input is number =>
    typeof input === "number" && Number.isFinite(input);
  if (
    !object(value) ||
    typeof value.name !== "string" ||
    !Array.isArray(value.points) ||
    !value.points.length ||
    !finite(value.minZoom) ||
    !finite(value.maxZoom) ||
    value.minZoom < 0 ||
    value.maxZoom < value.minZoom ||
    value.maxZoom > 20 ||
    !finite(value.height) ||
    value.height < 100 ||
    value.height > 2000 ||
    typeof value.attribution !== "string" ||
    !Array.isArray(value.tiles) ||
    !value.tiles.length ||
    !value.tiles.every(
      (tile) => typeof tile === "string" && /^https:\/\//.test(tile),
    ) ||
    (value.zoom !== undefined &&
      (!finite(value.zoom) ||
        value.zoom < value.minZoom ||
        value.zoom > value.maxZoom))
  )
    throw new Error("Invalid map data");
  const points: MapPoint[] = value.points.map((point) => {
    if (
      !object(point) ||
      ![point.id, point.title, point.url, point.icon, point.color].every(
        (item) => typeof item === "string",
      ) ||
      typeof point.url !== "string" ||
      !/^\/(?!\/)/.test(point.url) ||
      /[\\\u0000-\u001f]/.test(point.url)
    )
      throw new Error("Invalid map point");
    const location = coordinates(point.coordinates);
    if (!location) throw new Error("Invalid map coordinates");
    return {
      id: point.id as string,
      title: point.title as string,
      url: point.url,
      coordinates: location,
      icon: point.icon as string,
      color: markerColor(point.color),
    };
  });
  const center =
    value.center === undefined ? undefined : coordinates(value.center);
  if (value.center !== undefined && !center)
    throw new Error("Invalid map center");
  return {
    name: value.name,
    points,
    center,
    zoom: value.zoom as number | undefined,
    minZoom: value.minZoom,
    maxZoom: value.maxZoom,
    height: value.height,
    tiles: value.tiles as string[],
    attribution: value.attribution,
  };
}
export function groupPoints(points: MapPoint[]) {
  const groups = new Map<string, MapPoint[]>();
  for (const point of points) {
    const key = point.coordinates.join(",");
    const group = groups.get(key) ?? [];
    group.push(point);
    groups.set(key, group);
  }
  return [...groups.values()];
}
