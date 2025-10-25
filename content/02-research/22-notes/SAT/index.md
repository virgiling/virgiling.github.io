---
title: SAT 求解器
description:
tags:
  - Research/笔记/SAT
date: 2025-03-19
lastmod: 2025-10-24
draft: false
location:
  - 43.8259282,125.4254779
cover:
---

这里放一些我学习 `SAT` 求解器的文章，应该会是卡片式的，阅读的书籍为：

- [TAOCP 4B](https://www-cs-faculty.stanford.edu/~knuth/taocp.html)
- [Handbook of Satisfiability](https://www.iospress.com/catalog/books/handbook-of-satisfiability-2)
- [Handbook of Parallel Constraint Reasoning](https://link.springer.com/book/10.1007/978-3-319-63516-3)

以及各种论文还有比较有代表性的的 [CDCL 求解器](https://github.com/arminbiere/cadical#)

在 SAT 问题中有需要专业名词（膨胀出来的），对于这些专业名词，我们会在文章中进行解释，不做统一的名词表

## SAT 问题基本定义

- [[SAT0x1|SAT 问题简介]]

- [[SAT0x2|SAT 的应用和变形]]

## 精确算法

### [[DPLL]]

### [[CDCL]]

- 分支启发式策略

  - [[VSIDS_Tutorials|VSIDS 分支启发式]]
  - [[VMTF]]

- [[Phase_Choose|相位以及如何选择相位]]

## 其他拓展

- [[SMT-Basic|SMT 基本定义]]
