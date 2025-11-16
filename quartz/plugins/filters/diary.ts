import { QuartzFilterPlugin } from "../types"

export const RemoveDiary: QuartzFilterPlugin<{}> = () => ({
  name: "RemoveDiary",
  shouldPublish(_ctx, [_tree, vfile]) {
    const diaryFlag: boolean = vfile.data.filePath?.includes("10-daily") || false
    const projectFlag: boolean = vfile.data.filePath?.includes("05-project") || false
    return !diaryFlag && !projectFlag
  },
})
