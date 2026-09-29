import { url } from "../site.config";

// XML feeds/sitemaps still need explicit serialization. Astro templates escape text themselves.
const entities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
export const esc = (value: unknown) =>
  String(value).replace(/[&<>"']/g, (character) => entities[character]);
export const folderId = (path: string) =>
  "folder-" + (path ? Buffer.from(path).toString("hex") : "root");
export const folderFrameId = (path: string) => "frame-" + folderId(path);
export const tagURL = (tag: string) =>
  url(`tags/${Buffer.from(tag).toString("hex")}`);
