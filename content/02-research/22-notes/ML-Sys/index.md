---
title: 在 ICT 学习的 MLSys
description: 
tags:
  - Research/笔记/ML-Sys
date: 2023-06-06
lastmod: 2025-04-15
draft: false
cover: 
comments: false
---

这里记录了我在 ICT 的实习历程，实习的时间为 2023-06-01 到 2023-07-10

实习的内容包括两部分：

# 稀疏矩阵在 AI 编译器中的应用

这里，主要调研了几篇文章：

- [[tvm-build]]
- [[SparTA]]
- [[SparseTIR]]

然后简单复现了一下后面两篇文章，可以参考 [[SparBuild]]
# 项目制

项目的内容需要保密，所以只能说说学习的内容，主要是学习了 [[torch-dynamo|Pytorch]] 的编译流程，包括如何映射到 Triton 算子的部分（但这部分本质上还不是很清晰，包括 `Loop-Level IR` 的 `Loop` 体现在什么地方）
