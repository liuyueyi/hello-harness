---
title: "72 · Regression Gate"
description: "防止局部优化破坏其他能力：target improves AND overall success >= baseline AND no critical regression。"
gitTag: "v72-regression-gate"
stage: 7
---

# 72 · Regression Gate

> <span class="stage-badge">Stage Hello Agent Lab</span> · <span class="tag-badge">v72-regression-gate</span> · <span class="stage-badge">规划中</span>

## 本章目标

防止局部优化破坏其他能力。

例如 Candidate：Bug Fix +12%，但 Refactor -18%、Code Review -25%——这种 Candidate 不一定值得晋升。

> Self-improving Harness 最危险的问题之一就是「局部优化 → 全局退化」。定义晋升门槛：target improves AND overall success >= baseline AND no critical regression，形成 Regression Gate。

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

- Baseline vs Candidate（ch69）、EvalSuite（ch68）、RunMetrics（ch67）

## 演示建议

构造一个「目标提升但整体退化」的 Candidate，被 Regression Gate 拦下。

## 遗留矛盾

有门槛了，还要决定谁真正进入 Harness State——Promote / Reject。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v72-regression-gate`