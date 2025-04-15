---
title: 搭建自己的 Obsidian
description: 
tags:
  - 文具袋/Obsidian
date: 2024-10-27
lastmod: 2025-04-15
draft: false
cover:
---

> [!attention] 写在前面
>
> 这篇文章主要讲述如何使用基础的 [Obsidian](https://obsidian.md) 记笔记，管理知识库等，不涉及任何功能型插件；可以查看 [[obsidian-plugin|Obsidian 插件推荐]] 来查看我使用的一些插件。
>
> > [!danger] 注意
> >
> > Obsidian 的核心并不是插件/外观，最重要的是笔记与思考，把学到的东西整理好放在这里，并思考这些知识之间的连接，我认为这才是 Ob 能够带给我们的东西。

# 为什么选择 Obsidian

`Obsidian` （下面简称 Ob） 通过 `Vault` （仓库）来管理笔记，所有的笔记都存储在一个大仓库下，你可以类比为一个 `.git` 仓库

每个 `Vault` 的配置都是独立的，Ob 将对仓库的配置存储在 `.obsidian` 文件夹下，此配置文件夹可以迁移到任意仓库，只需要重建索引即可

> [!tip]
>
> 注意，这里所说的 “独立”，包括了外观，快捷键等一系列设置

当然，你也可以在设置中调整默认配置目录，如下所示：

![image.png|550](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250407154118247.png)

Ob 的一个最优秀的点在于其笔记可以做到完全的 `Offline`（离线），这意味着你的笔记/图片都存储在本地，除非你需要在 [[obsidian-sync|Obsidian 多设备同步]]。

Ob 的另一个特色在于，你可以通过关系图谱的关系，来随机游走于笔记之间，这一点与 [wikipedia](https://www.wikipedia.org/) 有异曲同工之处，可以在手机上复习自己的笔记，来发现笔记之间的隐藏关联，例如下图所示：

![image.png|300](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250407163211504.png)

这里，我主要来讲述一下我是如何使用 Ob 来记录/组织笔记的，仅供参考。

> [!hint] 笔记记录方法
>
> 当然，这里也推荐一个记录笔记的方式，虽然我暂时没有在使用（其实是没有完全使用），也就是 [Zettelkasten](https://pkmer.cn/Pkmer-Docs/02-%E7%9F%A5%E8%AF%86%E7%AE%A1%E7%90%86%E5%9F%BA%E7%A1%80/zettelkasten/zettelkasten-%E6%96%B9%E6%B3%95-%E5%A6%82%E4%BD%95%E4%B8%BA%E7%9F%A5%E8%AF%86%E7%AE%A1%E7%90%86%E5%81%9A%E6%9C%80%E6%9C%89%E6%95%88%E7%9A%84%E7%AC%94%E8%AE%B0/) 法，这种方法天然适合使用 Ob 😹

# Ob 的特殊语法

Ob 中最基础的单位显然是文件（包括 `Markdown` 文件与附件），在关系图谱中以结点的形式出现，我们在后续都将之称为 **笔记**，在这里，我们不再讲述 `Markdown` 的语法，我们稍稍阐述一下 Ob 中的一些特殊语法

## Wiki-Link

也就是我们称为反链的东西，我们可以将其视为笔记之间的百科链接。

其语法为 `[[filename#title|alias]]` 这样的形式，其中 `filename` 为你仓库中的笔记文件名，`#title` 为你需要链接的标题/文字块等等，`alias` 为你需要在渲染时显示的文字，当然后面的内容你都可以省略，可以直接使用 `filename` 填入

## Callout

Callout 在以前的 Ob 中是没有的（似乎，当时我们通过插件来实现这个特性，其效果可以参考 [Github Callouts](https://github.com/orgs/community/discussions/16925) 的一些 Features），当然，Callouts 的颜色/形式是随着你使用的 Ob 的主题在改变的。

其语法为：

```markdown
> [!type] title
>
> content
> The `type` here could be seen at https://help.obsidian.md/callouts
```

## Tags

也就是标签，这在[[#Obsidian 组织笔记的方式|下文]] 中也会提到，其作为 Ob 中一个非常重要的特性，在分类，搜索，组织笔记中都十分有用，其写法为：

```md
This is a #tag
```

也就是在单词前加入 `#` （不需空格），你可以使用 `/` 来隔开标签以得到一个树形结构的标签，例如 `#tag/sub-tag/subsub-tag` 就可以可视化为：

```wikitext
tag
|
|--sub-tag
   |
   |-- subsub-tag
```

## Front Matter

虽然 `Front Matter` 并不是 Ob 特有的语法，但鉴于其在 Ob 中占有重要地位，因此我们在这里也需要讲解一下。

首先，`Front Matter` 是通过 `yaml`/`toml` 标注在 `Markdown` 最开头的一段配置，例如：

```yaml
---
title: 搭建自己的 Obsidian
description:
tags:
  - 文具袋/文具推荐
  - 文具袋/Obsidian
date: 2024-10-27
lastmod: 2025-04-07
draft: false
cover:
---
```

其在 Ob 中显示如下图：

![image.png|500](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250407204046523.png)

你可以在这里加入各种你自己的配置（也可以配合插件使用）

# Obsidian 组织笔记的方式

在这里，我们正式开始讲述如何组织整理自己的笔记，主要有以下两种方式

> [!tip] 分类
>
> 当然，分类本身就是一门哲学（不知道这个词是否合适），本质上我们并不需要太细的分类。当然，你也可以参考网络上其他人的分类方式，但是我十分建议在分类（无论是文件夹还是标签）上多思考。
>
> 分类时思考的越多，检索时思考的越少

## 文件夹

文件夹分类是十分直观且显然的，我们将同一类型的笔记都放在一个文件夹下，例如我的笔记目录如下图：

![image.png|250](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250415153646042.png)

我的做法是：

1. inbox 用来存放正在跟进的想法/文章
2. courses 用于存放公开课实验，这是从以前博客迁移过来的，因此我并不希望其有太多的修改（以后应该也不会再去更新了）
3. research 是我长期关注的领域，其中，主要包括两个大分类：
	1.  paper 是我的论文阅读记录，这部分只是记录论文的翻译
	2.  note 是我对于论文的阅读笔记（主要是想法），以及一些书籍的阅读思考
4. tools 主要是工具的推荐，环境的配置，防止自己遗漏一些问题
5. Archive 主要放一些归档文件，这部分内容我可能以后也不会再关注了，本质上是从先前的博客中遗留下来的想法/讲义

## Tags 组织

这是我目前正在结合目录法使用的方法，在 [[build-my-obsidian#Tags|上文]] 中，我们已经提到标签可以实现一个树形结构，因此我们可以使用标签来构建一个目录树，如下图所示：

![image.png|300](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250415154324477.png)

由于 Ob 的索引结构不但支持通过 `path` 也就是文件名来查找文件，还可以使用 `tag` 来查找。当然，你也可以通过 [[#Front Matter]] 中的其他字段来进行检索

## MOC

当然，我们还可以借鉴 Notion 的方法，注意到 [[#文件夹]] 的方法当嵌套过深，或者文件夹比较多时，查找一个文件可能会非常耗时，除了 tags 法，我们还可以通过 MOC 来回避这一点。

具体来说，我们可以对一个较大的文件夹创建一个文件，例如：

![image.png|350](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250407204609444.png)

我们在这个文件夹中进行目录的编写与维护，当然，这个目录的生成可以手写（如果你比较闲的话），也可以通过插件来实现（`dataview`）
