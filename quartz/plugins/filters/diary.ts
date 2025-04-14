import { QuartzFilterPlugin } from "../types"

export const RemoveDiary: QuartzFilterPlugin<{}> = () => ({
  name: "RemoveDiary",
  shouldPublish(_ctx, [_tree, vfile]) {
    const diaryFlag: boolean = false || vfile.path.includes("Daily") || vfile.path.includes("daily")
    return !diaryFlag
  },
})
