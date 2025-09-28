---
title: RoundingSAT 阅读笔记其二
description:
tags:
  - Research/阅读/SAT
  - CCF/B/CP
  - conference
  - Status/Doing
date: 2025-03-16
lastmod: 2025-09-27
draft: true
cover:
zotero-key: L4UF76PH
zt-attachments:
  - "868"
citekey: devriendtWatchedPropagation$0$1$2020
link: https://link.springer.com/10.1007/978-3-030-58475-7_10
location: 43.8259282,125.4254779
---

> [!tldr]
>
> [文章链接](https://link.springer.com/10.1007/978-3-030-58475-7_10) 是 `RoundingSAT` 求解器系列的第三篇文章，[[elffersDivideConquerFaster2018|第一篇]] 文章主要是提出了如何把 CDCL 用到 PB 中来，第二篇是联动 [SoPlex](https://soplex.zib.de/) 求解器

# Watched Propagation of 0-1 Integer Linear Constraints

> [!summary]
>
> Eﬃcient unit propagation for clausal constraints is a core building block of conﬂict-driven clause learning (CDCL) Boolean satisﬁability (SAT) and lazy clause generation constraint programming (CP) solvers. Conﬂict-driven pseudo-Boolean (PB) solvers extend the CDCL paradigm from clausal constraints to 0-1 integer linear constraints, also known as (linear) PB constraints. For PB solvers, many diﬀerent propagation techniques have been proposed, including a counter technique which watches all literals of a PB constraint. While CDCL solvers have moved away from counter propagation and have converged on a two watched literals scheme, PB solvers often simultaneously implement different propagation algorithms, including the counter one.

# Motivation

在基于 CDCL 的 PB 求解中，随着 PB 学习约束库在求解过程的增长，PB 的约束传播成为搜索过程中最主要的耗时组件。

`Galena` 求解器研究了一种高度复杂的用于伪布尔约束的观察字，但最终采用了三层式方法：子句和基数约束通过专门的观察字传播处理，而通用 PB 约束的传播则通过计数器传播实现，该方法能同时观察所有文字。`Pueblo` 求解器最初采用相同的三层方法，但后来选择了一个定制的观察字方法。`Sat4J` 默认情况下也使用三层架构，但对于一般 PB 约束使用类似于 `Galena` 的方法。最后，`RoundingSat` 采用了观察传播，与 `Pueblo` 和原始 `Galena` 方法有相似之处，但增加了自己的一些方法。

然而目前基于观察字的传播依然是一个 open problem，因为我们还没找到一种高效的惰性数据结构来观察约束中的文字，因此本文提出了一种高效的基于观察的 PB 约束传播算法。

# 记号与前置知识

我们在这里沿用 [[elffersDivideConquerFaster2018#单元传播|前文]] 中度以及 $slack$ 的定义，例如对约束 $C \coloneqq 3x + 2y + z + w \geq 3$ ，在最开始，其部分赋值 $\rho = \emptyset$ ，因此 $slack(C, \rho) = -3 + 3 + 2 + 1 + 1 = 4$

我们首先解释 Counter PB 传播的工作原理，由上面的 $slack$ 我们可知：

若当前有文字 $l_i$ 未被赋值，且其在约束 $C$ 中的系数为 $c_i$，那么我们有 $slack(C, \rho) \lt c_i$

如果这个不等式成立，那么我们当 $l_i$ 为真时 $C$ 才能够成立，此时，我们说我们传播了 $l_i$ ，而如果存在不等式 $slack(C, \rho) \lt 0$ 成立，那么我们说此时发生了冲突，然后求解器会进入冲突分析的阶段。

我们通过先前的例子来解释这个传播过程：

1. 此时我们决策 $x = 0$ 成立，那么 $\rho = (\bar{x})$ ，此时 $slack(C, \rho) = 1$
2. 对于文字 $y$ ，我们有 $slack(C, \rho) < 2$ 成立，那么 $y$ 被传播为真 $\rho = (\bar{x}, y)$ ，此时不会有任何 $slack$ 减小发生，于是传播会停止
3. 下一次我们决策文字 $z = 0$ ，那么此时 $\rho = (\bar{x}, y, \bar{z})$ ，$slack(C, \rho) = 0$
4. 对于文字 $w$ ，我们有 $slack(C, \rho) < 1$ 成立，于是此时我们直接传播 $w = 1$，并满足了约束 $C$

> [!important] 缺陷
>
> 考虑这个例子 $C \coloneqq 3x + 2y +z + \sum_{i=0}^{1000} w_i \geq 3$ ，如果我们最开始赋值的是其中任意一个 $w_i = 0$，那么 $slack(C, \rho) = 1003$，而每次我们决策 $w_i$ 时，$slack$ 最多减少 1，在这么多次下降时，我们永远无法进行传播（因为如果我们一直没有将 $x, y$ 赋值为假的话 ，没办法使得 $slack(C, \rho) \lt c_i$ 成立）

# 基于观察字的传播

我们将 SAT 中的观察字技术引入到 PB 中来，具体而言，我们引入了一个集合 $watches(C)$ 来表示约束 $C$ 中的观察字集合，并定义了另一个分数：

$$
watchslack(C, \rho) = -w + \sum_{\bar{l_i}\not\in \rho, l_i \in watches(C)}c_i
$$

显然，对于任意一个约束 $C$，我们都有 $watchslack(C, \rho) \leq slack(C, \rho)$，当且仅当所有未被观察的文字都被赋值为假时，上式能够取等。

现在，我们定义一些记号，用于我们算法的描述：

1. $maxcf(C)$ 表示约束 $C$ 中系数的最大值
2. 一条约束 $C$，我们通过一个三元组 $(terms, w, wslk)$ 来表示，其中：
   3. $terms$ 表示由一个三元组 $(coef, lit, wflag)$ 组成的有序序列（顺序为 $coef$ 的递减顺序），这里的 $coef$ 表示系数，$lit$ 表示文字，$wflag$ 标注是否为观察字
   4. $w$ 为正数，表示约束 $C$ 的度
   5. $wslk$ 为上文中的 $watchslack$
3. 6. 的状态我们用一个四元组 $(\psi, \rho, q, wlist)$ 来表示，其中：
   7. $q$ 是传播索引，满足 $0 \leq q \leq size(\rho)$
   8. $wlist$ 是一个函数，将文字映射到约束集合的函数，例如 $(C, i) \in wlist(l)$ 当且仅当 $l \in watches(C) \wedge l = C.terms[i].lit$
   9. $\rho^{i} = (\rho[1], \dots, \rho[i])$ 表示一个局部赋值，其中 $0 \leq i \leq size(\rho)$
   10. 传播索引表示当前赋值的哪一部分已经被传播，也就是在只有 $\rho \setminus \rho^q$ 中的观察字需要被检查是否需要传播

现在，我们正式开始描述算法，在初始时，没有约束被传播/冲突，且 $q = 0$，我们考虑 $C \coloneqq 3x + 2y +z + \sum_{i=0}^{1000} w_i \geq 3$ ，观察字集合为 $\{x, y, z\}$

假设求解器的决策序为 $\bar{w}_1 \sim \bar{w}_{997}$ ，在每次决策后，我们会调用 `processWatches` 来处理观察字：

![image.png|550](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250318154732775.png)

可以发现，由于$\bar{w}_1 \sim \bar{w}_{997}$ 都不是观察字，因此我们不会进入传播的过程，只能得到 $q \leftarrow 997$
此时，我们决策文字 $\bar{x}$ ，得到 $\rho =(\bar{w}_1, \dots, \bar{x}_{997}, \bar{x})$

那么，我们首先将 $q \leftarrow q + 1 = 998$，由于 $x$ 是 $C$ 的观察字，那么我们减少 $C.wslk \leftarrow -3 + 2 + 1$ 并进行传播，我们传入的 $idx = 1$

![image.png|650](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250318155740727.png)

而 $maxcf(C) = 3$，我们进入 `while` 迭代，并选择那些不是观察字且没有被赋值为假的变量所对应的文字，将这些文字设置为观察字。在这里，我们会引入新的观察字 $w_{998}, w_{999}, w_{1000}$，此时 $C.wslk = 3$

下一步，我们将 $x$ 从观察字列表中去除，并结束这一次的传播。最终，我们得到新的观察字列表：$\{y, z, w_{998}, w_{999}, w_{1000} \}$


接着，我们决策 $\bar{z}$ ，从而得到赋值为  $\rho =(\bar{w}_1, \dots, \bar{x}_{997}, \bar{x}, \bar{z})$，然后运行 `processWatches` 得到 $q \leftarrow 999, C.wslk \leftarrow 2$，然后调用函数  `propagate(C, 3)`

此时，我们发现无法找到新的观察字使得 $C.wslk \geq maxcf(C)$ ，那么我们考虑当前约束可能能进行传播赋值，此时，我们通过检查当前约束中是否存在那些没有赋值的文字，将其赋值为真。显然这里我们做不了任何传播，于是直接退出。

> [!hint] 
> 
> 我们在这里通过 $C.wslk \lt C[j].coef$ 来优化：我们先前所说，项在约束中是按照 $coef$ 递减排序的，而这里我们值需要传播那些只要赋值为真，就能保证约束为真的文字，通过前面的条件，我们能够避免扫描整个约束中的文字

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250318162257953.png)

回跳函数如图所示
