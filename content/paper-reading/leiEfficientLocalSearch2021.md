---
title: LS-PBO 阅读笔记
description: 
tags:
  - 论文阅读笔记/组合优化
  - 算法讲义/局部搜索算法
  - Paper/PBO
date: 2024-12-31
lastmod: 2024-12-31
draft: true
cover: 
zotero-key: Q963YLKH
zt-attachments:
  - "957"
citekey: leiEfficientLocalSearch2021
---

> [!tldr]
>
> [文章链接](https://link.springer.com/10.1007/978-3-030-80223-3_23)

本文后续的改进版有：[[chuMoreEfficientLocal2023|NuPBO CP'23]]，[[chenParLSPBOParallelLocal2024|ParLS-PBO CP'24]]

# Efficient Local Search for Pseudo Boolean Optimization

> [!abstract]-
>
> Pseudo-Boolean Optimization (PBO) can be used to model many combinatorial optimization problems. PBO instances encoded from real-world applications are often large and diﬃcult to solve; in many cases, close-to-optimal solutions are useful and can be found reasonably eﬃciently, using incomplete algorithms. Interestingly, local search algorithms, which are known to be eﬀective for solving many other combinatorial optimization problems, have been rarely considered in the context of PBO. In this paper, we are introducing a new and surprisingly eﬀective local search algorithm, LS-PBO, for PBO. LS-PBO adopts a well designed weighting scheme and a new scoring function. We compare LSPBO with previous PBO solvers and with solvers for related problems, including MaxSAT, Extended CNF and Integer Linear Programming (ILP). We report results on three real-world application benchmarks, from the Minimum-Width Conﬁdence Band, Wireless Sensor Network Optimization and Seating Arrangement Problems, as well as on benchmarks from the most recent PB Competition. These results demonstrate that our LS-PBO algorithm achieves much better performance than previous state-of-the-art solvers on real-world benchmarks.

首先，我们介绍什么是 PBO 问题：给定一个变量集合 $X = \{x_1, \dots, x_n\}$，其中 $x_i \in \{0, 1\}$，问题定义为：

$$
\begin{aligned}
\min_X &c_i \cdot l_i \\
s.t. \quad &\bigwedge^m_{j=1}\sum^n_{i=1} a_{ij} \cdot l_i \geq k_i
\end{aligned}
$$

其中，$l_i \in \{x_i, \neg x_i\}, c_i, a_{ij}, k_i \in \mathbb{R}$

解决 PBO 的算法主要分为三类：

1. 基于 CDCL 的 SAT 求解器，代表为 OpenWBO，[[elffersDivideConquerFaster2018|RoundingSAT]]，HYBRID
2. 分支限界法（BnB）
3. 不完备的局部搜索算法

在本文之前，唯一一篇提到使用局部搜索做 PBO 的文章为 [[leiExtendedConjunctiveNormal2020|ECNF]] ，本文提出一个名为 _LS-PBO_ 的框架，在这个框架中，我们将 “目标函数”（objective function）变更为“目标约束”（objective constraints）， 将目标约束加入到 PBO 实例中。为了区分目标约束与原约束，我们引入了 [[#Constraint Weighting Scheme]] 技术，与 [[#Score Function]] 结合，指导局部搜索的进行。

# Constraint Weighting Scheme



# Score Function
