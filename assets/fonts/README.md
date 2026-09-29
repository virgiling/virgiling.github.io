# 字体输入

本目录随项目提供给本地或服务器构建；原始 TTF/OTF 不直接发布到 `dist/`。

- `wenkai-lite-regular.ttf`：LXGW WenKai Lite 1.522 Regular，OFL。
- `LinBiolinum_R.otf` / `LinBiolinum_RB.otf`：Linux Biolinum O 1.1.8 / 1.3.2，OFL。
- `biro-script-plus.woff2`：作者提供的原始 Biro Script Plus 6.001，284,772 B；**不属于 OFL**，不子集化、不转换，使用需具备相应的 Webfont 许可。SHA256：`e2448f3e978a17f04c78701e1d9565bd74c2275f58e7d315ef258ecf3ca40619`。

OFL 来源、字重与校验值固定在 `scripts/fonts/sources.json`；许可和版权见 `public/fonts/OFL-LXGW.txt`、`OFL-LinuxBiolinum.txt`。不得用 main/latest 下载静默替换源文件。修改后的 OFL 字体使用 Notes CJK / Notes Latin 内部名称。

`bun run fonts:build` 生成 `src/fonts/generated/`（dev/build 也自动校验）；`fonts:verify` 检查字表、字重与哈希；`fonts:clean` 显式删除旧代产物，不与生成任务并行。Biro 直接通过 `src/fonts.ts` 和字体路由提供，不参与 OFL 子集流程。

工具与部署说明见根目录 [README](../../README.md)，设计取舍见 [迁移文稿](../../docs/design-review.md#6-图片与字体布局正确不代表资源正确)。
