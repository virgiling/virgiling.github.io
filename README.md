# 栞 · 忘れてください

基于 Astro 的个人博客，支持 Obsidian 风格笔记、双链、图谱、搜索和评论。迁移过程与设计决定见[设计文稿](docs/design-review.md)。

## 运行

使用 Node **24.19.0**、Bun **1.3.11**；精确依赖见 `package.json` / `bun.lock`。首次制作字体需要 `uv`，也可设置 `FONT_PYTHON` 指向安装了 `scripts/fonts/requirements.txt` 的 Python。

```sh
git submodule update --init --recursive  # 需要内容仓库读取权限；检出已记录的提交
bun install --frozen-lockfile
bun run dev                           # http://localhost:4321，不自动打开浏览器
bun run validate                      # 类型检查、Node 测试、构建、静态产物检查
```

`content/` 是独立内容仓库，不是模板源码的一部分。生产构建仅使用其中的固定版本，要求它与主仓库记录的 gitlink 一致且工作树干净，不自动获取远端最新内容。`publish:true` 才发布；unlisted 只可直链访问，不进入发现入口。

## 主要能力

- 双链、别名解析、标题/块链接和嵌入，Callout、脚注、图片说明、poetry、Shiki、MathJax、安全 HTML。
- 浅色响应式阅读布局，目录归档与 MoC 入口、标签页、更新日历、自动跟随大纲、反链、时效提示、图钉摘要预览。
- 严格一跳局部图：只拖节点、不平移画布，当前笔记松手回图心；全局图采用自然力布局、有界度数尺寸与缩放显字。力核心复用 D3，动效统一 Motion。
- FlexSearch Worker 按需搜索、真实 giscus 评论、原始 OSS 图片的响应式尺寸适配及 Motion 适配的 medium-zoom。
- 原路径、根/非根 base、RSS、sitemap、404，以及开发快照缓存和内容失效通知。

这不是完整的 Obsidian 运行时：Bases/地图、Mermaid 渲染、全文预览、旧别名重定向及更完整 OFM 尚待完善，详见设计文稿。

## 目录

```text
src/site.config.ts    品牌、域名、base、导航、评论等配置
src/content/          发布过滤、编译、身份解析、MoC、快照与派生资源
src/markdown/         Markdown 扩展
src/graph/            构建与交互共用的力核心/显示规则
src/images/           原图 URL、显示尺寸与原图放大链接
src/runtime/          按需交互、Motion、图谱、搜索 Worker
src/ui/、styles/      语义组件、Tailwind 与专用样式
src/pages/、layouts/  Astro 路由与页面外壳
assets/fonts/         固定字体源与原始 Biro，供本地/服务器构建使用
src/fonts/generated/ 自动生成的字体分片、CSS 和清单（不提交）
scripts/、tests/      构建辅助、功能检查和回归测试
patches/              medium-zoom 的 Motion 适配补丁
public/               字体许可、第三方署名等发布资源
docs/design-review.md 设计与迁移文稿
content/              内容 submodule
```

## 字体与服务器构建

全部字体输入都在 `assets/fonts/`。其中 `biro-script-plus.woff2` 保留原始字节与 OpenType，不参与 OFL 字体的子集流程。Biro 不属于 OFL，使用时需要相应的 Webfont 许可。

```sh
bun run fonts:build   # dev/build 也会自动校验并按需生成
bun run fonts:verify  # 检查实际字表、字重、名称、哈希与 CSS 覆盖
bun run fonts:clean   # 显式删除非当前清单的产物；勿与字体生成并行
```

当前最小有效生成集合是 **167 个 WOFF2 + `fonts.css` + `manifest.json`**。它们是不同字重/字符范围的有效分片，不是 167 份完整字体；UI 优先片与完整字表片有设计上的字符重叠。旧代分片会占空间，但不会进入当次 `dist/`；`fonts:clean` 校验当前清单后删除旧代，避免误删缺字。清理后重新打开旧页面，以免旧 CSS 继续请求已删除地址。

