---
title: VSIDS 启发式
description: 
tags:
  - Research/笔记/SAT
  - Status/Typing
date: 2025-04-16
lastmod: 2025-08-19
draft: true
cover:
---

# 前言

在 SAT 的精确算法中，其框架都是基于分支限界算法，其主体框架如下：

```py
while True:
	conf = propagation()
	if conf is None:
		decide()
	else:
		resolve()
```

其中，`resolve` 用于回溯以撤销冲突的赋值，`decide` 用于决策变量的赋值，并继续探索树的下一层级，所有被决策的变量都会被记录到 `trail` 中，用于冲突时撤销赋值

如果我们想要求解的更快，那么决策的变量顺序是十分重要的

> [!tip]
>
> 在树搜索中，更早的发生冲突，意味着我们可以更早的进行剪枝，从而有效的减少解空间的大小，于是决策变量的选择就显得尤为重要
>
> 在 CSP 中有一个重要的观点："to succeed, try first where you are likely to fail"[^2]，同样说明了剪枝的重要性

# VSIDS 启发式策略

一个好的启发式需要具有两个重要的特征：

1. 策略有效，在这里指选出来的变量能够快速剪枝，降低求解时间
2. 计算简单

然而这两点之间存在一个 trade-off，一个好的启发式就是平衡这两点，既要又要。

VSIDS [^1]，全称为 Variable State Independent Decaying Sum，其策略如下：

1. 每个变量的每个[[极性]]都有一个计数器，初始化为 $0$
2. 每当有一个子句被加入到子句库中，子句中的每个文字的计数器都会增加 $1$
3. 拥有最高计数器值的未赋值的变量与极性被选择，若存在相等的，随机选择一个（可以使用其他启发式配置，最简单的为随机）
4. 所有计数器在一段时间后会除以一个常数 $\alpha$


# 另一个优化

由于 SAT 求解器会花费将近 90% 的时间在 BCP 这个过程中，因此在提出 VSIDS 的同时，文章中也有另一个关于 BCP 的优化，也就是我们熟知的 [[watch_literal]]

[^1]: Moskewicz, Matthew W. et al. “Chaff: engineering an efficient SAT solver.” *Proceedings of the 38th Design Automation Conference (IEEE Cat. No.01CH37232)* (2001): 530-535.
[^2]: Haralick, Robert M. and Gordon L. Elliott. “Increasing Tree Search Efficiency for Constraint Satisfaction Problems.” *Artificial Intelligence* (1979).
