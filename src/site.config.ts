import { z } from "astro/zod";

const schema = z.object({
  site: z.url(),
  base: z.string().regex(/^\/(?:[\w-]+\/)*$/),
  brand: z.object({
    mark: z.string(),
    name: z.string(),
    byline: z.string(),
    author: z.string(),
    motto: z.string(),
  }),
  footer: z.object({ github: z.url() }),
  reading: z.object({
    cjkPerMinute: z.number().positive(),
    wordsPerMinute: z.number().positive(),
  }),
  archive: z.object({ rootOrder: z.array(z.string()) }),
  home: z.object({
    recentCount: z.number().int().positive(),
    heatmapWeeks: z.number().int().positive(),
  }),
  freshness: z.object({
    enabled: z.boolean(),
    checkPaths: z.array(z.string()),
    staleThreshold: z.number().int().nonnegative(),
  }),
  comments: z.object({
    enabled: z.boolean(),
    repo: z.string(),
    repoId: z.string(),
    category: z.string(),
    categoryId: z.string(),
  }),
});
export const siteConfig = schema.parse({
  site: "https://virgiling.wiki",
  base: process.env.SITE_BASE || "/",
  brand: {
    mark: "栞",
    name: "忘れてください",
    byline: "",
    author: "Dian 'Virgil' Ling",
    motto: "Not all those who wander are lost.",
  },
  footer: { github: "https://github.com/virgiling" },
  reading: { cjkPerMinute: 300, wordsPerMinute: 200 },
  archive: { rootOrder: ["01-courses", "03-tools"] },
  home: { recentCount: 1, heatmapWeeks: 26 },
  freshness: {
    enabled: true,
    checkPaths: ["01-courses/", "03-tools/"],
    staleThreshold: 365,
  },
  // Local and deployed pages read the same title-matched discussions. Enabling
  // the reader does not authorize automated login, posting or deployment.
  comments: {
    enabled: true,
    repo: "virgiling/virgiling.github.io",
    repoId: "R_kgDONbWvng",
    category: "Announcements",
    categoryId: "DIC_kwDONbWvns4ClFkN",
  },
});
export const url = (path = "") => siteConfig.base + path.replace(/^\//, "");
export const canonical = (path = "") =>
  new URL(url(path), siteConfig.site).href;
// Discussion backlinks must point to the public URL, never a preview prefix.
export const discussionURL = (route = "") =>
  new URL("/" + route.replace(/^\/+/, ""), siteConfig.site).href;
export const navigation = [
  { id: "home", label: "主页", url: url("") },
  { id: "articles", label: "文章", url: url("articles") },
  { id: "journey", label: "足迹", url: url("journey") },
  { id: "friends", label: "友链", url: url("link") },
  { id: "about", label: "关于", url: url("about") },
];
