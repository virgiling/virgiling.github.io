import { getSnapshot } from "../content/snapshot";
import { canonical } from "../site.config";
import { buildTags } from "../ui/tags";
import { esc } from "../ui/shared";
export async function GET() {
  const { listed } = await getSnapshot();
  const routes = [
    ...listed.map((n) => ({ path: n.route, date: n.updated || n.date })),
    ...[
      "articles",
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
