---
title: SMT 基本定义
description:
tags:
  - Status/Pending
  - Research/笔记/SAT
date: 2025-10-18
lastmod: 2025-10-19
draft: true
location:
cover:
---

# 前言

在 [[SAT0x1|SAT]] 中，我们引入了命题逻辑（Propositional Logic）来编码与表达现实问题，但我们知道，Propositional Logic 的表达能力本质上并不是很强，对于一些复杂的问题，我们需要拐着弯通过各种 encoding trick/tweak 用纯粹的命题逻辑 "强行" 表达/抽象 arithmetic 有关的问题。

然而，对于数组/实数/各类复杂的运算甚至函数，我们需要表达能力更强的 First-Order Logic 来为我们支撑，这就引出了 SMT Solver

# SMT 简介

SMT（`Satisfiability Modulo Theories`，可满足性模理论）是一种扩展的逻辑可满足性问题，用于检查包含特定理论（如算术、数组或位向量）的公式是否可满足。它与 [[SAT0x1| SAT 问题]]（布尔可满足性问题）密切相关，SMT 可以看作 SAT 的泛化，SMT 求解器通常先将问题转换为 SAT 部分，再使用理论求解器处理理论部分。

> [!quote]
>
> SAT 是基础，只处理布尔变量和逻辑运算符（如与、或、非），而 SMT 在 SAT 之上引入了理论约束，从而能处理更复杂的现实问题。

在 First-Order Logic 下，我们可以引入更多的 “理论”

1. Linear Integer Arithmetic
2. Real Arithmetic
3. Bit-Vectors
4. Arrays
5. (Equality with) Uninterpreted Functions（可以用于建模程序中未知的函数调用）

> [!example]- 简单的例子
>
> - SAT：$(A \lor B)\land (\neg A \lor C)$，其中 $A, B, C$ 为布尔变量。SAT 求解器会检查是否存在赋值使公式为真
> - SMT 例子：$(x \gt 0) \land (y \lt 10) \land (x + y = 5)$，其中 $x, y \in \mathbb{Z}$。SMT 求解器（使用线性算术理论）会判断是否可满足。

# 实际应用

SMT 的一个比较熟知的应用就是程序分析与验证，如检查断言、验证条件分支或发现错误。它通过将程序代码和待验证属性编码为逻辑公式，然后使用 SMT 求解器（如 Z3）检查公式的可满足性：如果否定的属性可满足，则找到反例；否则属性成立。我们通过下面的例子来说明是如何工作的。

考虑一个 _错误的_ 求最大值函数：

```c
int wrong_max(int a, int b) {
    if (a > b)
        return b; // 错误：应返回a
    else
        return a;
}
```

我们想验证：对于所有整数 $a$ 和 $b$，返回值应满足 $(ret \geq a) \land (ret \geq b)$。

首先我们编码为 SMT 公式：

1. $a, b \in \mathbb{Z}$
2. $(a \gt b) \Rightarrow (ret = b)$, $(a \leq b) \Rightarrow (ret =a)$

我们将返回值需要满足的条件与上文中的两个公式进行合取，从而得到 SMT 需要判定的最终公式

SMT 求解器检查该公式是否可满足。如果可满足，则找到反例（如 a=5, b=3 时，ret=3，但 3<5），证明属性不成立，从而发现代码错误
