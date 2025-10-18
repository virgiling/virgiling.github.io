---
title: VSIDS 启发式
description:
tags:
  - Research/笔记/SAT
date: 2025-04-16
lastmod: 2025-10-18
draft: false
location: 
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

1. 每个变量的每个 [[极性]] 都有一个 `inc`，初始化为 $0$
2. 每当有一个子句被加入到子句库中，子句中的每个文字的 `inc` 都会增加 $1$
3. 拥有最高 `inc` 值的未赋值的变量与极性被选择，若存在相等的，随机选择一个（可以使用其他启发式配置，最简单的为随机）
4. 所有 `inc` 在一段时间后会除以一个常数 $\alpha$

> [!summary] 简洁版
>
> 每个变量的 $score$ 为其在所有子句中的文字出现次数。
>
> 1.  每当生成一个新的冲突子句时，该子句中所有变量的分数增加（通常加 1）。
> 2.  定期将所有变量分数除以一个常数，以减弱旧冲突的影响，突出新冲突。

# 求解器中的 VSIDS

现代求解器中最流行的是 MiniSAT 中提出的 EVSIDS（the exponential variant of VSIDS），它通过动态调整变量分数来优先选择在近期冲突中频繁出现的变量，从而提升求解效率，其做法为：

1. 变量分数初始化为 0，增量值 `inc` 默认为 1。
2. 每次冲突后，`inc` 会乘以 `1/decay` 进行衰减，其中 `decay` 初始为 0.8，每 5000 次冲突增加 0.01，最大不超过 0.95。
3. 在冲突子句中的变量分数会通过增加 `inc` 来“提升”（bumped），使得这些变量在后续搜索中更易被选中。

这种设计通过指数衰减平衡了历史信息与近期活动，帮助求解器快速聚焦于可能引发冲突的变量。

> [!important] 相位
>
> 当我们选择一个变量出来，我们需要对其进行赋值，这个赋值的选择我们叫作相位（赋值为真/假），相位的选择是一个十分重要的问题，在 [[Phase_Choose#CaDiCaL 中如何选择相位进行赋值|CaDiCaL]] 中有详细的策略来选择

# 另一个优化

由于 SAT 求解器会花费将近 90% 的时间在 BCP 这个过程中，因此在提出 VSIDS 的同时，文章中也有另一个关于 BCP 的优化，也就是我们熟知的[[watch_literal#More Optimization|双观察字]]

[^1]: Moskewicz, Matthew W. et al. “Chaff: engineering an efficient SAT solver.” *Proceedings of the 38th Design Automation Conference (IEEE Cat. No.01CH37232)* (2001): 530-535.
[^2]: Haralick, Robert M. and Gordon L. Elliott. “Increasing Tree Search Efficiency for Constraint Satisfaction Problems.” *Artificial Intelligence* (1979).
