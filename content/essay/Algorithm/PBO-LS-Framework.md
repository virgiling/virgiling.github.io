---
title: PBO 的局部搜索求解器系列
description: 
tags:
  - 算法讲义/局部搜索算法
  - 一些随笔/2025
date: 2025-01-03
lastmod: 2025-01-03
draft: false
cover:
---

# 问题简介

一个 PBO 问题的形式化表示为：

$$
\begin{aligned}
\min_{\{x_1, \dots, x_n\}} \, &\sum^n_{i=1}c_i \cdot l_i, \quad c_i \in \mathbb{Z} \\
s.t. \quad &\bigwedge^m_{j=1}\sum^n_{i=1}a_{ji}\cdot l_i \geq b_j, \quad a_{ji}, b_{j} \in \mathbb{N^+_0}
\end{aligned}
$$

我们在这里主要聚焦于如何使用局部搜索求解 PBO 问题

# 研究现状

## LS-ECNF

[[leiExtendedConjunctiveNormal2020|LS-ECNF IJCAI'20]] 是第一篇提出如何使用局部搜索求解 PBO 问题的文章（其实不算 PBO）

在这篇文章中，作者提出的其实是一个带基数约束的 Max-SAT 问题，但对所有的子句都加上了基数约束，这个时候我们可以发现，其实这就是一个简化的 PBO（系数 $a_{ji} = 1$）

## LS-PBO

在第二年，LS-ECNF 的作者正式提出了 [[leiEfficientLocalSearch2021|LS-PBO SAT'21]]，将 LS-ECNF 完全拓展到 PBO 问题上，并创造性的提出了打分函数：

$$
score(x) = hscore(x) + oscore(x)
$$

与约束加权策略：

对于每个约束 $c$，我们首先初始化一个权重 $w(c) = 1$，当搜索卡在局部最优时，我们更新约束的权重：

- 对于每个未满足的硬约束：$w(c) = w(c) + 1$
- 对于目标约束，如果当前目标约束未满足且 $w(oc) \cdot coeff(oc) - avgcoeff \leq \zeta$，那么 $w(oc) = w(oc) + 1$

在实验上也取得了不错的效果（至少比 Max-SAT 的求解器要好不少，也比基于 RoundingSAT 的 HYBRID 要好），后续的几个求解器都是基于 LS-PBO 的改进

## DeciLS-PBO

[[jiangDeciLSPBOEffectiveLocal2023|DeciLS-PBO FCS'23]] 的作者来自吉大，这篇文章的改进点主要是两个部分：

1. 初始化赋值，这里使用了 [[leiExtendedConjunctiveNormal2020#广义单元传播算法|LS-ECNF]] 中的加强版广义单元传播算法来赋值
2. 使用了 care 值来跳出局部最优，当陷入局部最优时，依概率优先选择那些很长时间没有被选择过的硬约束，而不是随机选择

但实验的效果不算特别好

## NuPBO

[[chuMoreEfficientLocal2023|NuPBO CP'23]] 的作者来自 [[#LS-PBO]] 的团队，改进点主要为打分函数，并根据这个打分函数设计了更好的约束加权策略，具体表现为：

1. [[chuMoreEfficientLocal2023#打分函数|打分函数]]
   - 我们为打分函数引入了平滑项，用以避免过大的系数导致的错误搜索方向
2. [[chuMoreEfficientLocal2023#加权方案|加权策略]]
   - 在搜索开始的最开始，每个硬约束的权重被初始化为 $w(c) = 1$，目标函数的权重被初始化为 $w(o) = 0$
   - 随着搜索的进行，当进入到局部最优时，对每个不满足的硬子句 $c$，我们更新为 $w(c) = w(c) + 1$，而如果不存在不满足的硬子句（也就是现在是一个可行解），我们更新 $w(o) = w(o) + 1$

实验的效果很好，直接称为了 SOTA 的局部搜索 PBO 求解器

## DLS-PBO & ParLS-PBO

[[chenParLSPBOParallelLocal2024|ParLS-PBO CP'24]] 的作者依然来自于 [[leiEfficientLocalSearch2021|LS-PBO]] 与 [[chuMoreEfficientLocal2023|NuPBO]] 的大团队，这篇文章先提出了一个串行版本 [[chenParLSPBOParallelLocal2024#DLS-PBO|DLS-PBO]] ，主要改进在于打分函数，定义如下：

$$
score^*(x) = hscore(x) + p \cdot oscore(x)
$$

其中，$p$ 是一个动态值，初始化为 $1$，我们做如下更新：

1. 如果我们在最近的 $K$ 次迭代中，都没有找到可行解，我们将 $p$ 调整为 $\frac{p}{inc}$，其中 $inc > 1$
2. 否则，我们将其调整为 $p \cdot inc$

然后将算法并行化，得到了 [[chenParLSPBOParallelLocal2024#并行化 ParLS-PBO|ParLS-PBO]]

值得一提的是，串行版本 DLS-PBO 在实验上的表现不算特别好，其比不过 [[#NuPBO]]，在竞赛的例子上也比不过 Gurobi 的启发式版本，但是效果却能完全支配 [[#DeciLS-PBO]]

# 实验相关

上述的 PBO 求解器，不包含 [[#LS-ECNF]]，都有如下共性

## Benchmark

选取的 Benchmark 都是以下几个：

1. Real-World：包括了以下几个问题：
   1. [Minimum-Width Confidence Band Problem](http://physionet.org/physiobank/database/mitdb/)：24 个实例
   2. [Seating Arrangements Problem](https://www.justinesherry.com/papers/martins-mse17.pdf)：21 个实例
   3. [Wireless Sensor Network Optimization Problem](https://ieeexplore.ieee.org/document/8325588) ：18 个实例
2. [MIPLIB '17](https://zenodo.org/record/3870965)：252 个实例
3. [PB16](http://www.cril.univ-artois.fr/PB16/bench/PB16-used.tar)：PB 2016 的竞赛例子，共 1524 个

## 对比算法

我们以最新的 [[#DLS-PBO & ParLS-PBO]] 为例，其对比的算法如下（只考虑串行版本）：

1. [[#LS-PBO]]
2. [[#DeciLS-PBO]]
3. [[#NuPBO]]
4. HYBRID：基于 RoundingSAT 的 PBO 求解器
5. PBO-IHS：基于 RoundingSAT 的碰集 PBO 求解器
6. Gurobi：最好的商用 MIP 求解器之一（完备版本与启发式版本都使用）
7. SCIP： 最快的非商业 MIP 求解器之一
