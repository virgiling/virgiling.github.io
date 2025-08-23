import { QuartzFilterPlugin } from "../types"

export const RemoveDiary: QuartzFilterPlugin<{}> = () => ({
  name: "RemoveDiary",
  shouldPublish(_ctx, [_tree, vfile]) {
    const diaryFlag: boolean = vfile.data.frontmatter?.tags?.includes("日记") || false
    return !diaryFlag
  },
})
