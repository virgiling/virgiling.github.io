---
title: ParLS-PBO 阅读笔记
description: 
tags:
  - 论文阅读笔记/组合优化
  - 算法讲义/局部搜索算法
  - CCF/B/CP
date: 2024-12-31
lastmod: 2025-01-01
draft: false
cover: 
zotero-key: CEGP8VJB
zt-attachments:
  - "944"
citekey: chenParLSPBOParallelLocal2024
---

> [!tldr]
>
> [文章链接](http://arxiv.org/abs/2407.21729)
>
> 串行的算法中，引入了动态评分策略后，在并行的策略结合了种群的概念，引入了解池，通过共享高质量解与变量的极性密度（更倾向是 0/1）提高了跳出局部最优的能力

# ParLS-PBO: A Parallel Local Search Solver for Pseudo Boolean Optimization

> [!summary]
>
> As a broadly applied technique in numerous optimization problems, recently, local search has been employed to solve Pseudo-Boolean Optimization (PBO) problem. A representative local search solver for PBO is LSPBO. In this paper, firstly, we improve LSPBO by a dynamic scoring mechanism, which dynamically strikes a balance between score on hard constraints and score on the objective function. Moreover, on top of this improved LSPBO , we develop the first parallel local search PBO solver. The main idea is to share good solutions among different threads to guide the search, by maintaining a pool of feasible solutions. For evaluating solutions when updating the pool, we propose a function that considers both the solution quality and the diversity of the pool. Furthermore, we calculate the polarity density in the pool to enhance the scoring function of local search. Our empirical experiments show clear benefits of the proposed parallel approach, making it competitive with the parallel version of the famous commercial solver Gurobi.

# PBO Problem

我们首先给定什么是 _PBO_ 问题：

$$
\begin{aligned}
\min_{\{x_1, \dots, x_n\}} \, &\sum^n_{i=1}c_i \cdot l_i, \quad c_i \in \mathbb{Z} \\
s.t. \quad &\bigwedge^m_{j=1}\sum^n_{i=1}a_{ji}\cdot l_i \geq b_j, \quad a_{ji}, b_{j} \in \mathbb{N^+_0}
\end{aligned}
$$

# Review of LS-PBO

_LS-PBO_ 作为 PBO 局部搜索求解器中的代表（也是其他局部搜索求解器的核心部件），其核心的思想为以下两点：

1. [[leiEfficientLocalSearch2021#Constraint Weighting Scheme|约束加权方案]]
2. [[leiEfficientLocalSearch2021#Score Function|打分函数]]

例如一个 PBO 问题，_LS-PBO_ 期望找到这样一个解（假定目标为最小化）：$\sum^n_{i=1}c_i \cdot l_i \lt obj^*$，其中 $obj^*$ 表示目标函数在本次搜索时找到的最优值

> [!hint]
> 注意，这里将目标函数视为一种约束，我们称为目标约束，在最开始时，$obj^* = \infty$

_LS-PBO_ 使用加权技术来增加未满足的约束的权重，使搜索过程偏向于满足它们，具体而言，其动态调整这些权重，这里我们用 $w(\cdot)$ 来表示。

对于打分函数，在 _LS-PBO_ 中，对于翻转一个变量 $x$，我们将收益表示为以下形式：

$$
score(x) = hscore(x) + oscore(x)
$$

其中，$hscore(x)$ 表示翻转 $x$ 后未满足的硬约束满足了多少（或者减少了多少惩罚值），$oscore(x)$ 表示翻转 $x$ 后，目标函数（软约束）满足了多少（或者减少了多少惩罚值）

我们将硬约束的惩罚定义为 $w(hc) = \max (0, b - \sum^n_{i=1}a_i\cdot l_i)$，目标约束的惩罚值定义为 $w(oc)  = \sum^n_{i=1}c_i \cdot l_i$

# DLS-PBO

但我们发现，_LS-PBO_ 缺少对软硬约束比例的动态调整，换而言之，在长时间找不到可行解时，我们应该提高硬约束的在打分中的占比，使得我们能够快速找到一个可行解；相反，如果我们能够快速找到可行解，那么我们应该提高软约束在打分中的比例，使得我们能够寻找到更好的可行解

于是，我们提出一种动态评分机制，定义如下：

$$
score^*(x) = hscore(x) + p \cdot oscore(x)
$$

其中，$p$ 时一个动态值，初始化为 $1$，我们做如下更新：

1. 如果我们在最近的 $K$ 次迭代中，都没有找到可行解，我们将 $p$ 调整为 $\frac{p}{inc}$，其中 $inc > 1$
2. 否则，我们将其调 整为 $p \cdot inc$

> [!example]-
>
> $$
> \begin{aligned}
> \min_{\{x_1, x_2, x_3\}} &10 \cdot x_1 + 20 \cdot x_2 + 30 \cdot x_3 \\
> s.t. \quad &2 \cdot x_1 + 3 \cdot x_2 + 4 \cdot x_3 \geq 5
> \end{aligned}
> $$
>
> 假设此时，$w(hc) = 2, w(oc) = 1$，对于给定的赋值 $\phi = (1, 0, 0)$，我们其分值如下：
>
> |                 | $x_1$ | $x_2$ | $x_3$ |
> | --------------- | ----- | ----- | ----- |
> | $hscore(\cdot)$ | -4    | 6     | 6     |
> | $oscore(\cdot)$ | 10    | -20   | -30   |
>
> 考虑以下两种情况：
>
> 1. 如果最近 $K$ 次搜索中我们已经发现过可行解，此时的 $p$ 会增大，不妨假设现在的 $p = 2$，于是，$score^*(x_1) = 16, score^*(x_2) = -34, score^*(x_3) = -54$，于是我们选择 $x_1$ 做翻转（即使翻转之后变成不可行解了）
> 2. 否则，我们会减小 $p$，不妨设此时的 $p = 0.1$，于是我们得到 $score^*(x_1) = -3, score^*(x_2) = 4, score^*(x_3) = 3$，随后，我们翻转 $x_2$

# 并行化 ParLS-PBO

## 框架

_ParLS-PBO_[^2] 的总体框架如下所示

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20241230195338341.png)

具体而言，并行框架由一个 `master`[^1] 线程和多个 `worker` 线程组成，其中 `master` 线程负责读取实例并通过 `literal assume` 为 `worker` 初始化不同的赋值（部分赋值），当时间耗尽后，`master` 线程会给出搜索到的最优解。

> [!note]
>
> `literal assume` 的做法为，假设有 $T$ 个 `worker` 线程，那么 `master` 线程会随机选择 $\lceil\frac{T}{2}\rceil$ 个变量，对每个选择的变量 $x_i$，生成对应的正文字与反文字 ，将这些文字传递给 `worker` 线程

每个 `worker` 线程收到一个文字 $x_i$ 或者 $\neg x_i$ 后，会直接做单元传播，简化约束与目标函数，然后，`worker` 开始局部搜索，也就是上文提到的 [[#DLS-PBO]]

## Solution Pool

为了使得不同的 `worker` 线程能够获取各自的信息（以求得更好的解），这里引入了解池的概念

当一个 `worker` 线程的搜索过程在翻转一定数量的变量后卡在局部最优时，就会尝试使用解池中的高质量的可行解，然后重启，继续进行搜索。 ^245ac4

那么这里，如何评价一个解是否够好（是否需要被加入到解池中）呢？我们考虑一个混合质量排名函数：

$$
r_{mix}(S) = rank_{obj}(S)\cdot p^* + rank_{div}(S) \cdot(1-p^*)
$$

其中，$rank_{obj}(S), rank_{div}(S)$ 分别表示 $S$ 在解池中的目标函数排名与多元化值排名，$p \in [0, 1]$，用于控制哪个排名的占比更大

最优解的目标函数值时最小的，于是 $rank_{obj}(S^*) = 1$，多元化值最大的排名最高，定义为 $rank_{div}(S^*) = 1$，我们定义多元化值的计算方式为： $div(S) = \sum_{S^\prime \in \mathcal{P}}Hamming(S, S^\prime)$

当 `worker` 线程找到一个新的可行解时，如果解池未满，则直接加入，否则，计算这个解的 $r_{mix}(S)$，并与解池最大的 $r_{mix}(S^\prime)$ 比较，如果 $r_{mix}(S) < r_{mix}(S^\prime)$，那么我们会将新的解加入，将最差的解剔除

## 如何使用 Solution Pool

我们在 [[#Solution Pool|前文]] 中提到了，解池能够指导搜索，具体而言，解池通过以下两个策略来指导搜索过程

### Solution Sharing

当 `worker` 线程在一段时间内未能找到较好的可行解，即可能陷入局部最优时，从解池中选择目标函数值较小的可行解并替换当前可行解

在实际应用中，每个工作线程保存当前最优可行解(记为 $S^*$ )以及相应的目标值 $obj^*$ 。当搜索过程在 $R$ 步之后未能找到较优解时，从解池中挑选一个解后重启

为了防止不同线程之间搜索空间的过度重叠，我们采用基于概率的方法来选择池中的解决方案，而不是直接选择池中的最佳解决方案。具体地，假设 $\{S_1, \dots, S_k\}$ 表示目标值不大于 $obj^*$ (集合不会为空,因为它至少包含 $S^*$ )的解池中可行解的集合，$\Delta i$ 表示 $S_i$ 目标值与 $obj^*$的差值。则选择 $S_i$ 的概率为 $\frac{\Delta_i}{\sum^k_{j=1}\Delta_j}$

### Polarity Density Weight

> [!hint]
>
> 这里的极性密度，其实和种群中，哪些变量的值经常在高质量解中出现，我们认为这个取值，大概率是最优解中的取值

我们提出了变量 $x$ 的极性密度权重的概念，记为 $w_{pd}(x)$，它反映了 $x$ 在高质量解中出现的某种极性的偏好

最开始时，我们将其初始化为 $1$，随着高质量解 $S$ 被加入到解池后，我们按照以下规则进行更新：

$$
w_{pd}(x) = \begin{cases}
&\max (w_{pd}(x) - \beta, 1-\epsilon), \, if \, x = 0 \in S \\
&\min (w_{pd}(x) + \beta, 1+\epsilon), \, if \, x = 1 \in S
\end{cases}
$$

极性密度权重用于增强搜索过程中挑选一个变量进行翻转的打分函数。由此得到的增强型得分函数，记为$score^{**}(x)$，定义如下：

$$
score^{**}(x) = \begin{cases}
&score^*(x) \times w_{pd}(x), \, if \, x=0 \in S_{cur}\\
&score^*(x) / w_{pd}(x), \, otherwise
\end{cases}
$$

其中 $S_{cur}$ 表示当前由局部搜索获得的当前赋值

# 实验

使用 Benchmark 为：

1. 真实世界的例子，Minimum-Width Confidence Band Problem， Seating Arrangements Problem， Wireless Sensor Network Optimization Problem
2. [MIPLIB](https://zenodo.org/record/3870965) 中的例子
3. [PB16](http://www.cril.univ-artois.fr/PB16/bench/PB16-used.tar) 中的例子

对比了以下算法：

1. [[leiEfficientLocalSearch2021|LS-PBO]][^3]
2. [[jiangDeciLSPBOEffectiveLocal2023|DeciLS-PBO]][^4]
3. [[chuMoreEfficientLocal2023|NuPBO]][^5]
4. HYBRID[^6]
5. PBO-IHS[^7]
6. Gurobi[^8]
7. SCIP[^9]
8. FiberSCIP[^10]

选择的参数如下表：

| Parameter | $K$    | $R$   | $inc$ | $poolsize$ | $p^*$ | $\beta$ | $\epsilon$ |
| --------- | ------ | ----- | ----- | ---------- | ----- | ------- | ---------- |
| Value     | 566024 | 56295 | 1.15  | 18         | 0.58  | 0.03    | 0.144      |

`DLS-PBO` 的实验的结果如下表：

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20241230212859043.png)

`ParLS-PBO` 的表现如下表

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20241230212851193.png)

[^1]: 一个小趣事，`master` 这个词在分布式中经常使用，但近年来由于某种政治正确，似乎会改口为 `coordinator`（在 `github` 中以前的主分支默认 `master`，后来变为 `main`）
[^2]: 源代码可见 [ParLS-PBO](https://github.com/shaowei-cai-group/ParLS-PBO.git)
[^3]: 源代码可见 [LS-PBO](https://lcs.ios.ac.cn/~caisw/Resource/LS-PBO/)
[^4]: 源代码可见 [DeciLS-PBO](https://github.com/jiangluyu1998/DeciLS-PBO)(commit: 3dce881)
[^5]: 源代码可见 [NuPBO](https://github.com/filyouzicha/NuPBO)(commit: 821d901)
[^6]: https://zenodo.org/record/4043124 (version 2)
[^7]: https://bitbucket.org/coreo-group/pbo-ihs-solver (version 1.1)
[^8]: https://www.gurobi.com/solutions/gurobi-optimizer (version 10.0.0)
[^9]: https://www.scipopt.org/index.php#download (version 8.0.1)
[^10]: https://ug.zib.de/index.php#download (version 1.0.0)
