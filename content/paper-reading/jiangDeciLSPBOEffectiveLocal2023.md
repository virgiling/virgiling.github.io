---
title: DeciLS-PBO 阅读笔记
description: 
tags:
  - 论文阅读笔记/组合优化
  - Paper/PBO
  - 算法讲义/局部搜索算法
date: 2024-12-30
lastmod: 2024-12-31
draft: false
cover: 
zotero-key: 4PNQ9SEH
zt-attachments:
  - "940"
citekey: jiangDeciLSPBOEffectiveLocal2023
---

> [!tldr]
>
> [文章链接](http://arxiv.org/abs/2301.12251)

# DeciLS-PBO: an Effective Local Search Method for Pseudo-Boolean Optimization

> [!abstract]-
>
> Local search is an effective method for solving large-scale combinatorial optimization problems, and it has made remarkable progress in recent years through several subtle mechanisms. In this paper, we found two ways to improve the local search algorithms in solving Pseudo-Boolean Optimization (PBO): Firstly, some of those mechanisms such as unit propagation are merely used in solving MaxSAT before, which can be generalized to solve PBO as well; Secondly, the existing local search algorithms utilize the heuristic on variables, so-called score, to mainly guide the search. We attempt to gain more insights into the clause, as it plays the role of a middleman who builds a bridge between variables and the given formula. Hence, we first extended the combination of unit propagation-based decimation algorithm to PBO problem, giving a further generalized definition of unit clause for PBO problem, and apply it to the existing solver LS-PBO for constructing an initial assignment; then, we introduced a new heuristic on clauses, dubbed care, to set a higher priority for the clauses that are less satisfied in current iterations. Experiments on benchmarks from the most recent PB Competition, as well as three real-world application benchmarks including minimum-width confidence band, wireless sensor network optimization, and seating arrangement problems show that our algorithm DeciLS-PBO has a promising performance compared to the state-of-the-art algorithms.
