---
title: 冲突分析与子句学习
description:
tags:
  - Status/Pending
  - Research/笔记/SAT
date: 2025-10-19
lastmod: 2025-10-19
draft: true
location:
cover:
---

# 前言

当 [[BCP]] 完成后，如果在这个过程中发现了冲突（有一个子句的文字全部为假），那么我们认为发生了冲突，需要撤销赋值并回溯。

在 `DPLL` 中，我们的做法十分简单，由于在 `trail` 中记录了已被赋值的文字，且每个变量是通过决策赋值 $x_i^d$ 还是传播赋值 $x_i^p$ 也被记录

因此我们只需要撤销这次决策后传播的所有变量的赋值，并将决策的变量换一个 [[Phase_Choose#相位|相位]] 进行赋值（类似于 DFS），如果这个决策变量两个相位都被尝试了，那么我们考虑回溯到更早的决策变量，然后尝试新的相位。

> [!attention]
>
> 注意，发生冲突并不是坏事，就像 [[VSIDS_Tutorials#前言|VSIDS 启发式]] 中说的，想成功先失败，越早的发生冲突意味着我们能越早的剪枝，从而减小搜索空间

在 `CDCL` 中，我们通过冲突分析与子句学习技术，使得 `CDCL` 能够进行非时序回溯（也就是回跳），且学习到 CNF 中一些隐含的信息，我们称为学习子句

## 1. 基本概念

### 蕴含图 (Implication Graph)

- 记录变量赋值决策和推导关系的有向无环图
- **决策节点**：人为选择的赋值
- **推导节点**：通过单位传播得到的赋值
- **边**：表示"如果前提子句为真，则推导出该赋值"

### 冲突 (Conflict)

当某个子句的所有文字都为假时发生冲突。

---

## 2. 冲突分析过程

### 步骤 1: 构建蕴含图片段

当冲突发生时，从冲突子句出发，逆向追踪导致冲突的推导链。

**示例**：

```
子句数据库：
1. (¬x₁ ∨ x₂)
2. (¬x₁ ∨ x₃ ∨ x₉)
3. (¬x₂ ∨ ¬x₃ ∨ x₄)
4. (¬x₄ ∨ x₅ ∨ x₁₀)
5. (¬x₄ ∨ x₆ ∨ x₁₁)
6. (¬x₅ ∨ ¬x₆)

决策序列：
@1: x₁ = T (决策)
@1: x₇ = T (决策)
@2: x₈ = F (决策)
@2: x₉ = F (决策)
```

### 步骤 2: 识别冲突原因

假设通过单位传播：

- 从子句 1 和 x₁=T 推导出 x₂=T
- 从子句 2、x₁=T、x₉=F 推导出 x₃=T
- 从子句 3、x₂=T、x₃=T 推导出 x₄=T
- 从子句 4、x₄=T 推导出 x₅=T
- 从子句 5、x₄=T 推导出 x₆=T
- **冲突**：子句 6(¬x₅ ∨ ¬x₆)中两个文字都为假

### 步骤 3: 寻找唯一蕴含点 (UIP)

#### 什么是 UIP？

在当前的决策层中，如果一个节点满足：**从当前决策节点到冲突节点的所有路径都必须经过该节点**，则称为 UIP。

**First-UIP**：离冲突节点最近的 UIP。

#### 如何找到 First-UIP？

从冲突节点开始，逆向遍历蕴含图，维护一个计数器：

- 遇到决策节点：计数器+1
- 遇到推导节点：根据入边数量调整计数器
- 当计数器为 1 时，当前节点就是 First-UIP

在我们的例子中：

- 冲突节点：子句 6 违反
- 逆向追踪：x₅(T) ← 子句 4 ← x₄(T) ← 子句 3 ← x₂(T), x₃(T)
- First-UIP：x₄

---

## 3. 学习子句归结过程

### 归结规则 (Resolution)

给定两个子句：

- `C₁ = A ∨ x`
- `C₂ = B ∨ ¬x`

归结得到：`A ∨ B`

### 具体归结步骤

从冲突子句开始，不断与导致赋值的子句进行归结：

1. **初始冲突子句**：`(¬x₅ ∨ ¬x₆)`

2. **处理 x₅**：

   - x₅ 由子句 4 推导：`(¬x₄ ∨ x₅ ∨ x₁₀)`
   - 归结：`(¬x₅ ∨ ¬x₆) ∧ (¬x₄ ∨ x₅ ∨ x₁₀) → (¬x₄ ∨ ¬x₆ ∨ x₁₀)`

3. **处理 x₆**：

   - x₆ 由子句 5 推导：`(¬x₄ ∨ x₆ ∨ x₁₁)`
   - 归结：`(¬x₄ ∨ ¬x₆ ∨ x₁₀) ∧ (¬x₄ ∨ x₆ ∨ x₁₁) → (¬x₄ ∨ x₁₀ ∨ x₁₁)`

4. **检查是否到达 UIP**：
   - 当前子句：`(¬x₄ ∨ x₁₀ ∨ x₁₁)`
   - 只有一个来自当前决策层(2)的文字：x₄
   - x₄ 就是 First-UIP，停止归结

**最终学习子句**：`(¬x₄ ∨ x₁₀ ∨ x₁₁)`

---

## 4. 回溯级别计算

### 计算回溯级别

- 找出学习子句中所有文字对应的决策级别
- 选择**第二高的决策级别**作为回溯目标

在我们的例子中：

- 学习子句：`(¬x₄ ∨ x₁₀ ∨ x₁₁)`
- 决策级别：x₄@2, x₁₀@?, x₁₁@?
- 假设 x₁₀ 和 x₁₁ 是未赋值的或来自级别 1
- **回溯级别** = max{level(x₁₀), level(x₁₁)} = 1

### 执行回溯

- 回退到决策级别 1
- 添加学习子句到数据库
- 由于学习子句中有单元文字 ¬x₄，立即推导出 x₄=F

---

## 5. 算法伪代码

```python
def analyze_conflict(conflict_clause):
    learned_clause = conflict_clause
    while not has_only_one_uip(learned_clause):
        # 找到最后一个被赋值的文字
        last_literal = get_last_assigned_literal(learned_clause)
        # 找到导致该赋值的子句
        reason_clause = get_reason_clause(last_literal)
        # 应用归结
        learned_clause = resolve(learned_clause, reason_clause, last_literal)

    backtrack_level = compute_backtrack_level(learned_clause)
    return learned_clause, backtrack_level

def resolve(clause1, clause2, pivot_var):
    # 去除pivot_var，合并两个子句
    result = set(clause1) | set(clause2)
    result.discard(pivot_var)
    result.discard(-pivot_var)
    return list(result)
```

---

通过分析 CaDiCaL 的代码，我来详细解释冲突分析和学习子句导出的过程：

## 1. 冲突分析的整体流程

```cpp
void Internal::analyze () {
  // 初始化阶段
  assert(conflict);
  assert(lrat_chain.empty());
  assert(clause.empty());

  // 如果是根层级的冲突，学习空子句
  if (!level) {
    learn_empty_clause();
    return;
  }

  // 主分析循环
  Clause *reason = conflict;
  int open = 0;  // 当前层级上已看到但未处理的原因文字数
  int uip = 0;   // 第一个UIP文字
  // ... 分析过程

  // 生成学习子句并回溯
  Clause *driving_clause = new_driving_clause(glue, jump);
  backtrack(new_level);
  search_assign_driving(-uip, driving_clause);
}
```

## 2. 核心分析过程

### 2.1 分析循环

```cpp
for (;;) {
  // 分析当前原因子句
  analyze_reason(uip, reason, open, resolvent_size, antecedent_size);

  // 寻找下一个UIP候选
  uip = 0;
  while (!uip) {
    const int lit = (*t)[--i];  // 从trail末尾向前遍历
    if (!flags(lit).seen) continue;
    if (var(lit).level == level) uip = lit;  // 找到当前层级的文字
  }

  if (!--open) break;  // 找到第一个UIP

  // 获取UIP的原因子句继续分析
  reason = var(uip).reason;
}
```

### 2.2 分析单个文字

```cpp
void Internal::analyze_literal(int lit, int &open,
                              int &resolvent_size,
                              int &antecedent_size) {
  Var &v = var(lit);
  Flags &f = flags(lit);

  if (!v.level) {
    // 处理固定文字（层级0）
    if (f.seen || !lrat) return;
    f.seen = true;
    unit_analyzed.push_back(lit);
    return;
  }

  ++antecedent_size;
  if (f.seen) return;

  f.seen = true;
  analyzed.push_back(lit);

  // 根据层级决定是否加入学习子句
  if (v.level < level)
    clause.push_back(lit);  // 加入学习子句

  // 更新层级信息
  Level &l = control[v.level];
  if (!l.seen.count++) {
    levels.push_back(v.level);
  }

  if (v.level == level)
    open++;  // 当前层级的未处理文字
  ++resolvent_size;
}
```

### 2.3 分析原因子句

```cpp
void Internal::analyze_reason(int lit, Clause *reason, int &open,
                             int &resolvent_size, int &antecedent_size) {
  bump_clause(reason);  // 更新子句活性
  if (lrat) lrat_chain.push_back(reason->id);  // 记录证明链

  // 分析原因子句中的所有文字（除了当前文字）
  for (const auto &other : *reason)
    if (other != lit)
      analyze_literal(other, open, resolvent_size, antecedent_size);
}
```

## 3. 学习子句生成

### 3.1 生成驱动子句

```cpp
Clause *Internal::new_driving_clause(const int glue, int &jump) {
  const size_t size = clause.size();

  if (!size) {
    jump = 0;
    return 0;  // 空子句
  } else if (size == 1) {
    jump = 0;
    return 0;  // 单位子句
  } else {
    // 对学习子句中的文字按赋值顺序排序
    MSORT(opts.radixsortlim, clause.begin(), clause.end(),
          analyze_trail_negative_rank(this), analyze_trail_larger(this));

    // 计算回溯层级（第二高的决策层级）
    jump = var(clause[1]).level;

    // 创建新的学习子句
    Clause *res = new_learned_redundant_clause(glue);
    res->used = 1 + (glue <= opts.reducetier2glue);
    return res;
  }
}
```

### 3.2 最小化学习子句

```cpp
if (size > 1) {
  if (opts.shrink)
    shrink_and_minimize_clause();  // 收缩和最小化
  else if (opts.minimize)
    minimize_clause();  // 仅最小化
}
```

## 4. 变量和子句的活性更新

### 4.1 变量评分更新

```cpp
void Internal::bump_variable_score(int lit) {
  int idx = vidx(lit);
  double old_score = score(idx);
  double new_score = old_score + score_inc;  // VSIDS评分更新

  if (evsids_limit_hit(new_score)) {
    rescale_variable_scores();  // 防止分数溢出
  }

  score(idx) = new_score;
  if (scores.contains(idx))
    scores.update(idx);
}
```

### 4.2 子句活性更新

```cpp
void Internal::bump_clause(Clause *c) {
  c->used = 1;  // 标记为活跃

  if (!c->redundant) return;

  // 重新计算glue值
  int new_glue = recompute_glue(c);
  if (new_glue < c->glue)
    promote_clause(c, new_glue);  // 提升子句层级
}
```

## 5. 回溯和赋值

### 5.1 确定回溯层级

```cpp
int Internal::determine_actual_backtrack_level(int jump) {
  if (!opts.chrono) {
    return jump;  // 非时序回溯
  } else if (opts.chronoalways) {
    stats.chrono++;
    return level - 1;  // 强制时序回溯
  } else {
    // 智能回溯：在跳转和时序回溯间权衡
    return (level - jump > opts.chronolevelim) ? level - 1 : jump;
  }
}
```

### 5.2 执行回溯和赋值

```cpp
backtrack(new_level);  // 回溯到指定层级

if (uip) {
  search_assign_driving(-uip, driving_clause);  // 分配翻转的UIP文字
} else {
  learn_empty_clause();  // 学习空子句
}
```

## 6. 关键数据结构

- **`clause`**: 存储正在构建的学习子句
- **`analyzed`**: 已分析的文字集合
- **`levels`**: 涉及的决策层级
- **`lrat_chain`**: LRAT 证明链
- **`conflict`**: 当前冲突子句

## 总结

CaDiCaL 的冲突分析过程遵循标准的 CDCL 算法：

1. **从冲突出发**，逆向遍历蕴含图
2. **寻找第一个 UIP**，通过计数当前层级的开放节点
3. **应用归结规则**，逐步构建学习子句
4. **最小化学习子句**，移除冗余文字
5. **计算回溯层级**，基于第二高的决策层级
6. **更新启发式信息**，提升相关变量和子句的活性
7. **执行回溯**并分配翻转的 UIP 文字

这个过程有效地从冲突中学习，避免重复相同的错误，显著提升了 SAT 求解的效率。
