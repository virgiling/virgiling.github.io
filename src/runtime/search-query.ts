interface SearchRecord {
  title: string;
  tags?: string[];
  summary?: string;
  text?: string;
}
interface PreparedRecord extends SearchRecord {
  searchText: string;
  searchTags: string[];
}
const normalize = (value: unknown) =>
  String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN");
export function prepareRecord<T extends SearchRecord>(
  record: T,
): T & PreparedRecord {
  return {
    ...record,
    searchText: normalize(
      `${record.title} ${(record.tags || []).join(" ")} ${record.summary || ""} ${record.text || ""}`,
    ),
    searchTags: (record.tags || []).map((tag) =>
      normalize(tag).replace(/^#+/, ""),
    ),
  };
}
export function parseQuery(value: string) {
  const text: string[] = [],
    tags: string[] = [];
  for (const token of normalize(value).trim().split(/\s+/).filter(Boolean)) {
    if (token.startsWith("#")) {
      const tag = token.slice(1).replace(/\/+$/, "");
      if (tag) tags.push(tag);
    } else text.push(token);
  }
  return { text, tags };
}
function hasTag(tag: string, query: string) {
  // Full paths/root descendants, or a complete path segment such as #Obsidian.
  return (
    tag === query ||
    tag.startsWith(query + "/") ||
    (!query.includes("/") && tag.split("/").includes(query))
  );
}
export function searchRecords<T extends PreparedRecord>(
  records: T[],
  value: string,
): T[] {
  const query = parseQuery(value);
  return records.filter(
    (record) =>
      query.tags.every((tag) =>
        record.searchTags.some((actual) => hasTag(actual, tag)),
      ) && query.text.every((term) => record.searchText.includes(term)),
  );
}
