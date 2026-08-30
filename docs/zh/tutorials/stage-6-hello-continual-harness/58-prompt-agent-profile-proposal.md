---
title: "58 · Prompt / Agent Profile Proposal"
description: "让 Prompt 与 Agent Profile 也进入统一演进体系：不是 self-edit，而是 Proposal。"
gitTag: "v58-prompt-profile-proposal"
stage: 6
---

# 58 · Prompt / Agent Profile Proposal

> <span class="stage-badge">Stage Hello Continual Harness</span> · <span class="tag-badge">v58-prompt-profile-proposal</span> · <span class="stage-badge">规划中</span>

## 本章目标

让除 Memory / Skill 以外的 Harness State 也进入统一演进体系，包括 Prompt Proposal 与 Agent Profile Proposal。

例如「代码审查任务中，应该优先先读 tests」可以产生 Prompt Proposal；频繁出现「安全审计」任务可以产生 `security-reviewer` Agent Profile。

> 不要实现 `self-edit prompt` / `self-create agent` 这种直接修改——统一成 Proposal：Agent 只负责「提出候选改变」，并不自动证明「它更好」。

## 正文结构

撰写时按统一模板展开：

1. 上一版存在什么问题？
2. 本篇解决什么问题？
3. 先看最终效果
4. 架构变化
5. 核心抽象
6. 实现代码
7. 运行 Demo
8. 新架构解决了什么？
9. 它又引入了什么问题？
10. 下一章

## 复用

- PromptRegistry（ch33）、Agent Profile 声明（ch34–38 扩展）、State API（ch54）

## 演示建议

让模型程序同时提出一个 Prompt Proposal 和一个 Agent Profile Proposal。

## 遗留矛盾

Memory / Skill / Prompt / Agent Profile 各自有 proposal，机制开始重复——需要统一 Mutation。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v58-prompt-profile-proposal`