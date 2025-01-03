---
title: DeciLS-PBO 阅读笔记
description: 
tags:
  - 论文阅读笔记/组合优化
  - 算法讲义/局部搜索算法
  - CCF/B/FCS
date: 2024-12-31
lastmod: 2025-01-03
draft: false
cover: 
zotero-key: 4PNQ9SEH
zt-attachments:
  - "940"
citekey: jiangDeciLSPBOEffectiveLocal2023
---

> [!tldr]
>
> [文章链接](http://arxiv.org/abs/2301.12251) 与 [代码链接](https://github.com/jiangluyu1998/DeciLS-PBO)
>
> 本文和 [[chuMoreEfficientLocal2023|NuPBO CP'23]] 是同年的文章，因此没有对比，这篇文章的 [[#实验|实验效果]] 看了一下是不如 [[chuMoreEfficientLocal2023#实验结果|NuPBO 的效果]] 的，尤其是 300s 中 MWCB 和 SAP，`NuPBO` 能够全部都比 [[leiEfficientLocalSearch2021#Experiments|LS-PBO 的效果]] 好，但本文有一些还是不如 LS-PBO，甚至在 [[chenParLSPBOParallelLocal2024#实验|ParLS-PBO CP'24]] 中直接注明了 `DeciLS-PBO` 被 `NuPBO` 和 `DLS-PBO` 支配了

# DeciLS-PBO: an Effective Local Search Method for Pseudo-Boolean Optimization

> [!abstract]-
>
> Local search is an effective method for solving large-scale combinatorial optimization problems, and it has made remarkable progress in recent years through several subtle mechanisms. In this paper, we found two ways to improve the local search algorithms in solving Pseudo-Boolean Optimization (PBO): Firstly, some of those mechanisms such as unit propagation are merely used in solving MaxSAT before, which can be generalized to solve PBO as well; Secondly, the existing local search algorithms utilize the heuristic on variables, so-called score, to mainly guide the search. We attempt to gain more insights into the clause, as it plays the role of a middleman who builds a bridge between variables and the given formula. Hence, we first extended the combination of unit propagation-based decimation algorithm to PBO problem, giving a further generalized definition of unit clause for PBO problem, and apply it to the existing solver LS-PBO for constructing an initial assignment; then, we introduced a new heuristic on clauses, dubbed care, to set a higher priority for the clauses that are less satisfied in current iterations. Experiments on benchmarks from the most recent PB Competition, as well as three real-world application benchmarks including minimum-width confidence band, wireless sensor network optimization, and seating arrangement problems show that our algorithm DeciLS-PBO has a promising performance compared to the state-of-the-art algorithms.

> [!important]
>
> 由于这篇文章的效果不如先前看过的，所以我就大概写一下几个核心思想，不再过多举例

# 核心思想

## 初始化更好的赋值

首先，我们通过 `IGUP-Decimation` 来初始化赋值，此算法如下图所示：

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250101202924515.png)

做法与 LS-ECNF 中的 [[leiExtendedConjunctiveNormal2020#广义单元传播算法|GUP]] 十分类似，在这里，对于一条 PB 约束 $\sum_i a_i l_i \geq B$，我们定义 `generalized unit clasue` 如下：

1. 如果文字 $l_j$ 的系数 $a_j$ 最大，且满足 $\sum_i a_i - a_j \leq B$ ，我们将这个文字 $l_j$ 称为 `1-of-all` 的广义单元子句
2. 如果 $\sum_i a_i \leq B$ 恒成立，那么我们成这条约束为广义单元约束
3. 广义单元约束中的每一个文字 $l_i$ 都是一个 `all-of-all` 广义单位子句

现在，给定一个广义单元约束 $c$，最高系数的文字一定是一个 `1-of-all` 广义单元子句

于是，我们的做法为，首先找到所有的 `1-of-all` 与 `all-of-all` 广义单元子句，将这些广义单位子句赋值为真，这样，我们就能简化 PB 约束

主框架如下图所示：

![image.png|825](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250101202828500.png)

在获取到初始赋值后，我们进入迭代搜索，这里主要需要注意几点：

1. 打分函数，这里的打分函数与 [[leiEfficientLocalSearch2021#Score Function|LS-PBO]] 中的一致
2. 约束加权，策略与 [[leiEfficientLocalSearch2021#Constraint Weighting Scheme|LS-PBO]] 的一致
3. 如何跳出局部最优

## 跳出局部最优

这里使用了一种名为 `Care-FC scheme` 的启发式策略，首先，我们定义对于一个 PB 约束 $c$，其 $care(c)$ 表示其未满足的次数

> [!danger]
>
> 文章感觉这定义也没说明白，原文是 "The care of a PB constraint c, denoted by care(c), is the total falsified count of constraint c."
> 看半天都不知道到底指的什么，去看了眼代码，才知道什么意思

`unsat_count[c]` 就是上文提到的 $care(c)$，最开始时会初始化为 $0$，每次调用 `update_hardunsatcount` 时进行更新，代码如下所示：

```c showLineNumbers {4-5}
void Satlike::update_hardunsatcount(){
	int i,c;
	for (i = 0; i < hardunsat_stack_fill_pointer; ++i){
		c = hardunsat_stack[i];
		unsat_count[c]++;
	}
}
```

本质上的思想就是，当陷入局部最优时且当前解还不是一个可行解：

- 以 $p$ 的概率随机选一个不满足的硬约束，然后从里面选得分最高的变量翻转
- 否则，以 $1-p$ 的概率，选择那些 `care` 值较高的，因为这样的约束很可能很久都没有被选中

注意，这个函数在 `flip` 后会被调用一次，更新 `care` 值

> [!tip]
>
> 主打一个端水，全部一碗水端平

# 实验

实验效果其实不算很好，Benchmark 比 [[chuMoreEfficientLocal2023|NuPBO]] 也少了两个，比一下共同的：

![image.png|500](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250101210406823.png)

![image.png|500](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250101210415018.png)

![image.png|500](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250101210433206.png)
