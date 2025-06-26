---
title: 可满足问题描述
description: 
tags:
  - Research/笔记/SAT
date: 2025-03-19
lastmod: 2025-06-09
draft: false
cover:
location: 43.8259282,125.4254779
---

# 复习一些数学知识

> [!note]
>
> 在最开始，我们复习一些基础的离散数学，主要是一元逻辑部分，我们默认读者有基本的位运算基础，如果没有的话，可以查看下面进行学习
>
> > [!hint] 位运算
> > 位运算主要为与，或，非三种，表示为 $\&, |, \neg$，其中，前面两种为二元运算，非运算为一元运算，其真值表的变化为：
> >
> > | y&x | 0   | 1   |
> > | --- | --- | --- |
> > | 0   | 0   | 0   |
> > | 1   | 0   | 1   |
> >
> > | y\|x | 0   | 1   |
> > | ---- | --- | --- |
> > | 0    | 0   | 1   |
> > | 1    | 1   | 1   |
> >
> > | $\neg$x | 0   | 1   |
> > | ------- | --- | --- |
> > |         | 1   | 0   |

我们首先引入一个记号 $\mathbb{B} = \{0, 1\}$，这是一元逻辑中所有变量的定义域

我们称 $\forall x \in \mathbb{B}$ 的 $x$ 为布尔变量，其取值只有 0/1，也就是真/假，对于单个布尔变量，我们有一元运算如下：

$\forall x \in \mathbb{B}, \neg x \in \mathbb{B}$ 其中，$\neg$ 为非运算。

接着，我们定义布尔变量之间的运算，其只有 $+, \cdot$ 两类运算，我们在下面引入记号并详细：

1. $\forall x, y \in \mathbb{B}, x \not= y$，我们有 $x + y = y + x = x \lor y \in \mathbb{B}$，其中 $\lor$ 表示或运算
2. $\forall x, y \in \mathbb{B}, x \not=y$，我们有 $xy = yx = x \land y \in \mathbb{B}$ ，其中 $\land$ 表示与运算

由此，我们可以定义如下布尔函数：

$$
F(x_1, x_2, \dots, x_n): \mathbb{B}^n \rightarrow \mathbb{B}
$$

$x_1, x_2, \dots, x_n$ 通过上文中定义的三种运算结合构成此布尔函数，例如：

$$
F(x_1, x_2, x_3) = (x_1 \lor x_2)\land x_3 \lor \neg(x_2 \lor x_1 \land \neg x_3)
$$

# 可满足问题（SAT 问题）

首先，我们引入一些 SAT 问题中的记号

## CNF

我们通过一些运算规则与定理，可以将任意的布尔函数都转化为[合取范式](https://en.wikipedia.org/wiki/Conjunctive_normal_form)的形式（ `CNF`），例如上式可以转为：

$$
F^\prime(x_1, x_2, x_3) =  (x_1 \vee \neg x_2 \vee x_3)\land(\neg x_1 \lor x_3)\land(\neg x_2 \lor x_3)
$$

也就是通过 $\land$ 连接的若干个 $\lor$ 式，这里：

- 我们将 $\lor$ 式称为 **子句**（clause），每个子句都是由若干个 $l_i \in \{x_i, \neg x_i\}$ 组成
- 我们将 $l_i$ 称为变量 $x_i \in \mathbb{B}$ 对应的 **文字**（literal），若 $l_i  = x_i$，我们将其称为正文字，若 $l_i = \neg x_i$ ，我们将其称为反文字

更进一步的，在 SAT 问题中，我们还有以下名词：

- **极性**（Polarity），通常指变量在子句中的出现形式，换而言之，正文字就是极性为正，反文字就是极性为负
- **赋值** （Assignments），我们可以使用此函数来表示 $\Phi \colon X \rightarrow \mathbb{B}^n$，其中 $X = \{x_1, x_2, \dots, x_n\}$，所有变量 $x_i$ 赋值后得到的一组有序向量，我们将其称为 CNF 的一组赋值

## SAT 定义

这样，我们可以轻松的导出 SAT 问题的定义：

> [!important] SAT 问题
>
> 给定一个 CNF ：$\mathcal{F}(x_1, x_2, \dots, x_n)$，问是否存在一组赋值 $\phi$ 使得 $\mathcal{F} = 1$ 成立

值得一提的是，目前还找不到一种多项式时间的算法来解决这个问题，事实上，著名的未解问题 “[P 是否等于 NP](https://en.wikipedia.org/wiki/P_versus_NP_problem)” 等价于询问这样的算法是否存在。

SAT 问题可以被认为是 “所有[ NP 完全（NP-Complete）](https://en.wikipedia.org/wiki/NP-completeness)问题的起源”

我们在这里不探讨过多的计算复杂性相关的内容，如果你对这些内容感兴趣，可以阅读以下内容入门

- [introduction to the theory of computation](https://drive.uqu.edu.sa/_/mskhayat/files/MySubjects/20189FS%20ComputationTheory/Introduction%20to%20the%20theory%20of%20computation_third%20edition%20-%20Michael%20Sipser.pdf)
- [怎么理解 P 问题和 NP 问题？](https://www.zhihu.com/question/27039635/answer/41577904458)
- [从 OIer 的角度解释什么是 P 问题、NP 问题和 NPC 问题](http://www.matrix67.com/blog/archives/105)

> [!tip] 小知识
>
> 判定一个 CNF 是 UNSAT（不可满足的）会比判断其 SAT （可满足）在工程上要困难，也就是耗时会更多
>
> 这是因为判断 UNSAT 本质上是一个证明，我们必须证明在整个解空间内不存在一组赋值 $\phi$ 使得 $\mathcal{F} = 1$

# SAT 问题的应用

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
