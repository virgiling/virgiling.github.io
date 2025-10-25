---
title: SAT 分布式并行求解 Meeting#2
description:
tags:
  - Status/Doing
  - 合作项目/zmylinxi99
date: 2025-10-08
lastmod: 2025-10-17
draft: true
cover:
location:
---

# Meeting#2

![[2025-10-08-19-38-07.excalidraw|路线图|1500]]

- [x] kissat 更换为 cadical （0.5 version） ✅ 2025-10-17
- [x] 加上 lemma sharing 的 cadical （1.0 version）用于消融实验 ✅ 2025-10-17
- [ ] 定义 `barrier` 是什么（在论文中也需要良好的定义）
- [ ] 求解器名称

> [!important]
>
> 任意一个 Worker 的结束（无论 SAT /UNSAT）都代表了整体的结束