若服务器构建，带上源码、锁文件、`assets/fonts/`、补丁和固定内容提交，安装上述 Node/Bun/Python 工具后执行 `bun run build`。若服务器只托管静态文件，本地构建后仅需部署 **`dist/` 的内容**；内容源库、原始 TTF/OTF 和构建缓存不属于静态发布目录。非根路径先设置 `SITE_BASE=/preview/` 等实际前缀。

## GitHub Pages

[部署工作流](.github/workflows/deploy.yml) 在网站仓库的 `main` 推送时运行，也可手动触发；只有 `main` 可部署。流程参考 [Astro 官方方案](https://docs.astro.build/en/guides/deploy/github/)与 [Navfolio](https://github.com/dodolalorc/astro-navfolio/blob/v1/.github/workflows/deploy-pages.yml)，显式安装固定版本 Node/Bun/uv，以 `bun install --frozen-lockfile` 安装依赖，再执行 `bun run validate` 和 `bun run verify:http`。字体由构建钩子按 `scripts/fonts/requirements.txt` 自动生成；只有检查通过的 `dist/` 会上传到 Pages。

仓库配置要求：

- **Settings → Pages → Source** 选择 **GitHub Actions**；自定义域名保持 `virgiling.wiki`，与 `src/site.config.ts` 的 `site` 一致，`SITE_BASE=/`。
- **Settings → Environments → github-pages** 的部署分支规则允许 `main`。
- Actions secret **`BLOGS`** 提供网站仓库和 `virgiling/blog_content` 的只读 Contents 权限，用于检出私有 submodule；普通 `GITHUB_TOKEN` 不能读取另一个私有仓库。检出后不保留凭据。

工作流使用记录的内容 gitlink，不执行 `submodule update --remote`。源码、内容库和构建缓存不上传为产物，也不缓存私有内容派生的 Astro 输出。构建 job 只有代码读取权限，部署 job 才拥有 Pages/OIDC 写入权限。工作流成功仅代表构建与静态发布成功，不替代浏览器验收。

## 维护检查

使用 Prettier 与官方 `prettier-plugin-astro` 格式化 `src/`，不格式化生成字体或内容 submodule。`.astro` 文件采用与 Astro 7 一致的 JSX 空白语义；`validate` 和 Pages 构建包含格式检查。

```sh
bun run format                      # 只格式化 src/ 中的源文件
bun run format:check                # 不修改文件
bun run check
bun run test
bun run build && bun run verify
bun run verify:http                  # fetch 检查；自行启动/退出独立测试服务
bun run verify:dev                   # 开发缓存、真实模块、字体与路由失效
bun run content:report               # .astro/content-report.json
SITE_BASE=/preview/ bun run build
SITE_BASE=/preview/ bun run verify
SITE_BASE=/preview/ bun run verify:http
SITE_BASE=/preview/ bun run verify:dev
bun run build                       # 非根检查后恢复根路径产物
```

验证及可选 `measure:dev` / `measure:cpu` 的结果写入 `.astro/reports/`，不提交，也不是浏览器性能报告。更新包时检查 `patches/medium-zoom@1.1.0.patch` 是否仍能正确应用，再按影响验证；不要绕开补丁中的 Motion 与清理约定。

正式域名和评论键由 `src/site.config.ts` 管理；localhost 和测试 base 不改变讨论身份。站点 mark「栞」意为书签，名称为「忘れてください」，不显示 byline；`public/favicon.png` 保留旧站 `https://virgiling.wiki/static/icon.png` 的原始 PNG。

正文图片由浏览器直接请求原始 OSS URL，本地附件仍通过允许的 `media/` 路由发布。构建不请求远程图片、不探测尺寸、不生成 WebP 或 srcset；尺寸适配仅通过 CSS 与作者提供的宽高完成，保持比例、不裁剪。放大、无脚本及修饰键点击仍指向原图。
