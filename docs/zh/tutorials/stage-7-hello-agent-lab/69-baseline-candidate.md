---
title: "69 · Baseline vs Candidate"
description: "建立最重要的比较模型：同样的任务，用 Candidate 是否比当前版本更好，把绝对评价升级为相对比较。"
gitTag: "v69-baseline-candidate"
stage: 7
---

# 69 · Baseline vs Candidate

> <span class="stage-badge">Stage Hello Agent Lab</span> · <span class="tag-badge">v69-baseline-candidate</span> · <span class="stage-badge">规划中</span>

## 本章目标

建立 Stage 7 最重要的比较模型：

```text
Baseline Harness vs Candidate Harness
```

例如：Prompt v3 vs Prompt v4，或 without new Skill vs with new Skill。

> 「这个新 Skill 好不好？」本身没有意义。真正的问题是：同样的任务，用 Candidate 是否比当前版本更好。把绝对评价升级为相对比较。

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

- EvalSuite（ch68）、HarnessStateVersion（ch61）作为 Baseline 来源

## 演示建议

同一 Suite 下对 Baseline 与 Candidate 各跑一次，输出对比摘要。

## 遗留矛盾

「变化」和「可运行的候选」是两回事——需要真正的 Harness Candidate。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v69-baseline-candidate`