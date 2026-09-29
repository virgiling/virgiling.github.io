import Parser from "rss-parser";
import { fromHtml } from "hast-util-from-html";
import { plainText, type Friend } from "./markdown";
import { publicURL } from "./urls";
import { readPublicText } from "./network";

export interface FriendPost {
  title: string;
  url: string;
  date: string;
  author: string;
  authorUrl: string;
}
export interface FeedResult {
  key: string;
  checkedAt: string;
  updatedAt?: string;
  status: "ok" | "stale" | "unavailable" | "disabled";
  posts: FriendPost[];
}
export const friendKey = (friend: Friend) =>
  JSON.stringify([friend.url, friend.rss?.trim() || null]);
export async function parseFeed(
  xml: string,
  base: string,
  friend: Friend,
  now = Date.now(),
) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error("Feed declarations are not supported");
  const feed = await new Parser().parseString(xml);
  const seen = new Set<string>(),
    posts: FriendPost[] = [];
  for (const item of feed.items || []) {
    const url = publicURL(item.link || "", base);
    const timestamp = Date.parse(item.isoDate || item.pubDate || "");
    const title = plainText(fromHtml(item.title || "", { fragment: true }))
      .trim()
      .slice(0, 240);
    if (
      !url ||
      !title ||
      !Number.isFinite(timestamp) ||
      timestamp > now + 86400000 ||
      seen.has(url)
    )
      continue;
    seen.add(url);
    posts.push({
      url,
      title,
      date: new Date(timestamp).toISOString(),
      author: friend.name,
      authorUrl: friend.url,
    });
  }
  return posts
    .sort((a, b) => b.date.localeCompare(a.date) || a.url.localeCompare(b.url))
    .slice(0, 12);
}
export async function syncFriendFeeds(
  friends: Friend[],
  previous: FeedResult[] = [],
  read = readPublicText,
  now = Date.now(),
) {
  const checkedAt = new Date(now).toISOString();
  async function sync(friend: Friend): Promise<FeedResult> {
    const key = friendKey(friend);
    const rss = friend.rss?.trim();
    // Missing metadata is intentional. Do not fetch homepages or guess feed paths.
    if (!rss) return { key, checkedAt, status: "disabled", posts: [] };
    if (!publicURL(friend.url) || !publicURL(rss))
      return { key, checkedAt, status: "unavailable", posts: [] };
    try {
      const response = await read(rss, AbortSignal.timeout(20000));
      const posts = await parseFeed(response.text, response.url, friend, now);
      return { key, checkedAt, updatedAt: checkedAt, status: "ok", posts };
    } catch {
      /* Only an explicitly configured feed can use its own previous snapshot. */
    }
    const prior = previous.find(
      (result) => result.key === key && result.posts.length,
    );
    return {
      key,
      checkedAt,
      ...(prior?.updatedAt ? { updatedAt: prior.updatedAt } : {}),
      status: prior ? "stale" : "unavailable",
      posts:
        prior?.posts.map((post) => ({
          ...post,
          author: friend.name,
          authorUrl: friend.url,
        })) || [],
    };
  }
  // At most two sites in flight; input and output keep Markdown order.
  const results: FeedResult[] = new Array(friends.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(2, friends.length) }, async () => {
      while (cursor < friends.length) {
        const index = cursor++;
        results[index] = await sync(friends[index]);
      }
    }),
  );
  return results;
}
export function circlePosts(results: FeedResult[]) {
  const posts = results
    .flatMap((result) => result.posts)
    .sort((a, b) => b.date.localeCompare(a.date) || a.url.localeCompare(b.url));
  const seen = new Set<string>();
  return posts
    .filter((post) => {
      if (seen.has(post.url)) return false;
      seen.add(post.url);
      return true;
    })
    .slice(0, 10);
}
