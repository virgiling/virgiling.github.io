---
title: 毕业论文
description:
tags:
  - Status/Doing
date: 2025-10-18
lastmod: 2025-10-18
draft: true
cover:
location:
---

# JM Talk

1. 写求解器的时候，最开始不要去关注时间效率，反而我们应该去关注并剖析，这个求解器在什么例子上表现好，以及为什么表现好，这个为什么十分重要，因为我们可以将其迁移到其他的算法里去
2. 我需要去剖析为什么我的算法在两种例子上表现不一样，因为基数约束本质上不适合翻转一个变量来搜索
3. 翻转多个变量/使用带进度条的打分函数，这部分可以考虑与 [[elffersDivideConquerFaster2018|RoundingSAT 阅读笔记其一]] 中的 Slack 函数相结合

# 实例

1. [[reevesClausesKlauses2024|基数约束SAT的精确求解器]] 这里用到的例子（包括提出的两个问题，但需要自己生成例子）
2. 对于大 KNF，使用 `MAXSAT` 的竞赛例子

# 对比算法

只需要对比 `ENCODE` + SAT 的与 PB 求解器（ [[PBO-LS-Framework|PBO 的局部搜索求解器系列]] 以及 [[elffersDivideConquerFaster2018|RoundingSAT]] ）即可

# 精确求解器部分

可以参考的做法为：

1. 使用 [[reevesImpactLiteralSorting|基数约束编码中文字顺序的重要性]] 进行排序编码，引入辅助变量
2. 使用 [[reevesClausesKlauses2024|基数约束SAT的精确求解器]] 中的 `CCDCL` 进行求解
3. 如果可以的话，我们也可以引入 [[abioConflictDirectedLazy2012|Conflict Directed Lazy Decomposition]] 进入到 `CCDCL` 中，把那些大子句做懒分解

- [ ] 需要去阅读代码，看基数约束是怎么做冲突分析的

# 并行部分

可以考虑用[[SAT-Parti|目前的项目]]（虽然还不完善，不知道出实验要多久）

- [ ] 需要思考并行的 sharing 如何对基数约束做

# 局部搜索部分

这是目前最需要解决的部分，我需要快速写完这部分内容，然后跑一下实验
