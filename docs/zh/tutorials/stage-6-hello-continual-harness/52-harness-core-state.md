---
title: "52 · Harness Core 与 Harness State"
description: "第一次明确区分 Harness Core 与 Harness State，确立最重要安全边界：Agent 可修改 State，不能破坏 Core。"
gitTag: "v52-harness-core-state"
stage: 6
---

# 52 · Harness Core 与 Harness State

> <span class="stage-badge">Stage Hello Continual Harness</span> · <span class="tag-badge">v52-harness-core-state</span> · <span class="stage-badge">规划中</span>

## 本章目标

第一次明确区分：

```text
Harness
├── Core：AgentRuntime / Session / Event / Tool Execution / Permission / Provider
└── State：Prompts / Skills / Memories / Agent Profiles
```

> 核心边界：**Agent 可以修改 Harness State，但不能随意修改 Harness Core。**

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

- AgentRuntime、Session、Events（Stage 2–3）、Programmatic Harness State API 的雏形（Stage 5）

## 演示建议

用一张 HarnessState 接口图展示哪些字段可演进、哪些边界不可碰。

## 遗留矛盾

State 有了边界，但散落各处——需要统一存储层。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v52-harness-core-state`