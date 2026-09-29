import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import type { Friend } from "./markdown";
import { syncFriendFeeds, friendKey, type FeedResult } from "./feeds";
import { parseFeedCache } from "./cache";
const pending = new Map<string, Promise<FeedResult[]>>();
const directory = resolve(".astro/friends");
export async function friendSnapshot(
  friends: Friend[],
  refresh = process.env.FRIENDS_REFRESH === "1",
) {
  const key = createHash("sha256")
    .update(JSON.stringify(friends))
    .digest("hex");
  if (!pending.has(key))
    pending.set(
      key,
      (async () => {
        const file = join(directory, key + ".json");
        let previous: FeedResult[] = [],
          savedAt = 0;
        try {
          const saved = parseFeedCache(
            await readFile(file, "utf8"),
            friends.map(friendKey),
          );
          if (saved) {
            previous = saved.results;
            savedAt = Date.parse(saved.savedAt);
          }
        } catch {
          /* First build or invalid local cache. */
        }
        const age = Date.now() - savedAt;
        if (!refresh && age >= 0 && age < 6 * 60 * 60 * 1000) return previous;
        const results = await syncFriendFeeds(friends, previous);
        await mkdir(directory, { recursive: true });
        const temporary = join(directory, key + `.${process.pid}.tmp`);
        await writeFile(
          temporary,
          JSON.stringify({
            version: 1,
            savedAt: new Date().toISOString(),
            results,
          }),
        );
        await rename(temporary, file);
        const configured = friends.filter((friend) =>
          friend.rss?.trim(),
        ).length;
        console.log(
          configured
            ? `[friends] ${results.filter((r) => r.status === "ok").length}/${configured} configured feeds available`
            : "[friends] No RSS URLs configured; no feed requests.",
        );
        return results;
      })().finally(() => pending.delete(key)),
    );
  return pending.get(key)!;
}
