---
title: RoundingSAT-1 阅读笔记
description: 
tags:
  - 论文阅读笔记/约束求解
  - 算法讲义/精确算法
  - CCF/A/IJCAI
date: 2024-12-31
lastmod: 2025-01-01
draft: false
cover: 
zotero-key: TNN4CGDN
zt-attachments:
  - "900"
citekey: elffersDivideConquerFaster2018
---

> [!tldr]
>
> [文章链接](https://www.ijcai.org/proceedings/2018/180)

	# Divide and Conquer: Towards Faster Pseudo-Boolean Solving

> [!abstract]
>
> The last 20 years have seen dramatic improvements in the performance of algorithms for Boolean satisﬁability—so-called SAT solvers—and today conﬂict-driven clause learning (CDCL) solvers are routinely used in a wide range of application areas. One serious short-coming of CDCL, however, is that the underlying method of reasoning is quite weak. A tantalizing solution is to instead use stronger pseudo-Boolean (PB) reasoning, but so far the promise of exponential gains in performance has failed to materialize—the increased theoretical strength seems hard to harness algorithmically, and in many applications CDCL-based methods are still superior. We propose a modiﬁed approach to pseudo-Boolean solving based on division instead of the saturation rule used in [Chai and Kuehlmann ’05] and other PB solvers. In addition to resulting in a stronger conﬂict analysis, this also improves performance by keeping integer coefﬁcient sizes down, and yields a very competitive solver as shown by the results in the PseudoBoolean Competitions 2015 and 2016.
