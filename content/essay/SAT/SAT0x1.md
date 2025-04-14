---
title: SAT 问题描述及其应用
description: 
tags:
  - 算法讲义/SAT
  - 一些随笔/2025
date: 2025-03-19
lastmod: 2025-03-29
draft: true
cover:
---

# SAT 问题定义

## A Review of Math

在最开始，我们复习一些基础的离散数学，主要是一元逻辑部分，我们默认读者有基本的位运算基础，如果没有的话，可以查看下面进行学习：

> [!hint] 位运算
>
> 位运算主要为与，或，非三种，表示为 $\&, |, \neg$，其中，前面两种为二元运算，非运算为一元运算，其真值表的变化为：
>
> | y&x | 0   | 1   |
> | --- | --- | --- |
> | 0   | 0   | 0   |
> | 1   | 0   | 1   |
>
> | y\|x | 0   | 1   |
> | ---- | --- | --- |
> | 0    | 0   | 1   |
> | 1    | 1   | 1   |
>
> | $\neg$x | 0   | 1   |
> | ------- | --- | --- |
> |         | 1   | 0   |

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

然而，我们通过一些运算规则与定理，可以将任意的布尔函数都转化为 `CNF` 的形式，也就是合取范式：合取范式通过

## Defination of SAT Problem

