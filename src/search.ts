import { Index } from "flexsearch";
import {
  parseQuery,
  prepareRecord,
  searchRecords,
} from "./runtime/search-query.js";
export interface SearchRecord {
  id: string;
  url: string;
  title: string;
  aliases: string[];
  summary: string;
  tags: string[];
  text?: string;
}
export const normalize = (s: string) =>
  s.normalize("NFKC").toLocaleLowerCase("zh-CN");
export function encode(value: string) {
  const tokens: string[] = [];
  for (const word of normalize(value).match(
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+|[\p{L}\p{N}]+/gu,
  ) || []) {
    if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(word)) {
      const chars = [...word];
      tokens.push(...chars);
      for (let i = 0; i < chars.length - 1; i++)
        tokens.push(chars[i] + chars[i + 1]);
    } else tokens.push(word);
  }
  return tokens;
}
const makeIndex = () =>
  new Index({ encode, tokenize: "forward", resolution: 9 });
export async function exportSearch(records: SearchRecord[]) {
  const title = makeIndex(),
    body = makeIndex();
  for (const record of records) {
    title.add(record.id, record.title + " " + record.aliases.join(" "));
    body.add(record.id, record.text || record.summary);
  }
  const titleData: Record<string, string> = {},
    bodyData: Record<string, string> = {};
  await Promise.resolve(
    title.export((key, value) => {
      titleData[key] = value;
    }),
  );
  await Promise.resolve(
    body.export((key, value) => {
      bodyData[key] = value;
    }),
  );
  return {
    version: 1,
    records: records.map(({ text, ...record }) => record),
    title: titleData,
    body: bodyData,
  };
}
export function importSearch(data: Awaited<ReturnType<typeof exportSearch>>) {
  if (data.version !== 1) throw new Error("Unsupported search version");
  const title = makeIndex(),
    body = makeIndex(),
    records = data.records.map(prepareRecord);
  for (const [key, value] of Object.entries(data.title))
    title.import(key, value);
  for (const [key, value] of Object.entries(data.body)) body.import(key, value);
  return (value: string) => {
    const query = parseQuery(value),
      scores = new Map<string, number>();
    let candidates: Set<string> | undefined;
    for (const term of query.text) {
      const ranked = [
          ...title.search(term, { limit: records.length }),
          ...body.search(term, { limit: records.length }),
        ].map(String),
        matches = new Set(ranked);
      ranked.forEach((id, i) => scores.set(id, (scores.get(id) || 0) + i));
      candidates = candidates
        ? new Set([...candidates].filter((id) => matches.has(id)))
        : matches;
    }
    return searchRecords(records, query.tags.map((t) => "#" + t).join(" "))
      .filter((r: SearchRecord) => !candidates || candidates.has(r.id))
      .sort(
        (a: SearchRecord, b: SearchRecord) =>
          (scores.get(a.id) || 0) - (scores.get(b.id) || 0),
      )
      .slice(0, 100);
  };
}
