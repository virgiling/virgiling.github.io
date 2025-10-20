---
title: SAT 分布式并行求解
description:
tags:
  - Status/Doing
  - 合作项目/zmylinxi99
date: 2025-09-26
lastmod: 2025-10-08
draft: true
cover:
location: 43.8259282,125.4254779
---

# 概览

结合 [[PRS Basic|PRS 框架]]， [[fazekasIPASIRUPUserPropagators2023|IPASIR-UP]] 以及类似与分布式并行的想法

首先，对于传统的 [[heuleCubeConquerGuiding2012|Cube and Conquer]] 而言，我们面临的一大问题是：

由于我们会将问题划分为多个无交的子空间，不同的子空间交由不同的线程去处理，那么此时当一个子问题找到了一个 `lemma` 时，本质上我们很难将这个 `lemma` 共享给其他子问题，因为：

1. `lemma` 有可能在其他子问题上是错误的
2. `lemma` 必须带有划分子问题时的假设，这样会降低了质量（例如学到的子句为 $c \lor d$，而我们的假设为 $a \land \neg b$，那么我们加入的 `lemma` 为 $\neg a \lor b \lor c \lor d$）

> [!info]
>
> 在 [[fazekasIPASIRUPUserPropagators2023#Collaborate with CDCL|IPASIR-UP]] 中提出了回调函数，尤其是在决策前，求解器会调用 `cb_decide` 函数，来连接外部的 UP，让 UP 来指导求解器做出决策

在这个前提下，我们可以通过 `cb_decide` 函数来做到问题的划分，这里我们假定有一个 `leader` ，其主要作用是划分问题，并指派 `worker` 对划分出来的问题进行求解

那么，在每个 `worker` 进行决策前，其都会调用 `cb_decide` ，在这个函数中，我们可以让其去联系 `leader` 从而获取下一个要赋值的变量以及其相位（获取一个假设），而获取变量的顺序本质上等价为 `Formula` 如何进行划分（当然这是 `leader` 需要关心的事情）

这样，对于每个 `worker` 而言，其产出的学习子句本质上与其他人是可以共享的，因为在 `worker` 自身看来，不存在外部给定的单元子句假设，我们给定的假设在它看来都是自己做出的决策，因此这些 `worker` 在它自身的是视角里求解的都是同一个问题，只是决策的顺序/相位不同而已，既然是同一个问题，那么子句当然可以进行共享。

于是，我们就迂回地解决了在 [[heuleCubeConquerGuiding2012|Cube and Conquer]] 中学习子句共享困难的问题

在这个框架中，我们也可以对每个 `worker` 进行单独的配置（或者是随机扰动），就像是 [[PRS Basic|PRS]] 中的 `Portfolio` 一样

> [!tip] `lemma` 加入的位置
>
> 在这个框架中，我们想将其导入到子句库中，给予 `worker` 权力，能够将 `lemma` 删除

# 技术细节

> [!important]
>
> 这些细节只是初步构想，还需要讨论更多的细节

对于每个 `worker`，我们会有一个类似 `buffer` 的容器作为 `decide` 的 `barrier`：即在 `barrier` 前的决策变量都是由 `leader` 告知 `worker` 的，需要被按顺序提前决策（ `assumption`），在这之后的都为 `worker` 单独决策的

于是，对于 `leader` 而言，我们一定有一棵划分树，用于记录在求解问题过程中我们是如何对问题进行划分的（这个会用于 `profiling`）。

如果划分树比较大，共识比较多的话，也可以考虑再设计一棵 `Reduced Tree` 来压缩一些状态，这棵树可以用于 `leader` 下发任务给 `worker` （本质上就是强制要求/指导 `worker` 的决策）

对于划分树而言，我们需要考虑的一个重要问题如下

我们假定变量的划分顺序为 $a, b, c, d, e$

当我们有一个 `worker` 学习到了 `lemma` 时，我们面临了两种情况：

1. 如果 `lemma` 并没有包含划分路径上的变量（例如 $f \lor g \lor h$），或者说没有跨越 `barrier` 时，这种情况我们正常处理即可
2. 否则（一个极端的例子如 $a \land e \rightarrow \neg c$），那么此时，对于那些本身假设就为 $\neg c$ 的 `worker` 我们不需要立刻处理，而那些假设为 $c$ 的 `worker` 我们需要将其停止搜索，并为其安排新的任务。在这之后，`leader` 需要重新选一个满足 条件 1 的变量，作为新的划分点

# Meeting#1

![[2025-10-08-19-38-07.excalidraw|路线图|1500]]

- [ ] 定义 `barrier` 是什么（在论文中也需要良好的定义）
- [ ] 求解器名称

> [!important]
>
> 任意一个 Worker 的结束（无论 SAT /UNSAT）都代表了整体的结束

## PP-SAT（暂时） 并行版本框架伪代码

```py
class Sharer:
    # DONE
    pass

class Analyzer:
	# TBD
	pass

class Master:
    def __init__():
        # TBD
        # lemmas = []
        # analyzer = Analyzer(lemmas)
        # sharer = Sharer(lemmas)
        self.partition_tree = PartitionTree()
        self.reduced_partition_tree = PartitionTree() # rpt
        self.pd_conflicts = []
        self.workers = [Worker(i) for i in range(nthreads)]
        self.conflict_workers = []
        self.succeed_splits = []
        self.next_solving_id = 0
        self.split_needs = 0

        self.analyzer = Analyzer(rpt)
        self.sharer = Sharer()


    def pre_partitioning():
        # parameter diversity
        ...
        # DONE
        for (i, pd) in pds.enum():
            notify_pre_decisions(i, pd)

    def notify_pre_decisions(wid, pre_decisions: list):
        self.workers[wid].master_pd = self.pre_decisions
        self.workers[wid].is_pd_updated = UPDATED

    def process_pd_conflict():
        while not self.pd_conflicts.empty():
            wid, lemma = self.pd_conflicts.pop()
            self.analyzer.add_lemma(lemma)

        conflicts = analyser.check_conflicts()
        self.conflict_workers += conflicts
        self.split_needs += len(conflicts)

    def can_split(wid):
        pass

    def get_next_split_worker():
        lst = self.next_solving_id
        for _ in range(nthreads):
            self.next_solving_id = (self.next_solving_id + 1) % nthreads
            wid = self.next_solving_id
            if can_split(wid):
                return wid
        return None

    def request_split(sid):
        self.workers[sid].need_split = REQUEST

    def update_partition_tree(sid, wid, split_lit):
        self.partition_tree.update(sid, wid, split_lit)

    def process_conflict_workers():
        self.split_needs -= len(self.succeed_splits)
        for sid, split_lit in succeed_splits:
            wid = self.conflict_workers.pop()
            update_partition_tree(sid, wid, split_lit)
            notify_pre_decisions(wid, workers.master_pd + (-split_lit))
        self.succeed_splits = []

        for w in self.workers:
            if w.need_split == FAILED:
                self.split_needs += 1
                w.need_split = IDLE

        for _ in range(self.split_needs):
            sid = get_next_split_worker()
            if sid == None:
                break
            request_split(sid)
            self.split_needs -= 1

        self.conflict_workers = []

    def __call__():
        pre_partitioning()
        while True:
            process_pd_conlict()
            process_conflict_workers()


class Worker:

    def __init__(id):
        self.id = id
        self.solver = CaDiCaL()
        self.pre_decisions = []
        self.master_pd = []
        self.export_lemma = []
        self.status = IDLE
        self.need_split = IDLE

    def split_node():
        lit = self.solver.VSIDS.pop()
        assert(lit is not in self.pre_decisions)
        return lit

    def cb_decide():
        # if status == CONFLICT:
        #     recevie_from_master() # MPI NEEDED
        if self.status == UPDATED:
            self.pre_decisions = self.master_pd
            self.status = SOLVING

        for l in self.pre_decisions:
            v = value(l)
            if v == 0:
                decide(l)
            else:
                # TBD (调用可能过于频繁，需要加入阈值降低频率)
                lemma = reasoning(self.solver, v)
                notify_master_pd_conflict(lemma)
                lemma_sharing()
                self.pre_decisions -= l
                self.status = CONFLICT
        if self.need_split == REQUEST:
            if self.status == SOLVING:
                # TBD
                # f = try_split()
                recommend_lit = split_node()
                self.pre_decisions += extranl(recommend_lit)
                Master.succeed_splits += (self.id, extranl(recommend_lit))
                self.need_split = IDLE
            else:
                self.need_split = FAILED

    def notify_master_pd_conflict(lemma):
        Master.pd_conflicts += (self.id, extranl(lemma))
```

# TODO List

```tasks
heading includes SAT-ParTi
sort by function task.created.format("dddd")
```
