import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [Component.PageNavigation()],
  footer: Component.Comments({
    provider: "giscus",
    options: {
      repo: "virgiling/virgiling.github.io",
      repoId: "R_kgDONbWvng",
      category: "Announcements",
      categoryId: "DIC_kwDONbWvns4ClFkN",
      lang: "zh-CN",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs({
        rootName: "主页",
      }),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.DesktopOnly(Component.RecentNotes({ limit: 2, showTags: false })),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.ReaderMode() },
      ],
    }),
    Component.DesktopOnly(
      Component.FloatingButtons({
        position: "right",
      }),
    ),
    Component.Explorer(),
  ],
  right: [
    Component.Graph({ globalGraph: { fontSize: 0.4 } }),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs({
      rootName: "主页",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Search(),
    Component.Explorer({}),
    Component.DesktopOnly(
      Component.FloatingButtons({
        position: "right",
      }),
    ),
  ],
  right: [
    Component.Graph({ globalGraph: { fontSize: 0.4 } }),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}
