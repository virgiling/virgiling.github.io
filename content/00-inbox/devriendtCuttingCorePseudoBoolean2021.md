---
title: RoundingSAT 阅读笔记其三
description:
tags:
  - Research/阅读/SAT
  - CCF/A/AAAI
  - conference
  - Status/Pending
date: 2025-03-16
lastmod: 2025-09-27
draft: true
cover:
zotero-key: XRTZXIW4
zt-attachments:
  - "250"
citekey: devriendtCuttingCorePseudoBoolean2021
link: https://ojs.aaai.org/index.php/AAAI/article/view/16492
location: 43.8259282,125.4254779
---
> [!tldr]
> 
> [文章链接](https://ojs.aaai.org/index.php/AAAI/article/view/16492)
>  
# Cutting to the Core of Pseudo-Boolean Optimization: Combining Core-Guided Search with Cutting Planes Reasoning

> [!summary] 
> 
> Core-guided techniques have revolutionized Boolean satisﬁability approaches to optimization problems (MaxSAT), but the process at the heart of these methods, strengthening bounds on solutions by repeatedly adding cardinality constraints, remains a bottleneck. Cardinality constraints require signiﬁcant work to be re-encoded to SAT, and SAT solvers are notoriously weak at cardinality reasoning. In this work, we lift core-guided search to pseudo-Boolean (PB) solvers, which deal with more general PB optimization problems and operate natively with cardinality constraints. The cutting planes method used in such solvers allows us to derive stronger cardinality constraints, which yield better updates to solution bounds, and the increased efﬁciency of objective function reformulation also makes it feasible to switch repeatedly between lower-bounding and upper-bounding search. A thorough evaluation on applied and crafted benchmarks shows that our core-guided PB solver signiﬁcantly improves on the state of the art in pseudo-Boolean optimization.
> 