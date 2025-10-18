---
title: 相位，如何选择相位
description:
tags:
  - Research/笔记/SAT
date: 2025-10-18
lastmod: 2025-10-18
draft: false
cover:
location:
  - 43.8259282,125.4254779
---

# 相位

> [!info] 相位（Phase）
>
> 在 SAT 求解器中，相位通常指变量在搜索过程中的初始赋值偏好或历史状态
>
> 或者简单来说： 我们需要对变量的决策赋值，这个赋值的选择我们叫作相位（赋值为真/假）

# CaDiCaL 中如何选择相位进行赋值

值得注意的是，相位的选择本质上就是二叉树先搜索哪一边，因此在理论上相位的选择对求解速度应该没有那么大的影响，赋真/假都是只有 50% 的概率猜对。

然而在实际使用中，相位的选择十分有讲究，在 CaDiCaL 中，其相位的选择策略如下（按照优先级从高到低）：

1. 强制保存相位 (`force_saved_phase`)

   当 `force_saved_phase` 为 `true` 时，直接使用 `phases.saved[variable]`，这通常用于预处理阶段，强制使用保存的相位

2. 强制相位 (`phases.forced[var]`)

   通过 `phase()` 函数设置的强制相位，用户可以通过 [[balyoSATRace20152016|IPASIR]] 中的接口显式设置变量的相位

3. 强制初始相位 (`opts.forcephase`)

   当 `opts.forcephase` 启用时，使用初始相位

4. 目标相位 (`phases.target[variable]` 且 `target=true`)

   当 `target` 参数为 true 时，使用目标相位，目标相位用于优化子句的局部性访问

5. 保存相位 (`phases.saved[variable]`)

   这是搜索过程中保存的实际相位，即变量被回溯取消赋值后，其上次搜索保存的相位

6. **初始相位** (`initial_phase`)

   最后的回退选项，使用初始相位，初始相位由 `opts.phase` 决定：`opts.phase ? true : false`

## 相关配置

- **`opts.phase`** (默认值: 1): 初始相位选择，true/false
- **`opts.forcephase`** (默认值: 0): 是否始终使用初始相位
- **`opts.target`** (默认值: 1): 目标相位使用策略，默认为 stable
- **`force_saved_phase`**: 内部标志，用于预处理阶段强制使用保存的相位
