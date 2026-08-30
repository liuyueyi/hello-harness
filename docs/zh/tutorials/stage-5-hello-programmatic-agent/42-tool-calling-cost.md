---
title: "42 · Tool Calling 的组合成本"
description: "Tool Calling 擅长选择能力，但不擅长低成本组合能力；复杂组合依赖模型多轮往返。"
gitTag: "v42-composition-cost"
stage: 5
---

# 42 · Tool Calling 的组合成本

> <span class="stage-badge">Stage Hello Programmatic Agent</span> · <span class="tag-badge">v42-composition-cost</span> · <span class="stage-badge">规划中</span>

## 本章目标

展示 Tool Calling 在「单次能力调用」上很好，但复杂能力组合会越来越依赖模型多轮往返：10 个 Tool Call 往往需要 10 次模型决策。

> 不是「工具不够用」，而是「组合成本太高」。给定 `glob / read / grep`，模型要做「找出 src 下包含 `AgentRuntime` 且超过 300 行的 TypeScript 文件，再只读其中的 class 定义」，传统 Tool Calling 会退化成 `Model → glob → Model → read → Model → …` 的大量往返。

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

- Model、Agent Loop（Stage 1–2）
- ToolRegistry / read / write / edit / bash / git（Stage 3–4）

## 演示建议

用 Fake Model 记录「同一组合任务」在 Tool Calling 下的往返次数（n 次决策），作为 ch43「一次程序取代多轮往返」的对照组。

## 遗留矛盾

组合能力越强，`Model ↔ Harness` 往返越贵——模型明明可以用程序表达循环与过滤。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v42-composition-cost`