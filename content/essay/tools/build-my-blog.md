---
title: 本地知识库与博客
description: 
tags:
  - 文具袋/文具推荐
  - 一些随笔/2024
date: 2024-10-27
lastmod: 2025-01-03
draft: false
cover:
---

# 本地知识库

我将博客还有一系列本地 **Markdown** 的书写与管理都集中在 [Obsidian](https://obsidian.md/) 之中，当然，如果你只是书写单个 `md` 文件的话，也可以使用 `Typora` 或者 `Marktext`，甚至 `vscode` 也是可以的，但如果你想连同笔记，博客，日记等等都在一起管理的话，那我推荐使用 `Obsidian`

关于 `Obsidian` 的教程也十分之多，这里我主要分享一些插件和网站，也可以参考 [[build-my-obsidian|Obsidian 使用指北]] 中更详细的内容

## 网站

- [PKMer Obsidian 插件集合](https://pkmer.cn/products/plugin/pluginMarket/)
- [Obsidian 插件汇总](https://ob.pory.app/)

## 主题与插件

我使用的主题为 `Primary` ，并使用了插件 `Style Setting` 进行了一些改造，但不是很多，感觉预设已经很够用了

字体使用的是：中文 [霞鹜文楷](https://github.com/lxgw/LxgwWenKai)，英文 [Bookerly](https://font.download/font/bookerly)，代码 [Monaco](https://github.com/thep0y/monaco-nerd-font)

页面显示如下：

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250103194853580.png)

插件主要有：

- `Pangu`：排版，用于中英文之间插入空格，强迫症患者福音
- `Advanced Tables`： 表格编辑工具
- `Compeletr`：一个自动补全的插件
- `dataview`：一种 Obsidian 里的 SQL
- `obsidian-shiki-plugin`：客制化代码块的显示
- `Excalidraw`：排名第一的画图插件（虽然我平时用的也不是很多）
- `Image auto upload Plugin`：和 piclist 一块使用的插件，在复制图片时可以直接上传到图床上，然后替换图片的 url
- `Lazy Plugin Loader`：插件的懒加载插件，快速启动 obsidian，防止加载插件卡住
- `Linter`：用来格式化（自动添加，更新）文件的 `yaml`，或者说 `frontmatter`
- `Projects`：用来管理知识库，我主要用于管理论文阅读的笔记
- `Remotely Save`：远端同步，这里我使用的是 坚果云 的 `WebDAV` 进行存储，但有时会出现 503 的错误
- `Style Setting`： 上文所说的，客制化主题必备插件
- `Tasks`：更好的显示 `TODO List`
- `MouseWheel Image Zoom` ：更好的显示图片（主要是想放大和缩小）
- `Virtual Linker`：更好的显示外链等
- [Zotlit](https://zotlit.aidenlx.top/zh-CN/getting-started/install/obsidian): 与 Zotero 联动，更好的写论文阅读笔记

# 博客

> [!danger] 博客主题更换须知
>
> 在 2024-12-10 的时候更换了主题，使用 obsidian 与 quartz 进行构建，还是发布在 github pages 上，可以参考 [[blog-record|博客迁移记录]]

和网上大多数静态博客系统一样，我使用 **Markdown** 写博客，使用 **Hugo** 生成静态的 `html` 文件，然后通过 **Github Pages** 进行部署。

我使用的主题是 [Stack](https://github.com/CaiJimmy/hugo-theme-stack.git)，当然自己魔改了一部分，支持了一些新的特性（主要是卡片链接），可以参考 [魔改版本 Stack](https://github.com/topdeoo/hugo-theme-stack)

这个主题网上美化/配置的教程很多，想要使用的话还是很简单的，在这里不再赘述

关于文章中的图片，我使用的是 [piclist](https://piclist.cn/) + 腾讯云对象存储，这样可以通过腾讯云的对象存储作为在线图床，就不用担心图片无法显示在公网上了

> [!important]
>
> 如果你使用的是 `4K` / `2K` 之类的屏幕，截图时导致图片很大，心疼流量的话，可以参考 [[compress-piclist-image|这个解决方案]]
