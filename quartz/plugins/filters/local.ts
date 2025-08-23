import { QuartzFilterPlugin } from "../types"

export const RemoveLocal: QuartzFilterPlugin<{}> = () => ({
    name: "RemoveDiary",
    shouldPublish(_ctx, [_tree, vfile]) {
        const localFlag: boolean = vfile.data.frontmatter?.tags?.includes("Local") || false
        return !localFlag
    },
})
