---
title: MIP 的局部搜索算法
description: 
tags:
  - 论文阅读笔记/组合优化
  - 算法讲义/局部搜索算法
  - CCF/B/CP
date: 2025-01-01
lastmod: 2025-01-01
draft: true
cover: 
zotero-key: RQFLISRX
zt-attachments:
  - "959"
citekey: linEfficientLocalSearch2024
---

> [!tldr]
>
> [文章链接](https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.CP.2024.19)

CP‘24 Best Paper

# An Efficient Local Search Solver for Mixed Integer Programming

> [!abstract]
>
> Mixed integer programming (MIP) is a fundamental model in operations research. Local search is a powerful method for solving hard problems, but the development of local search solvers for MIP still needs to be explored. This work develops an efficient local search solver for solving MIP, called Local-MIP. We propose two new operators for MIP to adaptively modify variables for optimizing the objective function and satisfying constraints, respectively. Furthermore, we design a new weighting scheme to dynamically balance the priority between the objective function and each constraint, and propose a two-level scoring function structure to hierarchically guide the search for high-quality feasible solutions. Experiments are conducted on seven public benchmarks to compare Local-MIP with state-of-the-art MIP solvers, which demonstrate that Local-MIP significantly outperforms CPLEX , HiGHS, SCIP and Feasibility Jump, and is competitive with the most powerful commercial solver Gurobi. Moreover, Local-MIP establishes 4 new records for MIPLIB open instances.
