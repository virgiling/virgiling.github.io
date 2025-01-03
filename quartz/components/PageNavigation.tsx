import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { pathToRoot, resolveRelative, simplifySlug } from "../util/path"
import style from "./styles/pageNavigation.scss"
import { i18n } from "../i18n"
import { classNames } from "../util/lang"
import { QuartzPluginData } from "../plugins/vfile"
import { getDate } from "./Date"

export type SortFn = (f1: QuartzPluginData, f2: QuartzPluginData) => number

interface Options {
    showTitle: boolean
    sort: (f1: QuartzPluginData, f2: QuartzPluginData) => number
}

const defaultOptions = (): Options => ({
    showTitle: true,
    sort: defaultSort()
})

function defaultSort(): SortFn {
    return (f1, f2) => {
        if (f1.slug === undefined || f2.slug === undefined) {
            return 1
        }
        const slugA = f1.slug.toString() ?? ""
        const slugB = f2.slug.toString() ?? ""
        if (slugA === "index") return -1
        if (slugB === "index") return 1

        // Get paths and split into segments
        const pathA = simplifySlug(f1.slug).split("/")
        const pathB = simplifySlug(f2.slug).split("/")

        // Root files (except index) should be first
        const isRootA = pathA.length === 1
        const isRootB = pathB.length === 1
        if (isRootA && !isRootB) return -1
        if (!isRootA && isRootB) return 1

        // Compare full paths for non-root files
        if (f1.dates && f2.dates) {
            return f2.dates.modified!.getTime() - f1.dates.modified!.getTime()
        } else if (f1.dates && !f2.dates) {
            // prioritize files with dates
            return -1
        } else if (!f1.dates && f2.dates) {
            return 1
        }

        // otherwise, sort lexographically by title
        const f1Title = f1.frontmatter?.title.toLowerCase() ?? ""
        const f2Title = f2.frontmatter?.title.toLowerCase() ?? ""
        return f1Title.localeCompare(f2Title)
    }
}

export default ((userOpts?: Partial<Options>) => {
    const PageNavigation: QuartzComponent = ({
        allFiles,
        fileData,
        displayClass,
        cfg,
    }: QuartzComponentProps) => {
        const opts = { ...defaultOptions(), ...userOpts }

        // Filter and sort pages
        const pages = allFiles
            .filter(page => {
                // Only filter out tags directory
                const slug = page.slug?.toString() ?? ""
                const tags = !slug.startsWith("tags/")
                let folder = false
                if (page.slug) {
                    const path = simplifySlug(page.slug).split("/")
                    folder = path.length !== 1
                }
                return tags || folder
            })
            .sort(opts.sort)

        // Find current page index
        const currentIndex = pages.findIndex((page) => page.slug === fileData.slug)
        if (currentIndex === -1) return null

        const prevPage = currentIndex > 0 ? pages[currentIndex - 1] : null
        const nextPage = currentIndex < pages.length - 1 ? pages[currentIndex + 1] : null

        // For the last page, add a link to the index page
        const isLastPage = currentIndex === pages.length - 1
        const indexPage = isLastPage ? pages.find(page => page.slug === "index") : null

        return (
            <div class={classNames(displayClass, "page-navigation")}>
                <div class="page-navigation-content">
                    {prevPage && (
                        <a href={resolveRelative(fileData.slug!, prevPage.slug!)} class="prev">
                            <span class="prev-label">← {i18n(cfg.locale).components.pageNavigation?.prevPage ?? "Previous"}</span>
                            {opts.showTitle && <span class="nav-page-title">{prevPage.frontmatter?.title}</span>}
                        </a>
                    )}
                    {(nextPage || (isLastPage && indexPage)) && (
                        <a
                            href={resolveRelative(fileData.slug!, (nextPage || indexPage)!.slug!)}
                            class="next"
                        >
                            <span class="next-label">
                                {isLastPage && indexPage
                                    ? "回到首页 →"
                                    : `${i18n(cfg.locale).components.pageNavigation?.nextPage ?? "Next"} →`
                                }
                            </span>
                            {opts.showTitle && (
                                <span class="nav-page-title">
                                    {(nextPage || indexPage)!.frontmatter?.title}
                                </span>
                            )}
                        </a>
                    )}
                </div>
            </div>
        )
    }

    PageNavigation.css = style
    return PageNavigation
}) satisfies QuartzComponentConstructor