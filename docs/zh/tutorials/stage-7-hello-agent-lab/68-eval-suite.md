---
title: "68 · Eval Suite"
description: "从单个任务升级成任务集合：evals/bug-fix、refactor、feature、test、code-review，聚合结果。"
gitTag: "v68-eval-suite"
stage: 7
---

# 68 · Eval Suite

> <span class="stage-badge">Stage Hello Agent Lab</span> · <span class="tag-badge">v68-eval-suite</span> · <span class="stage-badge">规划中</span>

## 本章目标

从单个任务升级成任务集合：

```text
evals/
├── bug-fix/
├── refactor/
├── feature/
├── test/
└── code-review/
```

> 一个 Prompt 可能特别擅长 Bug Fix，但让 Code Review 变差。所以不能用一个任务判断 Harness 好坏。需要 Eval Suite → multiple EvalTask → aggregate result。

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

- EvalTask（ch65）、Verifier（ch66）、RunMetrics（ch67）

## 演示建议

在同一 Suite 上跑同一 Harness 两次，验证聚合结果可重复。

## 遗留矛盾

「新 Skill 好不好」本身没有意义——需要相对的 Baseline vs Candidate 比较。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v68-eval-suite`