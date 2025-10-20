---
title: SMT 的 UP 使用介绍
description:
tags:
  - Status/Pending
  - CCF/B/JAIR
  - Research/阅读/SAT
  - journal
date: 2025-10-18
lastmod: 2025-10-19
draft: true
cover:
location:
zotero-key: A24EU4F2
zt-attachments:
  - "1021"
citekey: fazekasSatisfiabilityModuloUser2024
---

> [!tldr] SMT 中的 UP
>
> CaDiCaL 提出的 [[fazekasIPASIRUPUserPropagators2023|IPASIR-UP]] 接口可以让 SAT 求解器更好的作为复杂求解器的内核，这篇文章以 SMT 为例子，主要从工程的角度解释了一些需求应该如何通过这样的接口实现
> 

关于 `IPASIR-UP` 的介绍，详细查看 [[fazekasIPASIRUPUserPropagators2023|IPASIR-UP]] ，这里不再赘述，我们引入文章的伪代码来说明连接了 UP 的 CDCL 是如何工作的：

![image.png|500](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20251019153737442.png)



