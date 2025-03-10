---
title: 基数约束SAT的精确求解器
description: 
tags:
  - 论文阅读笔记/约束求解
  - CCF/A/CAV
date: 2025-03-10
lastmod: 2025-03-10
draft: true
cover: 
zotero-key: H7XNRYL7
zt-attachments:
  - "1003"
citekey: reevesClausesKlauses2024
---

> [!tldr]
>
> [文章链接](https://link.springer.com/10.1007/978-3-031-65627-9_6)

# From Clauses to Klauses

> [!abstract]
>
> Satisﬁability (SAT) solvers have been using the same input format for decades: a formula in conjunctive normal form. Cardinality constraints appear frequently in problem descriptions: over 64% of the SAT Competition formulas contain at least one cardinality constraint, while over 17% contain many large cardinality constraints. Allowing general cardinality constraints as input would simplify encodings and enable the solver to handle constraints natively or to encode them using different (and possibly dynamically changing) clausal forms. We modify the modern SAT solver CADICAL to handle cardinality constraints natively. Unlike the stronger cardinality reasoning in pseudo-Boolean (PB) or other systems, our incremental approach with cardinality-based propagation requires only moderate changes to a SAT solver, preserves the ability to run important inprocessing techniques, and is easily combined with existing proofproducing and validation tools. Our experimental evaluation on SAT Competition formulas shows our solver conﬁgurations with cardinality support consistently outperform other SAT and PB solvers.

# Introduction

对于基数约束而言，即使存在 PB 求解器，其推理能力比 SAT 求解器更强，但与 SMT 中字符串和位向量的理论类似，通常需要一种将基数约束转化为子句的 Eager 方法，然后调用 SAT 求解器。

> [!cite] Related Work
>
> 为了提高求解器在处理具有基数约束问题时的性能，研究者们主要从三个方面入手：增强底层证明系统、改进编码方式，或者直接在约束上进行原生传播。求解器可以利用更强的证明系统，无论是处理具有更丰富输入结构的公式，还是处理 CNF（合取范式）中的公式。例如，求解器 RoundingSAT 利用了切平面的优势，使其能够高效解决一些对归结法来说较为困难的问题。求解器 SAT4J 在预处理步骤中实现了基数提取 和广义归结，从而能够快速解决包含基数约束的 CNF 公式，并且还提供了对寻找哈密顿环的原生处理支持。此外，为了简化公式的编写，求解器工程师们还提供了对基于基数表示的支持。例如，求解器 MINISAT+ 支持基于基数的输入，并将公式转换为子句，而求解器包 PYSAT 则提供了将约束转换为子句的 API 调用。最后，求解器 MiniCARD 通过原生处理基数约束，显著减少了内存占用并改进了传播性能。

然而，最近的研究大多集中在更强的证明系统或更好的编码方式上。这部分是因为基数约束传播的实现细节在现代内处理技术发展之前就已经出现，且没有考虑到证明生成，并且仅在一些手工构造的公式上进行了评估。我们在现代 CDCL（冲突驱动子句学习）的背景下重新审视了原生基数约束处理，展示了在某些问题上，性能可以在不损害验证工具链的情况下得到提升（假设不使用切割平面）。

# At-Least-K Conjunctive Normal Form

由于所有的基数约束都可以统一转变为 “至少”，在 [[abioConflictDirectedLazy2012#基数约束中的 LD|Conflict Directed Lazy Decomposition]] 中有基数约束及其转变的介绍。于是，在这里我们只考虑 “至少” 类型的约束，我们称为 `conjunction of klauses` ，简称 `KNF` 。

![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250310165550123.png)

我们的总体框架如上图所示，对于一个从 CNF 变化得到的 KNF，我们有三种独立的求解器来求解：`REENCODE`, `CCDCL`, `HYBRID`。每种配置都会产生一个 `DRAT` 证明（或者说是 SAT 赋值）

1. `REENCODE` 通过将基数约束编码为子句（CNF）的形式，然后调用 CDCL 求解器进行求解，然而由于 CDCL 求解器使用的是原 CNF 公式中没有出现的重新编码的子句，因此对于子句重编码的 DRAT 推导必须先于求解器的 DRAT 证明。
2. `CCDCL` 通过在 klauses 上直接传播求解 KNF。如果提取的约束是弧相容[^1]的(否则增加推导过程即可)，则 CCDCL 求解器生成的 DRAT 证明可以通过输入的 CNF 公式进行验证。
3. `HYBRID` 通过混合上面两种方法，`CCDCL` 由于是一个向下兼容的求解器，其也可以求解 CNF 公式，于是，其接收了重新编码后的 CNF 与原来的 KNF 作为输入，注意，重新编码的 CNF 会作为冗余公式存在与求解器中，而 klauses 只在 SAT 的模式下被观察并传播，因此，当求解器以 UNSAT 模式在基数约束上传播时，它仅使用重新编码的子句。这使得求解器可以访问编码内的辅助变量，而这些变量对于寻找不可满足公式的简短证明是极其重要的。当求解器处于 SAT 模式时，它可以在 klauses 上直接传播，从而允许绕过辅助变量的更快传播。

三种不同的求解方法凸显了 KNF 格式所提供的灵活性。在某些情况下，对 klauses 的较小表示和快速传播是有益的。在其他情况下，重编码 klauses 引入辅助变量可以导致更短的证明。而两种方法的结合可能对未知问题效果最好。

# Cardinality Constraint Extraction and Analysis

