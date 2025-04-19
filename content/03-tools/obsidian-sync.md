---
title: Obsidian 多设备同步
description: 
tags:
  - 文具袋/Obsidian
date: 2025-04-07
lastmod: 2025-04-19
draft: false
cover:
---

# 同步工具

我们可以参考 [Obsidian 官方的文章](https://help.obsidian.md/sync-notes) 来查看一些同步方法，例如：

![image.png|218](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250407211324383.png)

其中，`Obsidian Sync` 为官方的付费同步模式

> [!attention] 更新注意
>
> 建议使用 S3 或其他 WebDav，本人现在使用的是 iCloud + Git 的同步方法
>
> 也就是把 Obsidian 的文件夹设置为一个 Git 仓库，然后放在 iCloud 里面，[[blog-record|博客]] 需要的 content 目录就使用 git submodule 来指定

# Git 同步

首先，显然我使用 `Git` + `Github` 来进行同步，但这主要是因为我的知识库和我的博客是一体的，博客放置在 `Github` 上，所以自然而然的，我的知识库也可以通过 `Git` 来进行同步了。

当然，我们需要书写好本地的 `.gitignore` ，例如：

```wikitext
.obsidian
private/
covers
Excalidraw
content/drawing/*.png
```

对于 `Git` 而言，显然最难受的一点在于，你无法随时进行同步（对于强迫症来说，必须是一个版本一次提交，对应到博客来说就是一篇博客一次提交），当然如果你没有这样的强迫症，`Git` 就是一个很适合你的同步方式。

另一个不好的点是，`Git` 对于大文件的支持不是很好，如果历史版本中有一个大文件，那么会导致后面的每次版本都记录，导致 `.git` 文件夹非常大，显然这也不是我们希望的（哎，要求真多），所以我们有下面这种方式。

# OneDrive & WebDav 同步

通过插件 [Remotely Save](https://github.com/remotely-save/remotely-save) 进行同步，你可以选择自己的 `WebDAV` 进行同步，这里我推荐使用 `Onedrive` 或者坚果云

> [!bug] 坚果云 BUG
>
> 值得注意的是，如果使用坚果云时常出现 503 的错误，一个简单的解决方式是在网页端把这个文件夹删了，然后重新同步

# 同步配置

值得注意的是，这两种方法都不太适合同步 `.obsidian` 文件夹，所以我建议在云端保存一份 `.obsidian` 的备份，这样只需要每次从云端下载即可

这个云端可以是百度云/夸克云盘/阿里云盘
