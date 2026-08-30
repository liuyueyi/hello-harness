---
title: "74 · Failure Analysis"
description: "从 Eval Failure 反推 Harness 为什么失败：错误 Tool 使用 / Context 不足 / Prompt 冲突 / 缺少或错误 Skill / 过度 delegation。"
gitTag: "v74-failure-analysis"
stage: 7
---

# 74 · Failure Analysis

> <span class="stage-badge">Stage Hello Agent Lab</span> · <span class="tag-badge">v74-failure-analysis</span> · <span class="stage-badge">规划中</span>

## 本章目标

从 Eval Failure 反推 Harness 为什么失败，而不是看到 `success rate = 72%` 就结束。

可分析：错误 Tool 使用、Context 不足、Prompt 指令冲突、缺少 Skill、错误 Skill、过多 Agent delegation。

> 没有 Failure Analysis，Evaluation 只能告诉你「差」，但无法告诉你下一步改什么。形成：Failed Runs → Failure Analyzer → Improvement Hypothesis，成为下一轮 Mutation Proposal 的输入。

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

- Trajectory / Steps / Tool Calls（ch13–15）、EvalSuite 的失败样本（ch68）、RunMetrics（ch67）

## 演示建议

对一组失败 Run 输出可操作的 Improvement Hypothesis。

## 遗留矛盾

有了假设，还要让这些模块真正循环起来——Improvement Loop。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v74-failure-analysis`