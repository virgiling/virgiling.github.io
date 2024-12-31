---
title: NuPBO 阅读笔记
description: 
tags:
  - 论文阅读笔记/组合优化
  - Paper/PBO
  - 算法讲义/局部搜索算法
date: 2024-12-31
lastmod: 2024-12-31
draft: true
cover: 
zotero-key: K965SDW3
zt-attachments:
  - "950"
citekey: chuMoreEfficientLocal2023
---

> [!tldr]
>
> [文章链接](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.CP.2023.12)

# Towards More Efficient Local Search for Pseudo-Boolean Optimization

> [!abstract]- 
>
> Pseudo-Boolean (PB) constraints are highly expressive, and many combinatorial optimization problems can be modeled using pseudo-Boolean optimization (PBO). It is recognized that stochastic local search (SLS) is a powerful paradigm for solving combinatorial optimization problems, but the development of SLS for solving PBO is still in its infancy. In this paper, we develop an effective SLS algorithm for solving PBO, dubbed NuPBO, which introduces a novel scoring function for PB constraints and a new weighting scheme. We conduct experiments on a broad range of six public benchmarks, including three real-world benchmarks, a benchmark from PB competition, an integer linear programming optimization benchmark, and a crafted combinatorial benchmark, to compare NuPBO against five state-of-the-art competitors, including a recently-proposed SLS PBO solver LS-PBO, two complete PB solvers PBO-IHS and RoundingSat, and two mixed integer programming (MIP) solvers Gurobi and SCIP. NuPBO has been exhibited to perform best on these three real-world benchmarks. On the other three benchmarks, NuPBO shows competitive performance compared to state-of-the-art competitors, and it significantly outperforms LS-PBO, indicating that NuPBO greatly advances the state of the art in SLS for solving PBO.

