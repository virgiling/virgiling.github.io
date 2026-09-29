import type { Note } from "../content/types";

export type ArticleSummary = Pick<
  Note,
  "slug" | "url" | "title" | "summary" | "tags" | "date" | "updated"
>;
export type CatalogNote = ArticleSummary &
  Pick<Note, "source"> &
  Partial<Pick<Note, "kind" | "unlisted" | "isDirectoryIndex">> & {
    publish?: boolean;
  };
