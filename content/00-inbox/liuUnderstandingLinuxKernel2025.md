---
title: 可视化理解 Linux 内核
description: 
tags:
  - Research/阅读/OS
  - CCF/A/EuroSys
  - Status/Typing
date: 2025-04-22
lastmod: 2025-04-23
draft: true
cover: 
zotero-key: AKMC8NYI
zt-attachments:
  - "1063"
citekey: liuUnderstandingLinuxKernel2025
link: https://dl.acm.org/doi/10.1145/3689031.3696095
---

> [!tldr]
>
> [文章链接](https://dl.acm.org/doi/10.1145/3689031.3696095)

> [!tip]
>
> 这篇文章暂时没有写中文翻译，先写一下我阅读时想到的一些问题和可能的改进点，以便后续的讨论

# 疑问与改进点

在第二节中 Unraveling the Kernel State 中，文章提到我们在调试时最常用的三种方式为：

1. Prune，也就是只关注一个结构体中少部分的字段
2. Flatten，也就是将一个非常长的调用/指针过程，压缩成几个节点，例如，在线程和网络相关时，我们也许只关心 `task_struct`，其打开的 `socket` 以及其中的 `sock`
3. Distill，将树型/链表等这类在 gdb （即使是带图形界面的 gdb）显示起来很复杂的结构，转化为一个线性表来实现，本质上我们只关注节点的连接关系与顺序

问题：**调试时我们拆解问题的方法不止这三类，或许还可以加一些其他的方法**

> [!important]
>
> 最严重的一个问题，我觉得这个工具十分 Toy，但是具体是不是 Toy 还得跑了代码才知道
>
> 主要一点在于，如果这是个加强 gdb 的工具，那确实很好用，我觉得已经达到预期了
>
> 但是如果你真的是要 Understand，那这里的 VCL 表达能力就有点鸡肋，如果能通过 LLM，将字段名称也表达出来含义就好了

还有一个比较重要的，这个 Toy，是否能够调试多线程程序，让我们摆脱只能看 LOG 的痛苦