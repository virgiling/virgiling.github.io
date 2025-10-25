---
title: PRS 框架简介
description:
tags:
  - 合作项目/zmylinxi99
date: 2025-09-25
lastmod: 2025-10-25
draft: true
cover:
location: 43.8259282,125.4254779
---

# Overview


![image.png](https://virgil-civil-1311056353.cos.ap-shanghai.myqcloud.com/img/20251022170943532.png)


这是一个基于 `Portfolio` 的 SAT 并行求解框架，通过不同的参数配置，运行 `32` 个不同配置的求解器对一个问题进行求解，选择跑的最快的那个求解器作为最终的解

> [!important]
>
> 所有求解器都会导出子句到共享子句库中，部分求解器会导入共享的子句到 `Formula` 中进行求解（注意不是导入到自身的子句库，这意味着导入的子句无法被删除）

# 更改的文件

1. `analyze.cpp`

在 `analyze()` 中，更改了：

```cpp
// up to this point lrat_chain contains the proof for current clause in
// reversed order. in minimize and shrink the clause is changed and
// therefore lrat_chain has to be extended. Unfortunately we cannot create
// the chain directly during minimization (or shrinking) but afterwards we
// can calculate it pretty easily and even better the same algorithm works
// for both shrinking and minimization.

// Minimize the 1st UIP clause as pioneered by Niklas Soerensson in
// MiniSAT and described in our joint SAT'09 paper.
//
if (size > 1) {
if (opts.shrink)
  shrink_and_minimize_clause();
else if (opts.minimize)
  minimize_clause();

size = (int)clause.size();

// Update decision heuristics.
if (opts.bump)
  bump_variables();

if (external->learner)
  external->export_learned_large_clause(clause);

// NOTE PRS Addition Start
if (external->prsExportClause != NULL) {
  std::vector<int> eclause;
  for (auto ilit : clause) {
	int elit = externalize(ilit);
	assert(elit != 0);
	eclause.push_back(elit);
  }
  external->prsExportClause(external->prsExportState, eclause, glue);
}
// NOTE PRS Addition End
} else {
if (external->learner)
  external->export_learned_unit_clause(-uip);
// NOTE PRS Addition Start
if (external->prsExportClause != NULL) {
  std::vector<int> eclause;
  eclause.push_back(externalize(-uip));
  external->prsExportClause(external->prsExportState, eclause, glue);
}
// NOTE PRS Addition End
}
```

主要作用是将学习到的冲突子句实时导出给 PRS，用于并行时的子句共享

2. `cadical.hpp`

这里主要是声明回调函数，因此不介绍直接略过

3.  `external.cpp`/ `external.hpp`

这里主要是初始化回调函数的地址以及 PRS 类的地址

4. `internal.cpp`

这里我们记录了如何导入外部共享的学习子句到求解器中：

```cpp
void Internal::import_clauses(int &global_res) {
  if (global_res != 0)
    return;
  int glue = 0;
  std::vector<int> eclause;
  std::vector<int> &iclause = this->clause;
  assert(iclause.empty());
  while (true) {
    eclause.clear();
    int res =
        external->prsImportClause(external->prsImportState, eclause, &glue);
    if (res == -1)
      break;
    if (res == -10)
      continue;
    assert(res == 1);
    bool illegal = false;
    for (int i = 0; i < eclause.size(); i++) {
      int elit = eclause[i];
      assert(elit != 0);
      if (external->marked(external->witness, elit)) {
        illegal = true;
        break;
      }
      int ilit = external->internalize(elit);
      CaDiCaL::Flags &litFlags = flags(ilit);
      if (litFlags.eliminated() || litFlags.substituted()) {
        illegal = true;
        break;
      } else if (litFlags.fixed()) {
        if (val(ilit) == 1) {
          illegal = true;
          break;
        }
      } else {
        iclause.push_back(ilit);
      }
    }
    if (illegal) {
      iclause.clear();
      continue;
    }
    if (iclause.size() == 1) {
      assign_unit(iclause[0]);
      iclause.clear();
    } else if (iclause.size() >= 2) {
      external->check_learned_clause();
      CaDiCaL::Clause *ref = new_clause(true, glue);
      if (proof)
        proof->add_derived_clause(
            ref,
            {}); // lrat_chain can be also share for parallel proof generation ?
      assert(watching());
      watch_clause(ref);
      iclause.clear();
    }
  }
}
```

然后我们在 `cdcl` 的主循环中调用这个函数：

```cpp
while (!res) {
	if (level == 0 && external->prsImportClause != NULL && watching()) {
	  import_clauses(res);
	}
	//......
}
```

注意，我们只在没有进行决策时导入新的子句

导入时，我们对子句中的所有文字做合法性检验：

1. 保证文字没有被赋值（没有找到一个 `model`）
2. 保证变量没有被消除或替换
3. 保证变量没有被固定为真

满足以上条件的文字被我们加入到 `iclause` 中，这也是我们将会导入的学习子句（这个子句在全局下都为真）

然后我们做导入的处理：

1. 如果导入的是单元子句，那么我们直接赋值
2. 否则，我们创建一个新的学习子句，并将其添加到被观察的子句列表中

# 共享学习子句库

PRS 通过桶排序来管理共享的学习子句库，按子句长度分桶，在 `buckets`向量中，第 i 个桶存储长度为 i+1 的子句：

- `addClause()` 用于添加子句

  - 检查子句长度，动态扩展桶数组
  - 添加条件：子句长度 $\times$ (桶大小+1) $\leq$ 共享文字上限
    - 注意，上限为预先设定的，表示每个线程每次共享间隔的共享文字上限

- `collectSharingClauses() ` 收集可共享子句

  - 按桶顺序（短子句优先）收集，直到用完`share_lits`配额
  - 计算实际使用的空间百分比存入 `share_percent`
