import { QuartzFilterPlugin } from "../types"

export const RemoveLocal: QuartzFilterPlugin<{}> = () => ({
    name: "RemoveLocal",
    shouldPublish(_ctx, [_tree, vfile]) {
        const localFlag: boolean = vfile.data.frontmatter?.tags?.includes("Local") || false
        const draw: boolean = vfile.data.filePath?.includes("Excalidraw") || false
        const private_file: boolean = vfile.data.filePath?.includes("private") || false
        const task: boolean = vfile.data.filePath?.includes("task") || false
        return !localFlag && !draw && !private_file && !task
    },
})
