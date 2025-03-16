---
title: RoundingSAT 阅读笔记其二
description:
tags:
  - 论文阅读笔记/约束求解
  - CCF/B/CP
  - 算法讲义/精确算法
date: 2025-03-16
lastmod: 2025-03-16
draft: true
zotero-key: L4UF76PH
zt-attachments:
  - "868"
citekey: devriendtWatchedPropagation$0$1$2020
---

> [!tldr]
>
> [文章链接](https://link.springer.com/10.1007/978-3-030-58475-7_10) 是 `RoundingSAT` 求解器系列的第三篇文章，[[elffersDivideConquerFaster2018|第一篇]] 文章主要是提出了如何把 CDCL 用到 PB 中来，第二篇是联动 [SoPlex](https://soplex.zib.de/) 求解器

# Watched Propagation of 0-1 Integer Linear Constraints

> [!summary]
>
> Eﬃcient unit propagation for clausal constraints is a core building block of conﬂict-driven clause learning (CDCL) Boolean satisﬁability (SAT) and lazy clause generation constraint programming (CP) solvers. Conﬂict-driven pseudo-Boolean (PB) solvers extend the CDCL paradigm from clausal constraints to 0-1 integer linear constraints, also known as (linear) PB constraints. For PB solvers, many diﬀerent propagation techniques have been proposed, including a counter technique which watches all literals of a PB constraint. While CDCL solvers have moved away from counter propagation and have converged on a two watched literals scheme, PB solvers often simultaneously implement different propagation algorithms, including the counter one.
