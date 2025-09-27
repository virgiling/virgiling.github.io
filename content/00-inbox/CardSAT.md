---
title: 基数约束 SAT 求解器
description:
tags:
  - Status/Doing
date: 2025-09-26
lastmod: 2025-09-27
draft: true
location: 
cover:
---

# 概览

这个项目是我的毕业论文（

# JM Talk

1. 写求解器的时候，最开始不要去关注时间效率，反而我们应该去关注并剖析，这个求解器在什么例子上表现好，以及为什么表现好，这个为什么十分重要，因为我们可以将其迁移到其他的算法里去
2. 我需要去剖析为什么我的算法在两种例子上表现不一样，因为基数约束本质上不适合翻转一个变量来搜索
3. 翻转多个变量/使用带进度条的打分函数，这部分可以考虑与 [[elffersDivideConquerFaster2018|RoundingSAT 阅读笔记其一]] 中的 Slack 函数相结合
