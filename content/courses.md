---
title: 📑公开课实验
description: 
tags:
  - ToC
date: 2024-12-28
lastmod: 2024-12-29
draft: false
---

这里收录了我在 [csdiy](https://csdiy.wiki) 上学习的一系列公开实验（当然，也有一部分不在这个网站上收录）

# 基础工具

这部分课程会教会你，CS 系的学生如何使用电脑

## MIT Missing Semester

[Missing Semeter](https://missing.csail.mit.edu/) 课程地址

> [!cite]
>
> 这门课将会教会你许多大学的课堂上不会涉及但却对每个 CSer 无比重要的工具或者知识点。例如 Shell 编程、命令行配置、`Git`、`Vim`、`tmux`、`ssh`  等等。如果你是一个计算机小白，那么我非常建议你学习一下这门课。

# 计算机系统

我的学习顺序如下：

## #CMU/15-213 CS: APP

CMU 大名鼎鼎的镇系神课，以其内容庞杂，Project 巨难而闻名遐迩。课程内容覆盖了汇编语言、体系结构、操作系统、编译链接、并行、网络等，作为系统入门课，兼具深度和广度

## #NJU/ICS 计算机系统导论

NJU 计算机系大名鼎鼎的 PA 就来源于这门课，课程资料详细，PA 难度较大，但仔细阅读材料后，总能自己解决问题，课程的正反馈很强，一门很好的系统入门课（包括编程习惯上也是很好的入门课）

# 操作系统

> [!caution]
>
> 这里记录着我在这三年中做完（或基本做完）的一些操作系统实验与课程。采用 `Prof.Haibo Chen` 的难度标记方法，对这些实验难度进行一些排序，但考虑到可能个人水平问题，所以难度分级可能并不是很可靠 😭

在开始一份课程之前，我十分推荐大家阅读蒋炎岩老师写的 [生存指南](https://jyywiki.cn/OS/OS_Guide.html)，会让你有一个大概的认知

## Easy Version 🌶️🌶️

### #MIT/6-S081 Operating System Engineering

这门课是本科生的 OS 入门课程，因此其难度并不高，对于国内学生而言，我认为难度主要集中在环境的配置，工具的使用，以及文档与课程视频的食用上（语言的难度占据了大部分），但好在这门课程并不小众，在网上可以搜集到众多实验解答（虽然课程的 Policy 并不让大家把代码开源……）。

更多信息可以参考 [[courses/MITOS/index|课程简介]]

## Medium Version 🌶️🌶️🌶️~🌶️🌶️🌶️🌶️

### #SJTU/SE-315 Operating Systems

国内第一操作系统实验室 IPADS 的作品， IPADS 的所长陈海波老师（Prof. Haibo Chen）曾经在 PDOS 做过一段时间的访问学者，这也是为什么这份课程设计的与 [[#MIT/6-S081 Operating System Engineering|6.S081]] 相似。

更多信息可以参考 [[courses/chcore/index|课程简介]]

### #NJU/OS Operating Systems

NJU 十分知名的课程，不过在 21 年之前似乎还没有如今的名气。这门课程在 23 年开始了混班教学（听说是这样），蒋炎岩老师把自己这几年（主要是 23 年）的教学方式和思考写了一篇 paper，发在了 [USENIX ATC'23（CCF A）](https://www.usenix.org/system/files/atc23-jiang-yanyan.pdf) 上

更多信息可以参考 [[courses/NJUOS/index|课程简介]]

### #PKU/OS Operating Systems

这门课程是 csdiy 的作者基于 UCB 的 CS162 魔改的，而 CS162 号称难度上不封顶

更多信息可以参考 [[courses/PKUOS/index|课程简介]]

## Custom Version 🌶️~🌶️🌶️🌶️🌶️🌶️

还有什么能比自己写一个操作系统更有挑战性和吸引力呢？

这里有一个比赛，在我写下这些文字的时候，学校里还没有人知道这个比赛，但它足够硬核，也足够有趣：[全国大学生计算机系统能力大赛](https://os.educg.net/#/)

希望在这之后会有人参加。

回归自己写一个操作系统，并没有本科课程教授这些，但有一些开源的资料可供参考：

- [Writing an OS in Rust](https://os.phil-opp.com/zh-CN/)
- [RISC-V OS using Rust](https://osblog.stephenmarz.com/)
- [Tsinghua rCore](http://rcore-os.cn/rCore-Tutorial-Book-v3/)
- [MIT xv6](https://github.com/mit-pdos/xv6-riscv)

甚至上面比赛中的历年优秀开源作品也都是不错的参考资料，只是没有教程（

> [!note]
>
> 我给出的参考资料都是 `Rust` 的，R 门

# 编译原理

## #Stanford/CS143 Compilers

斯坦福的编译原理课程，设计者开发了一个 Classroom-Object-Oriented-Language，简称 COOL 语言。这门课的核心就是通过理论知识的学习，为 COOL 语言实现一个编译器，将 COOL 高级语言编译为 MIPS 汇编并在 Spim 这个 MIPS 模拟器上成功执行。课程整体来说较为简单，难度不是很大（感觉应该不如国内的一些课程难度大，比如 [PKU 的编译原理](https://pku-minic.github.io/online-doc/) ，[南大的编译原理](http://docs.compilers.cpl.icu/)）

# 计算机网络

## #Stanford/CS144 Computer Network

这门课的主讲人之一是网络领域的巨擘  [Nick McKeown](http://yuba.stanford.edu/~nickm/index.html)  教授。这位拥有自己创业公司的学界业界双巨佬会在他慕课每一章节的最后采访一位业界的高管或者学界的高人，非常开阔眼界。在这门课的 Project 中，你将用 C++ 循序渐进地搭建出整个 TCP/IP 协议栈，实现 IP 路由以及 ARP 协议，最后利用你自己的协议栈代替 Linux Kernel 的网络协议栈和其他学生的计算机进行通信

> [!info]
>
> 这门课的助教更新框架十分勤快，几乎是每年都会有更新，每年都能有惊喜（

## #ECNU-DaSE/计网

这里只记录了 2020 级的期末项目作业，实现一个简单的 HTTP Server 以及一些进阶知识（使用 NIO 适应高并发场景）

# 并行与分布式系统

## #MIT/6-824 Distributed System

这门课和 #MIT/6-S081 一样，出品自 MIT 大名鼎鼎的 PDOS 实验室，授课老师 Robert Morris 教授曾是一位顶尖黑客，世界上第一个蠕虫病毒 Morris 病毒就是出自他之手，目前这个课程已经变成了面试简历上的必备项目，几乎是每个人都有（

# 数据库

## #CMU/15-445 Database Systems

这是一门质量极高，资源极齐全的 Database 入门课，这门课的 Faculty 和背后的 CMU Database Group 将课程对应的基础设施 (Autograder, Discord) 和课程资料 (Lectures, Notes, Homework) 完全开源，让每一个愿意学习数据库的同学都可以享受到几乎等同于 CMU 本校学生的课程体验，和 #MIT/6-824 一样，这个课程也已经称为简历必备项，虽然做完的人并没有那么多，可能只是配了环境就写上去了也说不准。
