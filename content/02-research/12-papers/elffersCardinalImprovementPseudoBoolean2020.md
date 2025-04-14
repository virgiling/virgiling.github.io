---
title: PB 求解器中的基数探测
description: 
tags:
  - Research/阅读/SAT
  - CCF/A/AAAI
date: 2025-01-04
lastmod: 2025-04-14
draft: true
cover: 
zotero-key: YQGTPYYK
zt-attachments:
  - "871"
citekey: elffersCardinalImprovementPseudoBoolean2020
---
> [!tldr]
> 
> [文章链接](https://ojs.aaai.org/index.php/AAAI/article/view/5508)
>  
# A Cardinal Improvement to Pseudo-Boolean Solving

> [!abstract] 
> 
> Pseudo-Boolean solvers hold out the theoretical potential of exponential improvements over conﬂict-driven clause learning (CDCL) SAT solvers, but in practice perform very poorly if the input is given in the standard conjunctive normal form (CNF) format. We present a technique to remedy this problem by recovering cardinality constraints from CNF on the ﬂy during search. This is done by collecting potential building blocks of cardinality constraints during propagation and combining these blocks during conﬂict analysis. Our implementation has a non-negligible but manageable overhead when detection is not successful, and yields signiﬁcant gains for some SAT competition and crafted benchmarks for which pseudoBoolean reasoning is stronger than CDCL. It also boosts performance for some native pseudo-Boolean formulas where this approach helps to improve learned constraints.
> 