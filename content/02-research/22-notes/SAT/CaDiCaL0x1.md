---
title: 0x1-从 CaDiCaL 开始的 SAT
description: 
tags:
  - Research/笔记/SAT
date: 2025-06-09
lastmod: 2025-06-16
draft: true
cover:
---
# 前言

从这里开始，我以如下 CNF 为例，通过 debug 的方式来解析 [CaDiCaL](https://github.com/arminbiere/cadical) 是如何工作的，在这里可能还会穿插一些算法的作用以及软件的一些设计模式。

$$
\mathcal{F} = (\neg x_1 \lor x_2) \land (x_1 \lor \neg x_2) \land (x_1 \lor x_2)
$$
其成真赋值为 $(\top, \top)$

## 配置与构建

这里我的环境为 `MacOS` + `clang++` + `lldb`

从 Github 上拉下代码后，我们首先需要安装 [bear](https://github.com/rizsotto/Bear) 用于生成 `clangd` 的数据库 `compile_commands.json`

运行：

```bash
CXX=clang++ ./configure -a
bear -- make -j8
```

可执行文件为 `./build/cadical`

# 程序入口

入口位于 `./src/cadical.cpp` 中的 `main` 函数中，其中 `App` 这个类封装了所有的处理过程，我们也可以当作入口为 `int App::main (int argc, char **argv)`

其首先解析命令行，接着初始化求解器

## 求解器初始化

接着我们开始构造 Solver，这里注意 `_state` 被设置为 `INITIALIZING`，我们参考 `_state` 的定义部分以及注释：

```cpp
enum State {
  INITIALIZING = 1, // during initialization (invalid)
  CONFIGURING = 2,  // configure options (with 'set')
  STEADY = 4,       // ready to call 'solve'
  ADDING = 8,       // adding clause literals (zero missing)
  SOLVING = 16,     // while solving (within 'solve')
  SATISFIED = 32,   // satisfiable allows 'val'
  UNSATISFIED = 64, // unsatisfiable allows 'failed'
  DELETING = 128,   // during and after deletion (invalid)

  // These combined states are used to check contracts.

  READY = CONFIGURING | STEADY | SATISFIED | UNSATISFIED,
  VALID = READY | ADDING,
  INVALID = INITIALIZING | DELETING
};
  // The solver is in the state ADDING if either the current clause or the
  // constraint (or both) is not yet terminated.
  bool adding_clause;
  bool adding_constraint;

  State _state; // API states as discussed above.
```

其状态转移的方式如下：

```cpp
//                         new
// INITIALIZING --------------------------> CONFIGURING
//
//                    set / trace
//  CONFIGURING --------------------------> CONFIGURING
//
//               add (non zero literal)
//        VALID --------------------------> ADDING
//
//               add (zero literal)
//        VALID --------------------------> STEADY
//
//               assume (non zero literal)
//        READY --------------------------> STEADY
//
//                        solve
//        READY --------------------------> SOLVING
//
//                     (internal)
//      SOLVING --------------------------> READY
//
//                val (non zero literal)
//    SATISFIED --------------------------> SATISFIED
//
//               failed (non zero literal )
//  UNSATISFIED --------------------------> UNSATISFIED
//
//                        delete
//        VALID --------------------------> DELETING
```

这里使用了 `TypeState` 的设计模式

接着，我们初始化 Solver 的 Internal，本质上这是一层封装，


> [!note] 
> 
> 值得注意的是，代码自己实现了一个 DeferDeletePtr 类，用于手动管理内存，且管理的为 Internal

## 解析 CNF 文件

在解析普通 CNF 文件时，还支持解析 [iCNF ](https://fmv.jku.at/papers/HeuleKullmannWieringaBiere-HVC11.pdf) 文件

 > [!note] iCNF format
 > 
 > iCNF format is very similar to the standard DIMACS format:
 > - _Iterative_ (_incremental_) SAT problem is represented by _blocks_ -- each block is a set of clauses and the `solve` statement.
 > - Each clause is represented with a single line containing a sequence of positive/negative variables, ending with 0 (zero).
 > - The `solve` statement indicates when the solver have to actually solve the SAT problem and print the result: satisfying assignment, or "UNSAT"
 > - The standard DIMACS header (`p cnf <num-of-cons> <num-of-vars>`) is not required, but may be useful to specify the total number of variables in advance.
 > - The `halt` statement forces the solver to halt. The solver automatically exits on EOF, so it is not required to have the `halt` statement at the end.
 
 