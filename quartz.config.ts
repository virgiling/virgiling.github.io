import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "また夏を追う",
    pageTitleSuffix: " | 思想犯",
    enableSPA: true,
    enablePopovers: true,
    analytics: null,
    locale: "zh-CN",
    baseUrl: "virgiling.wiki",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "created",
    theme: {
      fontOrigin: "local",
      cdnCaching: false,
      typography: {
        header: "LXGW WenKai Screen R",
        body: "LXGW WenKai Screen R",
        code: "Monaco",
      },
      colors: {
        lightMode: {
          light: "#faf8f8",
          lightgray: "#ebe6e0",
          gray: "#c0b8b0",
          darkgray: "#111",
          dark: "#2b2b2b",
          secondary: "#943BB3",
          tertiary: "#8fb5ac",
          highlight: "#c4d7c472",
          textHighlight: "#d6b0b1",
        },
        darkMode: {
          light: "#161618",
          lightgray: "#393639",
          gray: "#646464",
          darkgray: "#d4d4d4",
          dark: "#ebebec",
          secondary: "#7b97aa",
          tertiary: "#84a59d",
          highlight: "rgba(143, 159, 169, 0.15)",
          textHighlight: "#b3aa0288",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.Poetry(),
      Plugin.Latex({ renderEngine: "katex" }),
      Plugin.SyntaxHighlighting(),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest", lazyLoad: true }),
      Plugin.Citations({ bibliographyFile: "./content/ref.bib", csl: "chicago" }),
      Plugin.Description({ descriptionLength: 60 }),
      Plugin.ViewImage(),
    ],
    filters: [Plugin.RemoveDrafts(), Plugin.RemoveDiary(), Plugin.RemoveLocal()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: false,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // Comment out CustomOgImages to speed up build time
      // Plugin.CustomOgImages(),
    ],
  },
}

export default config
