---
title: 文献搜索阅读
description: 
tags:
  - 文具袋/文具推荐
date: 2024-10-27
lastmod: 2025-04-16
draft: false
cover:
location: 43.8259282,125.4254779
---

# 文献搜索

这个通常没有什么好用的工具（如果 Google 算工具的话），一般是在网站上找，这里推荐几个好用的网站和一些浏览器插件

## 网站

1. 出版社的官网：
   好处是省事，坏处是不知道自己学校买没买版权（
   如果买了的话，可以通过 `Access via Institute` 来获取访问权限并下载，因为有些文章可能只能在官网上下载

2. 一些教授的主页
   典型的例子：https://leria-info.univ-angers.fr/~jinkao.hao/
   甚至可以在主页上找到文章的代码/可执行文件

3. [Sci-Hub](https://sci-hub.se/)
   需要挂梯子才能访问，文献量大但其实在 `CS` 领域的文章并没有特别多，较新的文章不一定能找到，好处是可以通过 `doi` 进行搜索查询

4. [Arxiv](https://arxiv.org/)
   不需要挂梯子，文献量大（可惜是预印本），几乎所有要发出去的 `CS` 领域文章都能在这里找到，较新的文章也一应俱全，缺点是因为是预印本，和出版社用的模板也不太一样，而且还得时刻注意作者有没有更新过（可能不是最新版），而且不能搜索 `doi`

5. [LibGen](https://www.libgen.is/)
   找图书的好去处，但会议期刊文献不推荐在这里找，你可以把这个网站视为秽土转生的 `zlib`

6. [semantic scholar](https://www.semanticscholar.org/)
   找文章&biblatex 的好去处，很多文章都可以提供 PDF 的连接，好用

7. [dblp](https://dblp.org/)
   同样是找文章的好去处，不需要翻墙就可以使用，个人觉得这个更偏向人肉某个老师，不太适合找某一个主题的文章

8. [Aminer](https://www.aminer.cn/)
   似乎是清华做的一个网站，感觉在可视化和联想以及 AI 上做的不错，之前用过这个网站的 AI 读文章功能，这个网站也有对应的 Google 插件

## 浏览器插件

CCF-Rank，一个浏览器插件，可以在 Google 的浏览器商店里找到：

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20241028183210.png)

其作用如下，可以显示文章，会议的 CCF 等级（包括 semantic scholar， dblp，google scholar 上面的文章）

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20241028184006.png)

# Zotero

[Zotero](https://www.zotero.org/) 作为我文献收集与阅读的工具

## 简介

> [!tldr]
> Your personal research assistant
>
> Zotero is a free, easy-to-use tool to help you collect, organize, annotate, cite, and share research.

选用原因：开源免费（当然存储需要付费），插件生态丰富，跨平台（Linux/Windows/MacOS），多端同步

安装的步骤省略，这里主要分享两个：

1. 插件
2. 如何多端同步

## 插件

**可以在 [Zotero 中文社区](https://zotero-chinese.com/plugins/) 查看推荐的插件以及安装方法**

> [!important]
>
> 新增了一个插件：[zotero-obsidian-note-.xpi](https://github.com/aidenlx/obsidian-zotero/releases/download/zt1.0.1/zotero-obsidian-note-1.0.1.xpi) ，与 [Obsidian](https://obsidian.md) 联动

这里推荐我使用的插件：

![image.png|425](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250416230415597.png)

> [!info] 更新
>
> Awesome GPT 支持使用 `deepseek` 了，可以配置 `deepseek` 进行 AI 问答

由于我没有 OpenAI 的账号，因此用不了 GPT 的 Token，否则很建议下载 _Awesome GPT_ 这个插件，用来替代翻译的插件

## 同步

一般而言，`Zotero` 提供的免费额度应该是够用的（100 MB），但也可以自定义存储方式，这里我使用的是 **坚果云** 的云端存储。

具体的操作可以参考坚果云官方的文章 [坚果云使用 Zotero 配置过程详解](https://help.jianguoyun.com/?p=4190)

> [!note]
>
> 可以不用安装坚果云的客户端，感觉其实很鸡肋，不如直接用 `WebDAV`
>
> 不过 `WebDAV` 也有一个缺点，就是坚果云会限制这个的使用次数，比如很短的时间内发送了巨量的请求，同步了一千个文件之类的，这样的话这个应用的 `Token` 就会被 ban 掉，需要重新生成一个 `Token`
