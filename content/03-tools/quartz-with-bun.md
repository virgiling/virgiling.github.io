---
title: Quartz 使用 Bun 替换 Nodejs
description:
tags:
  - 文具袋/博客相关
date: 2025-10-07
lastmod: 2025-10-07
draft: false
location: 43.8259282,125.4254779
cover:
---

> [!info] 写在前面
>
> 只是心血来潮，想要更换一下 Quartz 的包管理器以及打包工具，之前一直听说 `Bun` 运行时的速度快，想着在本地预览的话应该会比 Node 更快，所以替换一下

# 本地更改

首先需要安装一下 [`bun`](http://bun.com/) ，我是用的是 `MacOS` （根据官网给出的命令安装即可）

然后，我们需要更改 `quartz` 的几个文件：

1. `package.json`

这里主要是更改 `scripts` 中的内容：

```json
"scripts": {
    "quartz": "./quartz/bootstrap-cli.mjs",
    "docs": "bunx quartz build --serve -d docs",
    "check": "tsc --noEmit && bunx prettier . --check",
    "format": "bunx prettier . --write",
    "test": "tsx --test",
    "profile": "0x -D prof ./quartz/bootstrap-cli.mjs build --concurrency=1"
  },
```

2.  `quartz/bootstrap-cli.mjs` 以及 `quartz/bootstrap-worker.mjs`

这里只需要改一下 shebang （也就是第一行）为：

```js
#!/usr/bin/env bun
```

3. 增加文件 `.bun-version`

```bash
1.2.17
```

然后，我们只需要运行 `bun i` 即可安装包并自动生成 `bun.lock` 文件

# Github Actions 更改

如果想同时更改部署时也使用 `bun`，只需要修改你的 `deploy.yml` (或者类似名字的文件)，这个文件用来控制你的部署 actions

可以按照以下方式书写：

```yaml
name: Deploy Quartz site to GitHub Pages

on:
  push:
    branches:
      - v4

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0 # Fetch all history for git info
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: ".bun-version"
      - name: Install Dependencies
        run: bun install
      - name: Build Quartz
        run: bun run quartz build
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v4
        with:
          path: public

  deploy:
    needs: build
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

实际使用下来其实没什么区别，只是为了醋包了盘饺子而已（
