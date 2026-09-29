import { z } from "astro/zod";
import { publicURL } from "./urls";
const url = z.string().refine((value) => !!publicURL(value));
const snapshot = z.object({
  version: z.literal(1),
  savedAt: z.iso.datetime(),
  results: z.array(
    z.object({
      key: z.string(),
      checkedAt: z.iso.datetime(),
      updatedAt: z.iso.datetime().optional(),
      status: z.enum(["ok", "stale", "unavailable", "disabled"]),
      posts: z
        .array(
          z.object({
            title: z.string(),
            url,
            date: z.iso.datetime(),
            author: z.string(),
            authorUrl: url,
          }),
        )
        .max(12),
    }),
  ),
});
export function parseFeedCache(source: string, expectedKeys?: string[]) {
  try {
    const saved = snapshot.parse(JSON.parse(source));
    if (
      expectedKeys &&
      (saved.results.length !== expectedKeys.length ||
        saved.results.some((result, i) => result.key !== expectedKeys[i]))
    )
      return undefined;
    return saved;
  } catch {
    return undefined;
  }
}
