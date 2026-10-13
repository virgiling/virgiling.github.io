import { getSnapshot } from "../content/snapshot";
import { canonical, siteConfig } from "../site.config";
import { buildArchivePagination, archiveRoute } from "../ui/archive-pagination";
import { buildTags } from "../ui/tags";
import { esc } from "../ui/shared";
export async function GET() {
  const { listed, directories } = await getSnapshot();
  const archive = buildArchivePagination(listed, {
    ...siteConfig.archive,
    directories,
  });
  const routes = [
    ...listed.map((n) => ({ path: n.route, date: n.updated || n.date })),
    ...[
      "articles",
      ...archive.pages.slice(1).map((_, i) => archiveRoute(i + 1)),
      "updates",
      "journey",
      ...buildTags(listed).map(
        (g) => "tags/" + Buffer.from(g.tag).toString("hex"),
      ),
    ].map((path) => ({ path, date: "" })),
  ];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((n) => `<url><loc>${esc(canonical(n.path))}</loc>${n.date ? `<lastmod>${n.date}</lastmod>` : ""}</url>`).join("")}</urlset>`,
    { headers: { "Content-Type": "application/xml" } },
  );
}
