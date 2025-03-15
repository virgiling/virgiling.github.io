---
title: 作为优化器的大模型
description: 
tags:
  - 论文阅读笔记/组合优化
  - CCF/A/ICLR
date: 2025-02-09
lastmod: 2025-02-09
draft: true
zotero-key: DJLYS643
zt-attachments:
  - "818"
citekey: yangLargeLanguageModels2024
---
> [!tldr]
> 
> [文章链接](http://arxiv.org/abs/2309.03409)
>  
# Large Language Models as Optimizers

> [!summary] 
> 
> Optimization is ubiquitous. While derivative-based algorithms have been powerful tools for various problems, the absence of gradient imposes challenges on many real-world applications. In this work, we propose Optimization by PROmpting (OPRO), a simple and effective approach to leverage large language models (LLMs) as optimizers, where the optimization task is described in natural language. In each optimization step, the LLM generates new solutions from the prompt that contains previously generated solutions with their values, then the new solutions are evaluated and added to the prompt for the next optimization step. We first showcase OPRO on linear regression and traveling salesman problems, then move on to our main application in prompt optimization, where the goal is to find instructions that maximize the task accuracy. With a variety of LLMs, we demonstrate that the best prompts optimized by OPRO outperform human-designed prompts by up to 8% on GSM8K, and by up to 50% on Big-Bench Hard tasks. Code at https://github.com/google-deepmind/opro.


