import LZString from "lz-string";
import { drawingFormulas, formulaImage } from "./drawing-formulas";

const elementFields = new Set(
  (
    "id type x y width height angle strokeColor backgroundColor fillStyle " +
    "strokeWidth strokeStyle roughness opacity seed groupIds frameId roundness " +
    "boundElements version versionNonce index locked points startBinding endBinding " +
    "startArrowhead endArrowhead elbowed fixedSegments startIsSpecial endIsSpecial " +
    "text originalText fontSize fontFamily textAlign verticalAlign containerId " +
    "autoResize lineHeight baseline fileId scale crop status name " +
    "pressures simulatePressure lastCommittedPoint"
  ).split(" "),
);
const elementTypes = new Set([
  "rectangle",
  "diamond",
  "ellipse",
  "line",
  "arrow",
  "freedraw",
  "text",
  "image",
  "frame",
]);
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

// Do not run ordinary Markdown comment removal: Obsidian stores its Drawing
// section inside %% comments. Only the scene is public, never the surrounding note.
export function drawingScene(source: string, markdown: boolean): string {
  let json = source;
  if (markdown) {
    const drawing = /^#{1,2} Drawing\s*\r?$/m.exec(source);
    const fence =
      drawing &&
      /^```(json|compressed-json)\s*\r?\n([\s\S]*?)^```\s*\r?$/m.exec(
        source.slice(drawing.index + drawing[0].length),
      );
    if (!fence) throw new Error("Missing Excalidraw Drawing section");
    json =
      fence[1] === "json"
        ? fence[2]
        : LZString.decompressFromBase64(fence[2].replace(/\s/g, ""));
    if (!json) throw new Error("Invalid compressed Excalidraw scene");
  }
  const scene: unknown = JSON.parse(json);
  if (
    !record(scene) ||
    scene.type !== "excalidraw" ||
    !Array.isArray(scene.elements)
  )
    throw new Error("Invalid Excalidraw scene");
  const elements: Record<string, unknown>[] = [];
  const fileIds = new Set<string>();
  for (const element of scene.elements) {
    if (!record(element)) throw new Error("Invalid Excalidraw element");
    if (element.isDeleted === true) continue;
    if (!elementTypes.has(String(element.type)))
      throw new Error("Unsupported Excalidraw element type");
    if (
      ![element.x, element.y, element.width, element.height].every(
        (value) => typeof value === "number" && Number.isFinite(value),
      )
    )
      throw new Error("Invalid Excalidraw element bounds");
    if (element.type === "image") {
      if (typeof element.fileId !== "string")
        throw new Error("Missing drawing image");
      fileIds.add(element.fileId);
    }
    // Strip customData, links and deleted elements rather than publish editor
    // metadata, vault paths or invisible deleted text alongside the visible scene.
    elements.push({
      ...Object.fromEntries(
        Object.entries(element).filter(([key]) => elementFields.has(key)),
      ),
      isDeleted: false,
      ...(element.type === "text" ? { originalText: element.text } : {}),
    });
  }
  const files: Record<string, unknown> = {};
  const formulas = markdown
    ? drawingFormulas(source)
    : new Map<string, string>();
  for (const id of fileIds) {
    const latex = formulas.get(id);
    if (latex !== undefined) {
      files[id] = { id, ...formulaImage(latex), created: 0 };
      continue;
    }
    const file = record(scene.files) ? scene.files[id] : undefined;
    if (
      !record(file) ||
      typeof file.dataURL !== "string" ||
      !/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z\d+/=\s]+$/i.test(
        file.dataURL,
      )
    )
      throw new Error(
        "Missing embedded drawing image or unsupported external resource",
      );
    files[id] = {
      id,
      dataURL: file.dataURL,
      mimeType: file.dataURL.slice(5).split(";")[0],
      created: 0,
    };
  }
  return JSON.stringify({
    type: "excalidraw",
    version: 2,
    elements,
    files,
    appState: {},
  });
}
