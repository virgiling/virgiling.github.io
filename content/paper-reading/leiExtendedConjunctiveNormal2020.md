---
title: ECNF 求解基数约束（PBO）阅读笔记
description: 
tags:
  - 论文阅读笔记/组合优化
  - Paper/PBO
  - 算法讲义/局部搜索算法
date: 2024-12-31
lastmod: 2024-12-31
draft: true
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
# Extended Conjunctive Normal Form and An Efficient Algorithm for Cardinality Constraints

> [!abstract] 
> 
> Satisﬁability (SAT) and Maximum Satisﬁability (MaxSAT) are two basic and important constraint problems with many important applications. SAT and MaxSAT are expressed in CNF, which is difﬁcult to deal with cardinality constraints. In this paper, we introduce Extended Conjunctive Normal Form (ECNF), which expresses cardinality constraints straightforward and does not need auxiliary variables or clauses. Then, we develop a simple and efﬁcient local search solver LS-ECNF with a well designed scoring function under ECNF. We also develop a generalized Unit Propagation (UP) based algorithm to generate the initial solution for local search. We encode instances from Nurse Rostering and Discrete Tomography Problems into CNF with three different cardinality constraint encodings and ECNF respectively. Experimental results show that LS-ECNF has much better performance than state of the art MaxSAT, SAT, Pseudo-Boolean and ILP solvers, which indicates solving cardinality constraints with ECNF is promising.
> 