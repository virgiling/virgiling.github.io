# 开发约定

## 项目结构

- Astro 负责路由与静态输出；内容编译位于 `src/content/`、`src/markdown/`，交互位于 `src/runtime/`。
- 使用 Bun 和现有锁文件。依赖变更同步 `package.json`、`bun.lock`，检查 `patches/` 中的补丁兼容性。
- 修改源码而非 `dist/`、`.astro/` 或 `src/fonts/generated/` 等生成文件。

## 内容与交互契约

- `content/` 是 Git submodule；生产构建要求内容 HEAD 与 gitlink 一致且工作树干净。
- 仅 `publish:true` 生成页面；`draft` 不替代发布标记。unlisted 可直链，但不进入列表、搜索、全局图谱、RSS/sitemap；可在自身页面的局部图中作为当前节点。
- 保留硬忽略、符号链接拒绝与资源允许集合，避免将未发布内容带入产物。
- 保留来源路径与正式文章 URL 的 giscus 身份；开发端口与 base 不改变讨论键。
- 有时长的界面效果统一通过共享 Motion，支持取消、销毁及运行时 reduced motion。直接操控与即时可见性校正不额外插值。
- 样式沿用 Tailwind 与现有语义组件，保留 Markdown 和图谱的专用 CSS。
- 字体输入位于 `assets/fonts/`；OFL 分片由固定来源生成，Biro 保留原始字节与 OpenType。`fonts:clean` 不与字体生成并行。

## 检查与文档

- 修复缺陷时补充回归测试，沿用现有测试工具。
- `bun run validate` 执行类型检查、测试、构建与静态产物检查；路径、字体或开发模块变更另检查 `verify:http` / `verify:dev`。
- 区分单元测试、HTTP、资源体积与浏览器性能证据，不从一种检查推断另一种结果。
- 设计与行为变更同步到 `docs/design-review.md` 的相关技术章节。
- README、设计文稿和源码说明面向公开项目；不包含私人工作区、agent 操作限制、服务进程、授权记录或内部会话信息。
- 若本机存在未跟踪的 `.pi/maintenance.md`，先读取其补充约定；不将其中内容写回公开代码、文档或 Git 记录。
