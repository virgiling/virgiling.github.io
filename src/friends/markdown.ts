import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";
import { visit } from "unist-util-visit";
import { publicURL } from "./urls";

export interface Friend {
  // The person's display name and bio come only from the Markdown table.
  name: string;
  url: string;
  bio: string;
  avatar?: string;
  rss?: string | null;
}
export function plainText(node: any): string {
  if (node.tagName === "script" || node.tagName === "style") return "";
  return node.value ?? (node.children || []).map(plainText).join("");
}
export function parseFriendLinks(html: string) {
  const tree = fromHtml(html, { fragment: true });
  const friends: Friend[] = [],
    seen = new Set<string>();
  visit(tree, "element", (table: any, index, parent: any) => {
    if (table.tagName !== "table" || index === undefined || !parent) return;
    const rows: any[] = [];
    visit(table, "element", (node: any) => {
      if (node.tagName === "tr") rows.push(node);
    });
    const cells = (row: any) =>
      row.children.filter((n: any) => ["th", "td"].includes(n.tagName));
    const headers = cells(rows[0] || { children: [] }).map((cell: any) =>
      plainText(cell).trim().toLowerCase(),
    );
    const column = (...names: string[]) =>
      headers.findIndex((header: string) => names.includes(header));
    const linkColumn = column("链接", "url", "link");
    if (linkColumn < 0) return;
    let valid = false;
    for (const row of rows.slice(1)) {
      const values = cells(row),
        linkCell = values[linkColumn];
      const first = (cell: any, tag: string, attr: string) => {
        let result = "";
        if (cell)
          visit(cell, "element", (n: any) => {
            if (!result && n.tagName === tag)
              result = String(n.properties[attr] || "");
          });
        return result;
      };
      const text = (i: number) =>
        values[i] ? plainText(values[i]).trim() : "";
      const rawURL = first(linkCell, "a", "href") || text(linkColumn);
      const url = publicURL(rawURL);
      if (!url) continue;
      valid = true;
      if (seen.has(url)) continue;
      seen.add(url);
      const rssColumn = column("rss", "feed", "订阅");
      const rssText = text(rssColumn);
      const rss =
        rssText === "-"
          ? null
          : publicURL(first(values[rssColumn], "a", "href") || rssText, url);
      const avatarColumn = column("头像", "avatar");
      const avatar = publicURL(
        first(values[avatarColumn], "img", "src") ||
          first(values[avatarColumn], "a", "href") ||
          text(avatarColumn),
        url,
      );
      friends.push({
        name:
          text(column("姓名", "昵称", "名称", "站点", "name")) ||
          text(linkColumn) ||
          new URL(url).hostname,
        url,
        bio: text(column("简介", "个人简介", "描述", "bio")),
        ...(avatar && text(avatarColumn) !== "-" ? { avatar } : {}),
        ...(rssText ? { rss: rss ?? null } : {}),
      });
    }
    if (valid) {
      parent.children.splice(index, 1);
      return index;
    }
  });
  return { friends, html: toHtml(tree) };
}
