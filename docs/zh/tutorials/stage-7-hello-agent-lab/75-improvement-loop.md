---
title: "75 · Improvement Loop"
description: "把 Stage 6 与 Stage 7 真正闭环：Measure → Analyze → Propose → Test → Select → Repeat。"
gitTag: "v75-improvement-loop"
stage: 7
---

# 75 · Improvement Loop

> <span class="stage-badge">Stage Hello Agent Lab</span> · <span class="tag-badge">v75-improvement-loop</span> · <span class="stage-badge">规划中</span>

## 本章目标

把 Stage 6 和 Stage 7 真正闭环：

```text
Current Harness → Eval Suite → Failure Analysis → Mutation Proposal
→ Candidate Harness → Eval Suite → Compare → Promote / Reject
```

> 前面每个模块都是独立能力，这篇回答：怎么让它们形成真正持续工作的改进循环？第一次得到：Measure → Analyze → Propose → Test → Select → Repeat。

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

以上全部：EvalSuite、FailureAnalysis、Mutation、Candidate、RegressionGate、Promote/Reject。

## 演示建议

跑完一轮完整的 improve loop，观察 Harness State 的版本晋升。

## 遗留矛盾

闭环有了，但还缺最后一次系统性总结——把它命名为 Self-Improving Harness。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v75-improvement-loop`