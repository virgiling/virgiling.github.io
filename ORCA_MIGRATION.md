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

验证迁移与远端发布流程前不要删除此目录。它包含原始 `.git`、本地分支、reflog 和迁移时的工作区文件。

## 验证记录

待迁移后补充。
