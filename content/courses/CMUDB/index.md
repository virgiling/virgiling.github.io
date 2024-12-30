---
title: CMU Database
description: 
tags:
  - CMU/15-445
  - 公开课/课程简介
date: 2023-05-24
lastmod: 2024-12-30
draft: false
cover: 20230628182840.png
---

# 课程简介

作为 CMU 数据库的入门课，这门课由数据库领域的大牛 Andy Pavlo 讲授（“这个世界上我只在乎两件事，一是我的老婆，二就是数据库”）。

这是一门质量极高，资源极齐全的 Database 入门课，这门课的 Faculty 和背后的 CMU Database Group 将课程对应的基础设施 (Autograder, Discord) 和课程资料 (Lectures, Notes, Homework) 完全开源，让每一个愿意学习数据库的同学都可以享受到几乎等同于 CMU 本校学生的课程体验。

这门课的亮点在于 CMU Database Group 专门为此课开发了一个教学用的关系型数据库  [bustub](https://github.com/cmu-db/bustub)，并要求你对这个数据库的组成部分进行修改，实现上述部件的功能。

具体来说，在 15-445 中你需要在四个 Project 的推进中，实现一个面向磁盘的传统关系型数据库 Bustub 中的部分关键组件。

包括 Buffer Pool Manager (内存管理), B Plus Tree (存储引擎), Query Executors & Query Optimizer (算子们 & 优化器), Concurrency Control (并发控制)，分别对应  `Project #1`  到  `Project #4`。

值得一提的是，同学们在实现的过程中可以通过  `shell.cpp`  编译出  `bustub-shell`  来实时地观测自己实现部件的正确与否，正反馈非常足。

此外 bustub 作为一个 C++ 编写的中小型项目涵盖了程序构建、代码规范、单元测试等众多要求，可以作为一个优秀的开源项目学习。
