---
title: 学术 Slides 的制作
description: 
tags:
  - 文具袋/文具推荐
date: 2025-04-15
lastmod: 2025-04-15
draft: false
cover:
location: 43.8259282,125.4254779
---

关于 `Slides` 的制作，有三种方式：

1. 传统的 `PPT`
2. `Beamer` 风格的学术 `Slides`
3. `Reval.js` 网页 `Slides`

三种方式可以自由选择，优缺点如下：

- `PPT` 的制作稍微简单，不需要做任何动画，也不需要花里胡哨的模板（很适合赶工的时候做），但缺陷很明显，数学和代码的支持很差，有时候只能截个图放上去，很不美观（不美观的数学公式会让人难以理解……也生不出看下去的欲望）
- `Beamer` 模板写起来困难，但数学公式和代码都较为美观，并且模板问题难以解决，毕竟不是每个人都有心思去做模板的
- `Reval.js` 强依赖于其他人写好的插件拓展，而且语法会有些啰嗦，虽然可以使用 Markdown 语法的话，但想要做出动画效果也同样得使用他自己的一些语法，好在支持数学公式和代码块，并且可以把 Slides 直接挂在网上

# Typst

首先，我们回答一个问题：**为什么选择 Beamer？**

答案是：**数学公式**

众所周知的是，`PPT` 对于数学的支持一向不友好，想打出漂亮的数学公式可能比做一份完整的 `PPT` 还费时间，所以，为什么不选择数学更友好更优美的 `Latex` 呢？

但，`Latex` 的入门是一个很大的问题，花费一个月的时间在折腾自己的模板上，还没弄明白的事情也常有发生，这个时候就要开始推荐 `Typst` 了。

但是 [Typst](https://typst.app/) 的出现让学术 `Slides` 变得更简单了！关于 `Typst`，一个简单的说法就是：`Markdown` 增强版本的 `Latex`

拥有着 `Markdown` 风格的语法，可以轻松的写出文档，同时也拥有较为强大的排版能力，值得注意的是 `typst` 的数学语法比 `Latex` 看起来要舒服很多，最重要的一点是，它是增量编译（人话：即时预览）

我们并不会在这里讲述太多 `Typst` 的语法细节，也不会告诉大家如何去学一门新的（编程）语言，遇到有不会的时候，请学会 `RTFM` 和 `STFW`

# 如何制作

如果你想使用 `Typst` 来制作 Slides 的话，可以使用[Polylux](https://polylux.dev/book/polylux.html) 或更加中文化（以及更加现代的）[Touying](https://touying-typ.github.io/)

> 更加建议使用 `Touying` 社区更加活跃

随着 `Typst` 社区的发展，以及有很多包和模板可以使用了，例如：

- [pinit](https://typst.app/universe/package/pinit) 用于高亮文本块，并显示箭头
- [codly](https://typst.app/universe/package/codly) 更好看的方式显示代码块
- [cetz](https://typst.app/universe/package/cetz) 与 [fletcher](https://typst.app/universe/package/fletcher) 画图的必备利器，可以对标 `Latex` 中的 `TikZ`
- [lovelace](https://typst.app/universe/package/lovelace) 伪代码（算法流程）的制作
- [curryst](https://typst.app/universe/package/curryst) 我用来写规约/推导的数学公式的包

一个简单的例子如下，使用了 [BUAA Touying Template](https://github.com/Coekjan/touying-buaa/) 以及上面的一些包：

![image.png|450](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20241120160047.png)
