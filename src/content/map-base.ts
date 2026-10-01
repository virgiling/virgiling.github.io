import { readFile, realpath } from "node:fs/promises";
import { resolve, relative, posix } from "node:path";
import { parseDocument } from "yaml";
import {
  compile,
  evaluate,
  evaluateFilter,
  resolvePropertyValue,
  type CompiledExpression,
  type EvalContext,
} from "@quartz-community/bases-page/compiler";
import { classifyContentPath } from "../content-policy";
import { safePath } from "./read";
import type { Note, Diagnostic } from "./types";
import {
  coordinates,
  markerColor,
  type MapData,
  type JourneyMap,
} from "../maps/types";

type Filter = Exclude<Parameters<typeof evaluateFilter>[0], undefined>;
type Expression = CompiledExpression["ast"];
// Match the pinned compiler's function surface: it otherwise silently returns
// undefined for unknown calls, which can masquerade as an empty public query.
const globalCalls = new Set(
  "if contains date duration now today number min max list link image icon html escapeHTML file".split(
    " ",
  ),
);
const methodCalls = new Set(
  "hasTag hasLink inFolder hasProperty contains startsWith endsWith lower upper trim replace slice isEmpty repeat reverse toFixed round floor ceil abs format year month day date time relative sum mean count min max asLink containsAll containsAny split title asFile flat join sort unique keys values isTruthy isType filter map flatMap find some every".split(
    " ",
  ),
);
interface MapBase {
  filters?: Filter;
  formulas: Record<string, string>;
  formulaOrder: string[];
  view: Record<string, unknown>;
  viewFilters?: Filter;
}
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
function expression(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.length > 4096)
    throw new Error("Base 表达式为空或过长");
  const program = compile(value);
  if (program.instructions.length > 2048)
    throw new Error("Base 表达式过于复杂");
  dependencies(program.ast);
  return program;
}
function filter(value: unknown, depth = 0): Filter | undefined {
  if (value === undefined) return;
  if (depth > 24) throw new Error("Base 筛选嵌套过深");
  if (typeof value === "string") {
    expression(value);
    return value;
  }
  if (!record(value) || Object.keys(value).length !== 1)
    throw new Error("Base 筛选格式无效");
  const key = Object.keys(value)[0];
  if (
    !["and", "or", "not"].includes(key) ||
    !Array.isArray(value[key]) ||
    value[key].length > 64
  )
    throw new Error("Base 筛选必须是 and、or 或 not 列表");
  const children = value[key].map((child: unknown) => {
    const result = filter(child, depth + 1);
    if (result === undefined) throw new Error("Base 筛选不能为空");
    return result;
  });
  return key === "and"
    ? { and: children }
    : key === "or"
      ? { or: children }
      : { not: children };
}
function dependencies(ast: Expression, found = new Set<string>()): Set<string> {
  switch (ast.type) {
    case "Member":
      if (ast.object.type === "Identifier" && ast.object.name === "formula")
        found.add(ast.property);
      dependencies(ast.object, found);
      break;
    case "Index":
      if (ast.object.type === "Identifier" && ast.object.name === "formula") {
        if (ast.index.type !== "Literal" || typeof ast.index.value !== "string")
          throw new Error("formula 引用必须使用固定名称");
        found.add(ast.index.value);
      }
      dependencies(ast.object, found);
      dependencies(ast.index, found);
      break;
    case "Unary":
      dependencies(ast.argument, found);
      break;
    case "Binary":
      dependencies(ast.left, found);
      dependencies(ast.right, found);
      break;
    case "Call":
      if (ast.callee.type === "Identifier" && !globalCalls.has(ast.callee.name))
        throw new Error("Base 调用了不支持的函数");
      if (ast.callee.type === "Member" && !methodCalls.has(ast.callee.property))
        throw new Error("Base 调用了不支持的方法");
      dependencies(ast.callee, found);
      ast.args.forEach((arg) => dependencies(arg, found));
      break;
    case "List":
      ast.elements.forEach((item) => dependencies(item, found));
      break;
  }
  return found;
}
export function parseMapBase(source: string, viewName?: string): MapBase {
  if (Buffer.byteLength(source) > 65536)
    throw new Error("Base 配置超过 64 KiB");
  const document = parseDocument(source, { schema: "core", uniqueKeys: true });
  if (document.errors.length) throw new Error("Base YAML 无效");
  const data: unknown = document.toJS({ maxAliasCount: 50 });
  if (
    !record(data) ||
    !Array.isArray(data.views) ||
    !data.views.length ||
    data.views.length > 32
  )
    throw new Error("Base 缺少地图视图");
  const view: unknown = viewName
    ? data.views.find((item) => record(item) && item.name === viewName)
    : data.views[0];
  if (!record(view) || view.type !== "map")
    throw new Error("仅支持 map 类型的 Base 视图");
  if (
    typeof view.coordinates !== "string" ||
    !/^(?:note\.|formula\.)?[\p{L}\p{N}_ ./-]+$/u.test(view.coordinates)
  )
    throw new Error("地图缺少有效的 coordinates 属性引用");
  for (const key of ["markerIcon", "markerColor"])
    if (
      view[key] !== undefined &&
      (typeof view[key] !== "string" || !view[key].trim())
    )
      throw new Error(`地图 ${key} 属性引用无效`);
  const formulas: Record<string, string> = Object.create(null);
  if (data.formulas !== undefined) {
    if (!record(data.formulas) || Object.keys(data.formulas).length > 64)
      throw new Error("Base 公式配置无效");
    for (const [name, value] of Object.entries(data.formulas)) {
      expression(value);
      formulas[name] = value as string;
    }
  }
  const order: string[] = [],
    active = new Set<string>(),
    done = new Set<string>();
  function sort(name: string) {
    if (done.has(name)) return;
    if (active.has(name)) throw new Error("Base 公式存在循环引用");
    if (!Object.hasOwn(formulas, name))
      throw new Error("Base 引用了未定义的公式");
    active.add(name);
    for (const dependency of dependencies(expression(formulas[name]).ast))
      sort(dependency);
    active.delete(name);
    done.add(name);
    order.push(name);
  }
  Object.keys(formulas).forEach(sort);
  const rootFilter = filter(data.filters),
    viewFilter = filter(view.filters);
  function checkFilter(node: Filter | undefined) {
    if (typeof node === "string") {
      for (const dependency of dependencies(expression(node).ast))
        sort(dependency);
    } else if (node)
      for (const children of Object.values(node)) children.forEach(checkFilter);
  }
  checkFilter(rootFilter);
  checkFilter(viewFilter);
  for (const key of ["coordinates", "markerIcon", "markerColor"]) {
    const reference = view[key];
    if (typeof reference === "string" && reference.startsWith("formula."))
      sort(reference.slice(8));
  }
  return {
    filters: rootFilter,
    viewFilters: viewFilter,
    formulas,
    formulaOrder: order,
    view,
  };
}
function number(
  view: Record<string, unknown>,
  key: string,
  fallback: number,
  low: number,
  high: number,
) {
  const value = view[key] ?? fallback;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < low ||
    value > high
  )
    throw new Error(`地图 ${key} 超出范围`);
  return value;
}
function tiles(view: Record<string, unknown>) {
  const values = view.mapTiles ?? [
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  ];
  if (!Array.isArray(values) || !values.length || values.length > 4)
    throw new Error("地图瓦片配置无效");
  return values.map((value: unknown) => {
    if (typeof value !== "string") throw new Error("地图瓦片 URL 无效");
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !["{x}", "{y}", "{z}"].every((token) => value.includes(token))
    )
      throw new Error("地图仅支持 HTTPS 栅格瓦片模板，不支持矢量样式 URL");
    return value;
  });
}
export function queryMapBase(
  base: MapBase,
  notes: Note[],
  diagnostics: Diagnostic[],
  source: string,
): MapData {
  // Both the query and file()/asFile() lookup are restricted to discovery data.
  const listed = notes.filter(
    (note) => note.publish === true && !note.unlisted,
  );
  const ids = new Set(listed.map((note) => note.id));
  const contexts = listed.map((note) => {
    const file = {
      name: posix.basename(note.source),
      basename: posix.basename(note.source, ".md"),
      path: note.source,
      folder:
        posix.dirname(note.source) === "." ? "" : posix.dirname(note.source),
      ext: "md",
      tags: [...new Set([...note.tags, ...note.tagMentions])],
      links: note.links.filter((id) => ids.has(id)),
      properties: note.properties,
      created: note.date || undefined,
      modified: note.updated || note.date || undefined,
    };
    return { note, file };
  });
  const lookup = new Map<string, EvalContext["file"]>();
  const basenames = new Map<string, EvalContext["file"][]>();
  for (const { file } of contexts) {
    lookup.set(file.path, file);
    lookup.set(file.path.replace(/\.md$/, ""), file);
    const candidates = basenames.get(file.basename) ?? [];
    candidates.push(file);
    basenames.set(file.basename, candidates);
  }
  for (const [name, candidates] of basenames)
    if (candidates.length === 1 && !lookup.has(name))
      lookup.set(name, candidates[0]);
  const self = {
    file: {
      name: posix.basename(source),
      path: source,
      folder: posix.dirname(source) === "." ? "" : posix.dirname(source),
      ext: "base",
    },
  };
  const view = base.view;
  const minZoom = number(view, "minZoom", 0, 0, 20),
    maxZoom = number(view, "maxZoom", 18, minZoom, 20);
  const data: MapData = {
    name: typeof view.name === "string" ? view.name : "足迹",
    points: [],
    minZoom,
    maxZoom,
    height: number(view, "mapHeight", 480, 100, 2000),
    tiles: tiles(view),
    attribution:
      typeof view.attribution === "string"
        ? view.attribution.slice(0, 512)
        : "© OpenStreetMap contributors",
  };
  if (view.defaultZoom !== undefined)
    data.zoom = number(view, "defaultZoom", 2, minZoom, maxZoom);
  if (view.center !== undefined) {
    const context: EvalContext = {
      note: {},
      file: {
        ...self.file,
        basename: posix.basename(source, ".base"),
        tags: [],
        links: [],
      },
      formula: Object.create(null),
      self,
      _fileLookup: lookup,
    };
    for (const name of base.formulaOrder)
      context.formula[name] = evaluate(base.formulas[name], context);
    if (typeof view.center === "string" && !coordinates(view.center))
      expression(view.center);
    const center =
      coordinates(view.center) ??
      (typeof view.center === "string"
        ? coordinates(evaluate(view.center, context))
        : undefined);
    if (!center) throw new Error("地图 center 坐标或公式无效");
    data.center = center;
  }
  for (const { note, file } of contexts) {
    const context: EvalContext = {
      note: note.properties,
      file,
      formula: Object.create(null),
      self,
      _fileLookup: lookup,
    };
    for (const name of base.formulaOrder) {
      context.formula[name] = evaluate(base.formulas[name], context);
      if (context.formula[name] === undefined)
        diagnostics.push({
          source: note.source,
          code: "map-formula",
          message: `地图公式 ${name} 没有可用结果`,
        });
    }
    if (
      !evaluateFilter(base.filters, context) ||
      !evaluateFilter(base.viewFilters, context)
    )
      continue;
    const value = resolvePropertyValue(view.coordinates as string, context),
      location = coordinates(value);
    if (!location) {
      if (value !== undefined && value !== null && value !== "")
        diagnostics.push({
          source: note.source,
          code: "map-coordinate",
          message: "地图坐标无效，已跳过",
        });
      continue;
    }
    const icon =
      typeof view.markerIcon === "string"
        ? resolvePropertyValue(view.markerIcon, context)
        : undefined;
    const color =
      typeof view.markerColor === "string"
        ? resolvePropertyValue(view.markerColor, context)
        : undefined;
    data.points.push({
      id: note.id,
      title: note.title,
      url: note.url,
      coordinates: location,
      icon:
        typeof icon === "string" && /^[\w-]{1,64}$/.test(icon.trim())
          ? icon.trim().replace(/^lucide-/, "")
          : "map-pin",
      color: markerColor(color),
    });
  }
  return data;
}
export async function readJourneyMap(
  root: string,
  files: Set<string>,
  notes: Note[],
  diagnostics: Diagnostic[],
  source: string,
  viewName?: string,
): Promise<JourneyMap> {
  try {
    safePath(source);
    if (classifyContentPath(source) !== "base" || !files.has(source))
      return { status: "unavailable", message: "足迹地图尚未配置。" };
    const base = await realpath(root),
      target = await realpath(resolve(base, source));
    const outside = relative(base, target);
    if (outside === ".." || outside.startsWith("../"))
      throw new Error("Base 位于内容目录之外");
    const definition = parseMapBase(await readFile(target, "utf8"), viewName);
    return {
      status: "ready",
      data: queryMapBase(definition, notes, diagnostics, source),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "地图配置无效";
    diagnostics.push({ source, code: "map-base", message });
    return { status: "error", message: "足迹地图配置暂时不可用。" };
  }
}
