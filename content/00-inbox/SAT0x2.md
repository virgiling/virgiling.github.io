---
title: SAT 的应用和变形
description:
tags:
  - Research/笔记/SAT
  - Status/Pending
date: 2025-04-19
lastmod: 2025-10-20
draft: true
location: 
cover:
---

# 一些简单应用介绍

生活中的许多问题都能通过一系列的编码，将其转化为 SAT 问题，在这里我们举一些例子

## [Keller’s conjecture](https://en.wikipedia.org/wiki/Keller%27s_conjecture)

> [!info]
>
> 如果一个 $N$ 维空间被 $N$ 维相同的超立方体所覆盖，则至少两个超立方体必须共享一个面。

## 集合覆盖问题

> [!info] 集合覆盖问题
>
> 给定全集 $\mathcal{U}$，以及一个包含 $n$ 个集合且这 $n$ 个集合的并集为全集的集合 $\mathcal{S}$。
>
> 集合覆盖问题要找到 $\mathcal{S}$ 的一个最小的子集，使得他们的并集等于全集。

> [!example] 集合覆盖问题实例
>
> 例如全集 $\mathcal{U} = \{ 1, 2, 3, 4, 5\}$，$\mathcal{S} = \{\{1, 2, 3\}, \{2, 4\}, \{3, 4\}, \{4, 5\} \}$，我们可以找到这样一个最小的子集 $\{ \{1, 2, 3\}, \{4, 5\} \}$，使得这个子集的并集为全集 $\mathcal{U}$

对于集合覆盖问题，可以发现这是一个优化问题，但我们可以轻松的将其转化为一个判定问题：

> [!info] 集合覆盖问题的判定版本
>
> 给定一个正整数 $k$ ，是否存在 $k$ 个 $\mathcal{S}$ 的子集，使得这些子集的并集等于全集

这个版本我们可以按照一下编码为 SAT 问题：

我们使用变量 $x_i$ 来表示集合 $\mathcal{S}_i$ 是否被选择，$\top$ 表示被选中，$\bot$ 表示不被选中

对于全集中的元素 $e_j$，我们根据 **每个元素都被覆盖** 来构造子句：

$$
\bigvee_{t \in \{ i|e_j \in S_i\}} x_t
$$

接着，我们需要判定选定的集合数小于等于 $k$，关于这一点，我们需要使用 [[reevesImpactLiteralSorting#基数约束|基数约束]] 来表示：

$$
\sum x_i \leq k
$$

由于基数约束是可以 [[reevesImpactLiteralSorting#编码方式|编码]] 为前文提到的 [[#CNF]] 形式，于是我们将集合覆盖问题转为 SAT 问题。

### 精确集合覆盖

这里我们再介绍一个变形，精确集合覆盖问题

> [!info] 精确集合覆盖
>
> 在集合覆盖的基础上，我们要求，全集 $\mathcal{U}$ 中的每个元素只能被覆盖一次

这个问题的应用有很多，可以参考 [一个错误的回答](https://www.zhihu.com/question/323771432/answer/122575672885?share_code=fMQ8DzFTDg6s&utm_psn=1915505678593787018) 里提到的应用，虽然他对问题有误解，但应用确实是对的。

精确集合覆盖等价于 XSAT (Exact SAT) 问题，也是 NP 完全的，不过在工业上还有 [基于 ZDD 的 DLX](https://ojs.aaai.org/index.php/AAAI/article/view/10662)，在性能上会更好。

回到先前的 SAT 编码，我们本质上就是在每一条子句上都加上一条约束：**这条子句中只有一个文字为真**

如果我们按照布尔代数来考虑，那么原先的子句可以写为：

$$
\sum_{t \in  \{i| e_j \in S_i\} } x_t \geq 1
$$

现在，我们转变为：

$$
\sum_{t \in  \{i| e_j \in S_i\} } x_t \geq 1
$$
