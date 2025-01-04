---
title: RoundingSAT-1 阅读笔记
description: 
tags:
  - 论文阅读笔记/约束求解
  - 算法讲义/精确算法
  - CCF/A/IJCAI
date: 2025-01-01
lastmod: 2025-01-04
draft: true
cover: 
zotero-key: TNN4CGDN
zt-attachments:
  - "900"
citekey: elffersDivideConquerFaster2018
---

> [!tldr]
>
> [文章链接](https://www.ijcai.org/proceedings/2018/180)

# Divide and Conquer: Towards Faster Pseudo-Boolean Solving

> [!abstract]
>
> The last 20 years have seen dramatic improvements in the performance of algorithms for Boolean satisﬁability—so-called SAT solvers—and today conﬂict-driven clause learning (CDCL) solvers are routinely used in a wide range of application areas. One serious short-coming of CDCL, however, is that the underlying method of reasoning is quite weak. A tantalizing solution is to instead use stronger pseudo-Boolean (PB) reasoning, but so far the promise of exponential gains in performance has failed to materialize—the increased theoretical strength seems hard to harness algorithmically, and in many applications CDCL-based methods are still superior. We propose a modiﬁed approach to pseudo-Boolean solving based on division instead of the saturation rule used in [Chai and Kuehlmann ’05] and other PB solvers. In addition to resulting in a stronger conﬂict analysis, this also improves performance by keeping integer coefﬁcient sizes down, and yields a very competitive solver as shown by the results in the PseudoBoolean Competitions 2015 and 2016.

# 简介

> [!info]- SAT 的局限性
>
> CDCL 的推理（reasoning）能力差，因为其推理能力主要基于归结证明；以及其表达能力有限，只能解决以 CNF 形式表达的问题（虽然都可以规约，但会引入很多子句和变量），虽然有很多预处理技术（高斯消元，基数推理）可以提高很多速度，但这都与编码方式有很大关系，有时候并不是很有效果

由于 SAT 具有很大的局限性，于是，我们转向使用线性伪布尔约束来描述问题，这种约束形式能够表达比 CNF 更多的信息，但结构又与 CNF 很相似，于是基于 CNF 的技术可以应用到 PB 上

一些 PB 求解器仍然是基于归结的，这些求解器会将输入转化为 CNF，再进行求解；主要有两类做法：

1. `eagerly`：先转化为 CNF，然后直接调用 CDCL 求解器求解，代表是 MiniSat+，Open-WBO，NaPS
2. `lazily`：在修改的 CDCL 求解器中，保持输入的 PB 格式，但仅以子句的形式导出新的信息，代表为 Sat4j

另一种做法是使用切平面法来解决 PB 问题，但这种做法需要将 CDCL 框架拓展到 PB 上，这是十分困难的。

从理论的观点来看，使用切割平面似乎是很可取的，因为这种方法从来不比归结差，甚至可以做到指数级的更强。然而，实际上并非如此，通常基于 CDCL 的求解器优于基于切平面法的 PB 求解器。

在这篇文章中，提出了一个基于 CDCL 的 PB 求解器 RoundingSAT

# 基于冲突分析的 PB 求解

首先，我们回顾 PB 约束的标准形式：

$$
\sum_i c_i \cdot l_i \geq w
$$

其中，$l_i \in \{x_i, \neg x_i\}$, $x_i \in \{0, 1\}$ ，而 $c_i, w \in \mathbb{N^+_0}$，将 $w$ 称为满足度（或者简称为度）

我们将部分真值赋值 $\rho$ 看作由 $\rho$ 设定为真的文字集合，也就是说如果 $l \in \rho$，那么 $\rho(l) = 1$

一个传统的 [[CDCL-Framework|CDCL]] 框架如下图所示：

![image.png|700](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250101233325485.png)

在这里，我们不详细解释 CDCL 是如何工作的，我们希望做的是将 CDCL 中的两个重要部件引入到 PB 中来（重启与子句库之类的技术不在本文的探讨范围内）

## 单元传播

在 SAT 中，对于任意一条子句，只要有一个文字为真，子句即可为真，因此我们可以很轻松的进行单元传播，而在 PB 中，这种简单的成真条件不存在了，于是我们需要重新考虑传播的方案

首先，我们引入一个记号，对于任意一条约束 $C \coloneqq \sum_{i}c_i \cdot l_i \geq w$：

$$
slack(C, \rho) = \sum_{i\colon \rho(l_i) \not= 0}c_i - w
$$

可以发现 $slack(C, \rho)$ 本质上表示，在给定赋值 $\rho$ 的条件下，当前约束的最大值与度的差距

显然当 $slack(C, \rho) \lt 0$ 时，约束是不满足的，我们定义传播如下：

如果文字 $l_i$ 未被赋值，且有 $slack(C, \rho) \lt c_i$，那么我们称 $C$ 蕴含/传播了文字 $l_i$，也就是说除非将 $l_i$ 赋值为真，否则约束 $C$ 不成立

> [!tip] 类比回 SAT
>
> 我们可以将文字的系数视为 $1$，那么子句的$slack = 0$ 时，我们可以判定，文字 $l_i$ 一定为真（因为已经变成了一条单元子句）

> [!danger] 存在的重要问题
>
> 显然，这里我们会发现一个很严重的问题，当约束不是子句时，我们更难有效的检测约束是否在传播（因为 $slack$ 的值不能期望只通过某一个文字为真就使其大于等于 0）
>
> 然而本文并不会详细探讨这个问题

## 冲突分析

分析的方法是使用广义归结来进行，其定义如下：

给定一对存在冲突的约束 $C \colon al + \sum_i c_i\cdot l_i \geq w$ 与约束 $C^\prime \colon b \overline{l} + \sum_i c_i^\prime \cdot l_i^\prime \geq w^\prime$，其在文字 $l$ 的赋值上有冲突，我们假定 $g = gcd(a, b)$，那么广义归结 $Res(C, C^\prime, l)$ 定义为：

$$
\frac{b}{g}\sum_ic_i\cdot l_i + \frac{a}{g}\sum_i c_i^\prime \cdot l_i^\prime \geq \frac{bw + aw^\prime -ab}{g}
$$

> [!tip] SAT 中的归结
>
> 假定一对存在冲突的子句 $C \vee x, D \vee \overline{x}$，我们定义归结 $Res(C, D)$ 如下：$Res(C, D) = C \vee D$

> [!example] 一个简单的 PB 冲突例子
>
> 考虑 $C \colon 2x_1 + 2x_2 + 2x_3 \geq 3$, $C^\prime \colon \overline{x_1} + x_3 \geq 1$，在 $x_1$ 上有冲突，于是 $Res(C, C^\prime, x_1) \colon 2x_2 + 4x_3 \geq 3$

随后，我们反复回退决策层，试图找到最早的那次冲突决策点，从而得到学习子句（这也是 CDCL 中 1UIP 的做法）

### 存在的问题

我们考虑以下例子，$C \colon 2x_1 + 3\overline{x_2} + x_3 \geq 3$，$C^\prime \colon 4x_2 +4x_3 + 2x_4 +x_5\geq 4$，假定，我们的决策序为 $x_4 = 1, x_3 = 0$，此时 trail 中的文字为 $x_4, \overline{x_3}$

随后，在单元传播时，我们会在 $C$ 中考虑传播 $\overline{x_2}$ ，trail 变为 $x_4, \overline{x_3}, \overline{x_2}$，但此时 $C^\prime$ 发生冲突，我们需要进行冲突分析，根据前文，我们得到 $Res(C, C^\prime, \overline{x_2}) \colon 8x_1 + 16x_3 + 6x_4 + 3x_5 \geq 12$，然而这个约束直接将 trail 中 $x_4, \overline{x_3}$ 的赋值全违反了，此时我们得到的学习子句（学习约束？）就没有任何意义了

### 弱化与饱和

我们通过两个算子，$weaken$ 与 $saturate$ 来解决这个问题

#### 弱化

$weaken$ 从约束中删除一个文字，并从度中减去它的系数

例如对于约束 $C \colon x_1 + 2x_2 + 3x_3 \geq 4$ ，我们考虑对 $x_1$ 做弱化操作 $weaken(C, x_1) = 2x_2 + 3x_3 \geq 3$

可以发现，弱化操作就是直接将某个文字的取值假定为真

#### 饱和

$saturate$ 将约束中所有系数的大小**降低**到刚好不满足约束的程度，形式化的写为 $saturate(C) \colon \sum_i \min(c_i , w) \cdot l_i \geq w$

例如对于约束 $C \colon x_1 + 2x_2 + 3x_3 \geq 4$ ，$saturate(C) =  x_1 + 2x_2 + 2x_3 \geq 4$

### 最终的冲突分析

于是，最终的冲突分析如下所示：

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250104003034199.png)

> [!example]- 一个简单的分析示例
> 
> 
