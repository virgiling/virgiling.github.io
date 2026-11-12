import LZString from "lz-string";

export const rectangle = {
  id: "rectangle",
  type: "rectangle",
  x: 0,
  y: 0,
  width: 160,
  height: 100,
  angle: 0,
  strokeColor: "#1e1e1e",
  backgroundColor: "transparent",
  fillStyle: "solid",
  strokeWidth: 2,
  strokeStyle: "solid",
  roughness: 1,
  opacity: 100,
  seed: 42,
  version: 1,
  versionNonce: 1,
  isDeleted: false,
  groupIds: [],
  frameId: null,
  roundness: null,
  boundElements: null,
  updated: 0,
  link: null,
  locked: false,
  index: null,
};
export const sampleScene = {
  type: "excalidraw",
  version: 2,
  source: "fixture",
  elements: [
    rectangle,
    {
      ...rectangle,
      id: "text",
      type: "text",
      x: 20,
      y: 30,
      width: 100,
      height: 25,
      text: "Example 示例",
      originalText: "Example 示例",
      fontSize: 20,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "top",
      containerId: null,
      autoResize: true,
      lineHeight: 1.25,
    },
  ],
  appState: {},
  files: {},
};
export const formulaScene = {
  ...sampleScene,
  elements: [
    ...sampleScene.elements,
    {
      ...rectangle,
      id: "formula-image",
      type: "image",
      fileId: "formula-file",
      x: 180,
      y: 20,
      width: 80,
      height: 30,
      scale: [1, 1],
      status: "saved",
    },
  ],
};
export function drawingMarkdown(
  scene: unknown = sampleScene,
  compressed = true,
  equations: Record<string, string> = {},
) {
  const json = JSON.stringify(scene);
  const embedded = Object.entries(equations)
    .map(([id, latex]) => `${id}: $$${latex}$$`)
    .join("\n\n");
  return `---\nexcalidraw-plugin: parsed\n---\nPRIVATE_NOTE_CANARY\n\n# Text Elements\nPRIVATE_METADATA_CANARY\n\n${embedded ? `## Embedded Files\n${embedded}\n\n` : ""}%%\n# Drawing\n\`\`\`${compressed ? "compressed-json" : "json"}\n${
    compressed
      ? LZString.compressToBase64(json)
          .match(/.{1,60}/g)!
          .join("\n\n")
      : json
  }\n\`\`\`\n%%\n`;
}
