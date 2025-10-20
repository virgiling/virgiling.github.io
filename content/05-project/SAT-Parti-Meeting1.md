---
title: SAT 分布式并行求解 Meeting#1
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
# Meeting#1

![[2025-10-08-19-38-07.excalidraw|路线图|1500]]

- [x] kissat 更换为 cadical （0.5 version） ✅ 2025-10-17
- [x] 加上 lemma sharing 的 cadical （1.0 version）用于消融实验 ✅ 2025-10-17
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


