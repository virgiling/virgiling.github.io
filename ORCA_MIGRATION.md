# Orca Monorepo Migration

## 目标

- Orca 只注册 `MySelf` 根目录。
- 日常只维护根仓库的 `main`。
- 根级 worktree（如果需要）一次包含 `cv`、`homepage`、`website`。
- 保留三个旧仓库的完整历史和原有 GitHub Pages 发布能力。

## 实现

三个当前生产分支通过非 squash `git subtree add` 导入：

- `cv/master` → `cv/`
- `homepage/ci` → `homepage/`
- `website/v5` → `website/`

旧仓库作为 `legacy-*` remotes 保留。日常提交只进入根 `main`；发布时再把指定目录的提交拆分并推送到对应旧分支。

`website/content` 继续作为 submodule。根 `.gitmodules` 使用 `website/content` 路径，而 `website/.gitmodules` 仍随 website subtree 发布到旧仓库。

## 恢复

迁移前的三个完整仓库保存在根目录同级：

```text
/Users/virgil/PlayGround/MySelf-pre-monorepo-20260818/
```

验证迁移与远端发布流程前不要删除此目录。它包含原始 `.git`、本地分支、reflog 和 tracked 工作区快照；依赖缓存、构建缓存与其他 ignored 文件已经移回新的根仓库工作区。

## 验证记录

- 根仓库只有本地分支 `main`，三个主项目内不再存在嵌套 `.git`。
- `website/content` 已从根 `.gitmodules` 初始化到 `374ce46b`。
- subtree 反向拆分与迁移前生产分支完全一致：
  - `cv/` → `f5e0305802176ba695bd206f9787f0231df75853`
  - `homepage/` → `5940759287e268fba5005a76cd02ae98d35e172e`
  - `website/` → `e5c228753d4231dcf46ca145372af779855efc5b`
- `make check` 通过：Typst 编译、homepage TypeScript/ESLint、website TypeScript/Prettier 均成功。
- `make build` 通过：Next.js 静态导出、Typst PDF 和 Quartz 完整构建均成功；Quartz 处理 191 个输入并生成 278 个文件。现有博客内容产生若干 KaTeX Unicode warning，但没有构建错误。
- `make test` 在本机 Bun 1.3.11 下为 158 pass / 5 fail；失败均来自 `node:test` 兼容层缺少 `mock.method`。`website/package.json` 与 `.bun-version` 要求 Bun 1.3.14，因此根 `make doctor` 已增加版本检查；迁移没有修改对应测试或实现。
- `homepage/.nvmrc` 的用户未提交修改（22 → 24）已原样保留为根仓库工作区修改，没有混入迁移提交。
- 没有向任何远端 push。
