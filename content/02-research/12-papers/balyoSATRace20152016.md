---
title: IPASIR 介绍
description:
tags:
  - Research/阅读/SAT
  - CCF/A/AI
  - journal
date: 2025-09-24
lastmod: 2025-09-26
draft: false
cover:
zotero-key: A88BZLZS
zt-attachments:
  - "1017"
citekey: balyoSATRace20152016
location: 43.8259282,125.4254779
---


> [!tldr]
>
> [文章链接](https://linkinghub.elsevier.com/retrieve/pii/S0004370216300984)
>
> 主要也只需要阅读 IPASIR 接口，一个 User-Friendly 的接口，通过重写这些接口来更好的调用 `CaDiCaL` 这个求解器

# API Overview

> [!note] 求解器的状态
>
> 我们假定求解器会返回以下几种状态：
>
> - `UNKNOWN`
> - `SOLVING`
> - `SAT`
> - `UNSAT`

主要给出了九个函数接口：

```cpp
const char *ipasir_signature (void);
void *ipasir_init (void);
void ipasir_release (void *solver);
void ipasir_set_terminate (void *solver, void *state,
                           int (*terminate) (void *state));

void ipasir_add (void *solver, int lit_or_zero);
void ipasir_assume (void *solver, int lit);
int ipasir_solve (void *solver);
int ipasir_val (void *solver, int lit);
int ipasir_failed (void *solver, int lit);
```

# Service API

前面四个函数可以视为一组：

- `ipasir_signature` 主要是为了说明求解器的名称与版本（需要返回 `C-style` 的字符串）
- `ipasir_init` 来创建一个新的求解器实例并返回一个指针（指向这个实例的指针）
- `ipasir_release` 用于释放求解器的资源
- `ipasir_set_terminate`  函数用于设置一个回调函数，以指示是否应中止搜索。
  - 回调函数的签名为  `int terminate(void* state)`。如果回调函数返回非零值，则表示应终止搜索。求解器必须在搜索过程中定时调用此函数，并在回调函数返回非零值时立即中止搜索。
  - 调用此回调函数时，参数  `state`  的值与  `ipasir_set_terminate`  函数第二个参数所接收的值相同。

# Solving API

后五个函数为另一组，我们的状态转移图如下：

![image.png|500](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20250924153743709.png)

- 调用  `ipasir_init`  后，求解器的状态为 `UNKNOWN`，并准备好接收子句和假设
- 调用  `ipasir_solve`  函数时，求解器的状态转变为 `SOLVING`
- 当搜索过程完成时，根据结果的不同，状态会变为 `SAT` 或 `UNSAT`，搜索也可能被中止，此时求解器的状态将变回 `UNKNOWN`

具体而言，五个函数分别做以下事情：

- `ipasir_add` 用于向当前子句中添加文字，这个函数与读取 `cnf` 文件类似，读到 `0` 就会将子句存储（默认为子句已结束），由此函数添加的子句不能被删除，需要删除的话可以通过加入一些假设进行子句删除（例如我需要删除子句 $C_1$，通过引入一个从没出现过的变量 $a_1$ 加入到子句中 $C_1 \lor a_1$，然后我们加入假设 $a_1$ 即可删除这个子句，因为子句直接为真）

  > [!example]
  >
  > 例如公式为 $\mathcal{F} = (x_1 \lor x_2) \land \hat{x_3}$ ，我们的调用链为：
  > `ipasir_add(s, 1)`, `ipasir_add(s, 2)`, `ipasir_add(s, 0)`, `ipasir_add(s, -3)`, `ipasir_add(s, 0)`

- `ipasir_assume` 用于添加单元子句假设，所有已添加的假设仅对下一次  `ipasir_solve`  调用有效。当  `ipasir_solve`  调用结束时，所有假设都会被移除，随后可以指定新的假设集。
- `ipasir_solve` 用于在由  `ipasir_assume`  调用给定的假设条件下，求解通过  `ipasir_add`  调用所设定的公式。当被调用时，求解器会转变为 `SOLVING` 状态，直至公式求解完成或搜索被中断。
  - 若找到一个可满足的赋值，该函数将返回值 10，且求解器的状态转变为 `SAT`。
  - 若问题被证明为不可满足，函数将返回值 20，并将状态转变为 `UNSAT`。
  - 如果搜索过程中途被中断，则返回值为 0，同时求解器回到 `UNKNOWN` 状态。
- `ipasir_val` 当  `ipasir_solve`  找到一个可满足的赋值从而使求解器处于 `SAT` 状态时，我们可以调用此函数来获取某个变量（或文字）的值。
  - `ipasir_val(s, lit)`  的返回值规则定义为：如果文字  `lit`  在该解下为真/被满足，则返回  `+lit`；否则返回  `-lit`。
  - 如果给定变量（文字）的真值在可满足的部分真值赋值中未被赋值，则返回值可能为零。
- `ipasir_failed` 若某个公式在特定假设下被判定为 `UNSAT`，了解其中哪些假设实际被用于证明该不可满足性至关重要。**所有被使用假设的合取本身已足以证明公式的不可满足性**。通过调用  `ipasir_failed`  并以相关假设作为参数，即可获取此信息。如果该假设被使用过，函数返回值为 1，否则为 0。

我们允许在 `UNSAT` 状态下再次调用 `ipasir_solve` 函数，这是因为这种不可满足性可能是由假设导致的。由于每次调用  `ipasir_solve`  后，所有假设都会被清除，这意味着求解器的输入已经发生了改变，此时的公式可能是 `SAT` 的
