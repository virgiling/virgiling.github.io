---
title: LS-ECNF 阅读笔记
description: 
tags:
  - 论文阅读笔记/组合优化
  - 算法讲义/局部搜索算法
  - CCF/A/IJCAI
date: 2024-12-31
lastmod: 2025-01-01
draft: false
cover: 
zotero-key: AJDPEHKJ
zt-attachments:
  - "875"
citekey: leiExtendedConjunctiveNormal2020
---

> [!tldr]
>
> [文章链接](https://www.ijcai.org/proceedings/2020/159)
>
> 本文提出了一种针对 **局部** 基数约束的局部搜索算法 `LS-ECNF` ，通过 ECNF 的形式，可以避免将基数约束编码为 SAT，从而获取更好的求解性能
>
> 本文的后续改进为 [[leiEfficientLocalSearch2021|LS-PBO SAT'21]]，值得注意的是，本文提出的 **基数约束** 本质上是一种特殊 [[leiEfficientLocalSearch2021#PBO 问题简介|PBO]] 形式

# Extended Conjunctive Normal Form and An Efficient Algorithm for Cardinality Constraints

> [!abstract]
>
> Satisﬁability (SAT) and Maximum Satisﬁability (MaxSAT) are two basic and important constraint problems with many important applications. SAT and MaxSAT are expressed in CNF, which is difﬁcult to deal with cardinality constraints. In this paper, we introduce Extended Conjunctive Normal Form (ECNF), which expresses cardinality constraints straightforward and does not need auxiliary variables or clauses. Then, we develop a simple and efﬁcient local search solver LS-ECNF with a well designed scoring function under ECNF. We also develop a generalized Unit Propagation (UP) based algorithm to generate the initial solution for local search. We encode instances from Nurse Rostering and Discrete Tomography Problems into CNF with three different cardinality constraint encodings and ECNF respectively. Experimental results show that LS-ECNF has much better performance than state of the art MaxSAT, SAT, Pseudo-Boolean and ILP solvers, which indicates solving cardinality constraints with ECNF is promising.

# 问题定义与记号

SAT 问题的定义如下：

给定一个变量集合 $X = \{x_1, \dots, x_n\}, x_i \in \{0, 1\}$ ，和一个 CNF 范式 $\mathcal{F} = \bigwedge^m_{j=1}\bigvee^k_{i=1} l_i, l_i \in \{x_i, \neg x_i\}$， 问是否存在一组赋值 $\varphi$ 使得此 $\mathcal{F} = 1$

我们可以将 SAT 问题拓展为一个优化版本：如果我们对子句进行分类，必须满足的子句称为硬子句，可以被不满足的子句称为软子句，我们的优化目标是让不满足的软子句最少，这个问题被称为 Partial MaxSAT，当所有子句都是软子句时，这个问题被称为 MaxSAT

进一步的，如果我们对子句进行加权，我们的优化目标是使得未满足的子句的权值和最小，那么这个问题被称为 Weighed Partial MaxSAT

这里我们研究的只是 PMS 问题（拓展到基数约束版本）

## 基数约束

关于基数约束的定义可以参考 [[abioConflictDirectedLazy2012#Global Constraints|这篇文章]]，简而言之，基数约束可以写为如下形式：

$$
\sum^{r}_{i=1}l_i \triangleright k\quad  \, \triangleright \in \{\geq, \leq, =\}, k \in \mathbb{N^+_0}
$$

> [!note]
>
> 这本质上是传统 SAT 中子句约束的拓展版本，原来的子句约束可以写为：$\sum^{k}_{i=1}l_i \geq 1$

值得注意的是，所有的基数约束都可以写为至少$\geq$的形式，例如至多有 $l$ 个为真可以写为至少有 $r-k$ 个为假：

$$
\sum^{r}_{i=1}l_i \leq k \leftrightarrow \sum^{r}_{i=1}\neg l_i \geq r-k
$$

因此，我们在后面只考虑 “子句中至少有 $k$ 个变量为真” 这一形式的基数约束

对于每条软基数约束 $c$，我们都考虑其有一个惩罚值 $\lambda(c)$ 了，在这里，我们将硬子句也编码为基数约束的形式 ：$\sum^{r}_{i=1}l_i \geq r$

我们需要求解的问题就是，在所有子句形式都是基数约束的条件下（区分软硬子句），求 **当所有硬子句都满足时，不满足的软子句惩罚值最小** 的一个赋值

# LS-ECNF

这里，我们引入两种技术来构建搜索框架：

1. 子句加权
2. 打分函数

## 子句加权

本文的子句加权技术称为 Weighting-EPMS，我们假定对每个子句，都存在一个权重 $w(c)$，注意这个权重不是实例中给定的，是算法引入的，在最开始时，硬子句的 $w(c) = 1$，软子句的 $w(c) = \lambda(c)$（这里的 $\lambda(c) = \lambda$，可以考虑成一个可调的参数）

当搜索卡在局部最优时，也就是我们无法通过翻转变量获得更好的解时，此时，子句的权值会更新如下：

1. 以 $1 - sp$ 的概率，对每个不满足的硬子句 $c$，$w(c) \coloneqq w(c) + 1$，对每个不满足的软子句 $c$，只有当$w(c) \lt \zeta$ 时， $w(c) \coloneqq w(c) + 1$，在本文中，$\zeta = 1000$
2. 以 $sp$ 的概率，对每个满足的子句 $c$，$w(c) \coloneqq w(c) - 1$

## 打分函数

我们首先需要定义对于一个未满足子句 $c$（软硬子句均如此定义），其带来的惩罚值是多少，我们可以根据优化目标进行重写：

$$
penalty(c) = w(c) \times (r - \sum^{r}_{i=1}l_i)
$$

这样，对于一个变量 $x$，我们对其的打分 $score(x)$ 定义为：翻转变量 $x$ 后，目标函数（未满足子句的惩罚值）的下降值

> [!example]
>
> 考虑一个子句 $c \coloneqq x_1 + \dots + x_5 \geq 3$，假设此时 $w(c) = 2$，搜索到的赋值 $\varphi = (1, 0, 0, 0, 0)$
>
> 此时，如果翻转 $x_2$，我们得到的分数为 $score(x_2) = 2 \times (3-2) = 2$

## 整体框架

整体框架如下图所示：

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250101161522166.png)

首先，我们通过 [[#广义单元传播算法]] 初始化一个赋值，然后开始迭代搜索

每次迭代时，我们选择一个 $score(x) > 0$ 的变量做翻转，如果能够得到一个可行解（且比到目前位置的最优解更好），我们就做一次替换，否则继续搜索

而如果我们无法找到任何一个能带来正收益的变量，说明此时我们已经达到了局部最优，于是，我们对通过 [[#子句加权]] 来调整子句的权重，进而调整搜索的方向，接着，我们会优先选择硬子句来满足，以优先得到可行解

# 广义单元传播算法

首先，我们定义广义单元子句（Generalized Unit Clause）：对于子句 $c$，如果其基数约束 $r$ 大于等于此子句中含有的文字数，我们将其称为一个广义单元子句

> [!hint]
>
> 因为这就需要保证 $c$ 中所有文字的赋值均为真，于是我们得到了整条子句中文字的赋值，由此，我们可以直接做一次单元传播，进而简化 CNF 公式

于是，广义单元传播算法的流程如下图所示：

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250101162321750.png)

本质上我们对赋值做了优先级划分：

1. 硬的广义单元子句
2. 软的广义单元子句
3. 其他

# 实验

选取的 Benchmark 为 Nurse Rostering 与 Tomography Problem，都是 OR 中的经典问题，可以在 OR 的 Benchmark 中找到

选取的对比算法为：

1. SATLike
2. Loandra
3. TT-Open-WBO-inc
4. CADICAL
5. Gurobi

采用的 SAT 编码方式为

1. Sequential encoding
2. Cardinality networks encoding
3. Pigeon-hole encoding

效果如下图所示：

护士排班问题：

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250101163433824.png)

离散数字成像问题：

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250101163503880.png)

# ECNF 与 CNF 和 PB 的联系

ECNF 通过引入基数约束的概念对 CNF 进行了扩展，在没有任何辅助变量和子句的情况下，可以将基数约束编码到 ECNF 中，ECNF 可视为 PBO 的特例，这在 [[leiEfficientLocalSearch2021#PBO 问题简介|PBO 问题简介]] 中有提及
