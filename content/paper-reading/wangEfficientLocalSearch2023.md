---
title: 非线性实数域 SMT 的局部搜索算法
description: 
tags:
  - 论文阅读笔记/约束求解
  - CCF/B/VMCAI
date: 2025-04-06
lastmod: 2025-04-08
draft: true
cover: 
zotero-key: 7JAYDV78
zt-attachments:
  - "1053"
citekey: wangEfficientLocalSearch2023
---

> [!tldr]
>
> [文章链接](http://arxiv.org/abs/2311.14249)

# 前置知识

SMT 问题中的变量与文字与 [[SAT0x1|SAT]] 中有很大不同

- **变量**： 变量分为布尔变量 $b_i$ 与算术变量 $x_i$，其中$b_i \in \mathbb{B}$, 而 $x_i \in \mathbb{R}$ ，在本文的非线性实数问题中，所有算术变量必须取实数。
- **文字**： SMT 中的文字一般为多项式约束或布尔变量约束，例如 $x^2 + y > 0$ 或 $\neg(x^2 + y < 0)$ 都是非线性实数问题中的文字。

于是，我们可以顺利导出子句的定义，与 [[SAT0x1|SAT]] 问题类似，子句为文字的析取，例如 $(x^2 + y > 0) \vee (x + y^3 < 0)$ 就是一条子句。

我们可以使用上下文无关语法来定义这些关系：

$$
\begin{aligned}
p &\rightarrow x \mid c \mid p + p \mid p \cdot p \\
l &\rightarrow b \mid \neg b \mid p \leq 0 \mid p \geq 0 \mid p = 0 \\
C &\rightarrow \bigvee_{i} l_i \\
F &\rightarrow \bigwedge_{j} C_j
\end{aligned}
$$

其中，$c$ 为任意实数

# SMT 中的基础局部搜索

局部搜索通过在完整的赋值空间中进行搜索来确定问题实例的可满足性，通常是通过一次改变一个变量的值来实现。

在 SAT 问题中，[[SAT0x10|其局部搜索]] 中的每一个移动都会翻转一个布尔变量的赋值，而翻转什么样的变量是由一些因素决定的，例如由于翻转而变得满足/不满足的子句数量，子句的权重，最近被翻转的变量等。对于线性约束的 SMT， 我们可以类比为改变一些算术变量的值，从而使某个子句得到满足。

我们在下图中简单介绍非线性实数 SMT 的局部搜索算法框架：

![image.png|550](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250408141827025.png)

这里，`make-break` 的思想是，不只考虑变量 $x$ 关于某个子句的(不)可行区间，而是结合 $x$ 关于所有子句的(不)可行区间信息。我们举例说明此打分函数的过程。

> [!example] `make-break` 的流程
>
> 考虑以下三个子句 $x^2+y^2 \leq 1, x + y < 1, x +z > 0$，当前赋值为 $x \mapsto 1, y\mapsto 1, z\mapsto 1$，此时，子句权重为 $1, 3, 2$，那么 `make-break`$(x)$ 对于每条子句为：
>
> $$
> \begin{aligned}
> &x^2 + y^2 \leq 1(UNSAT): &(-\infty, 0)\mapsto 0, [0, 0]\mapsto 1, (0, \infty) \mapsto 0 \\
> &x + y < 1(UNSAT): &(-\infty, 0)\mapsto 3, [0, \infty)\mapsto 0\\
> &x + z > 0(SAT): (-\infty, -1]\mapsto -2, (-1, \infty)\mapsto 0
> \end{aligned}
> $$
>
> 于是，我们选择最正向收益的区间，将 $x$ 移动到这个区间内：$(-1, 0) \mapsto 3$

^9d60dd

而对于传统的布尔变量，`make-break` 的值为翻转此变量后，所有变为满足的子句权重之和减去所有变为不满足的子句权重之和。

如果没有得分大于 $0$ 的操作，则表明已达到局部最优解。此时需按 `PAWS` 策略更新子句权重，随后尝试随机选择一个子句并使其满足。若多次尝试后仍无法实现，则根据启发式规则随机调整某个不满足子句中的变量赋值。

> [!hint]- `PAWS` 策略
>
> 此策略的运行由一个平滑概率参数  *sp*  控制。当不存在可优化当前得分的操作时：
>
> - 以  $1-sp$  的概率，将所有不满足子句的权重增加 1；
> - 以  $sp$  的概率，将所有权重大于 1 的满足子句的权重减少 1。

# Improvement for Basic LS

## 迭代式计算变量评分

显然，上文中最为重要的一步就是如何通过 `make-break` 来做出最好的翻转/移动，这里我们主要集中与算术变量（布尔变量的分值计算较为成熟）。默认做法是遍历所有未满足子句中的所有变量：针对每个变量，计算其相对于各子句的得分后合并结果（如[[#^9d60dd]] 中的例子所示）。但显然这可能导致跨迭代的重复计算——例如，即使某子句中的变量在前一步未发生改变，其变量的可行解集仍可能被重复计算。

于是，我们定义 `boundary` 为四元组 `⟨val, is_open, is_make, cid⟩` ，其中 `val` 为实数，`is_open` 和 `is_make` 为布尔值，`cid` 为子句标识符。

`boundary` 表示：当由于子句 `cid` 的作用使得取值从小于 `val` 变为大于 `val` 时，`make-break`得分将发生变化。若` is_make` 为真，则得分会增加该子句权重的值；否则会减少相应权重。若 `is_open` 为真，则该变化在 `val` 处不生效；否则在 `val` 处已生效。`boundary` 之间存在自然排序：首先按 `val` 值排序，其次按 `is_open` 排序（其中 ⊥ < ⊤）。

每个变量相对于每个子句的 `make-break` 得分信息可通过起始得分（表示趋近负无穷时的得分）和一组 `boundary` 来表征。而变量相对于所有子句的得分信息，则通过累加各起始得分并合并所有 `boundary` 集合来构建。

> [!example] 使用 `boundary` 计算分数示例
>
> 我们从 [[#^9d60dd]] 的例子继续，此时我们已经将 $x$ 移动到 $(-1, 0)$，此时，对于变量 $x$ 的初始分数与 boundary 如下所示:
>
> $$
> \begin{aligned}
> &x^2 + y^2 \leq 1 & \text{初始分数为 0， boundary 集合为} \{(0,\bot, \top, 1), (0, \top, \bot, 1)\} \\
> &x + y < 1 & \text{初始分数为 3， boundary 集合为} \{(0,\bot, \bot, 2)\} \\
> &x + y > 0 & \text{初始分数为 -2，boundary 集合为} \{(-1,\top, \top, 3)\}
> \end{aligned}
> $$
>
> 此时，我们合并所有的 `make-break` 分数为：初始分数为 $1$，对 `boundary` 排序得到 $(-1,\top, \top, 3) \lt (0,\bot, \top, 1) \lt (0,\bot, \bot, 2) \lt (0, \top, \bot, 1)$。
>
> 通过依次遍历 `boundary`，当遇到其为 $is\_make = \top$ 的子句时，通过子句的权重来增加得分，否则通过权重来减少得分，可以很容易地从上面的区间中恢复出 `make-break` 的得分信息。

在局部搜索的过程中，每当变量 $v$ 被赋予新值后，仅需更新那些与 $v$ 出现在同一子句中的变量 $v^\prime$ 的 `make-break` 得分信息，且仅需针对共享子句更新边界信息。该过程如下图所示：

![image.png|600](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250408163640004.png)

## 等式松弛

> [!todo] 补全这部分

![image.png|500](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250408163840612.png)
