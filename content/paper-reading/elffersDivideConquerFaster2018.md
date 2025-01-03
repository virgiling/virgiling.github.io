---
title: RoundingSAT-1 阅读笔记
description: 
tags:
  - 论文阅读笔记/约束求解
  - 算法讲义/精确算法
  - CCF/A/IJCAI
date: 2025-01-01
lastmod: 2025-01-02
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

# Introduction

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

# Conflict-Driven PB Search

首先，我们回顾 PB 约束的标准形式：

$$
\sum_i c_i \cdot l_i \geq w
$$

其中，$l_i \in \{x_i, \neg x_i\}$, $x_i \in \{0, 1\}$ ，而 $c_i, w \in \mathbb{N^+_0}$，将 $w$ 称为满足度（或者简称为度）

我们将部分真值赋值 $\rho$ 看作由 $\rho$ 设定为真的文字集合，也就是说如果 $l \in \rho$，那么 $\rho(l) = 1$

一个传统的 [[CDCL-Framework|CDCL]] 框架如下图所示：

![image.png|700](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250101233325485.png)
