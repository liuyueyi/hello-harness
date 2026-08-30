---
title: "71 · Evaluate Harness Mutation"
description: "用同一套 Eval Pipeline 评估所有 Mutation（Prompt/Skill/Memory/Agent Profile），不分别做各自评估系统。"
gitTag: "v71-evaluate-mutation"
stage: 7
---

# 71 · Evaluate Harness Mutation

> <span class="stage-badge">Stage Hello Agent Lab</span> · <span class="tag-badge">v71-evaluate-mutation</span> · <span class="stage-badge">规划中</span>

## 本章目标

让同一套 Eval Pipeline 能测试 Prompt Mutation、Skill Mutation、Memory Mutation、Agent Profile Mutation。

> 不要分别做 Prompt Eval / Skill Eval / Memory Eval 系统——从 Harness 视角它们都只是 State Mutation。统一：Mutation → Candidate → Eval Suite → Metrics。

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

- HarnessMutation（ch59）、HarnessCandidate（ch70）、EvalSuite（ch68）、Verifier（ch66）

## 演示建议

让同一条 Eval 流水线依次评估 Skill 与 Prompt 两类 Mutation。

## 遗留矛盾

Candidate 在某类任务提升，可能让其他类任务退化——需要 Regression Gate。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v71-evaluate-mutation`