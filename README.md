# MySelf

个人介绍 monorepo。`cv`、`homepage` 和 `website` 由同一个根 Git 仓库管理，日常只在 `main` 上工作；三个项目仍可独立构建和部署。

## 项目结构

```text
MySelf/
├── cv/          # Typst 简历与求职信
├── homepage/    # Next.js 个人主页
├── website/     # Quartz 知识花园
├── AGENTS.md    # 根级 Agent 维护约定
└── Makefile     # 统一命令入口
```

`website/content` 继续作为独立 submodule 保存博客内容。它属于网站的数据边界，不会让 Orca 把三个主项目拆成三个 workspace。

## 开始使用

```bash
git submodule update --init --recursive
make doctor
make install
make check
```

常用命令可通过 `make help` 查看。两个本地预览分别使用：

```bash
make dev-homepage
make dev-website
```

## Orca 设置

只把本目录作为一个 repository 添加到 Orca，并把 `main` 设为 base ref。日常可以直接使用默认分支 workspace，不需要创建 worktree；如果以后确实创建 worktree，它也会从根仓库生成，并同时包含三个项目。

不要再把 `cv/`、`homepage/`、`website/` 单独注册为 Orca project。

## Git 与发布

根仓库的日常历史只使用 `main`。三个原仓库保留为发布 remote：

| 目录 | Remote | 发布分支 |
| --- | --- | --- |
| `cv/` | `legacy-cv` | `master` |
| `homepage/` | `legacy-homepage` | `ci` |
| `website/` | `legacy-website` | `v5` |

需要触发原仓库的 GitHub Pages 发布时，在所有变更已经提交且验证通过后显式运行：

```bash
make publish-cv
make publish-homepage
make publish-website
```

这些命令使用 `git subtree push`，不会在根仓库留下长期发布分支。它们会修改远端状态，因此不应由 Agent 自动执行。

迁移设计、恢复方式与验证记录见 [ORCA_MIGRATION.md](ORCA_MIGRATION.md)。
