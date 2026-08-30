---
title: "54 · Programmatic Harness State API"
description: "承接 Stage 5：await harness.memory.create(...) / skills.propose(...) / prompt.propose(...) / agents.propose(...)，而非 fs.write 直改。"
gitTag: "v54-programmatic-state-api"
stage: 6
---

# 54 · Programmatic Harness State API

> <span class="stage-badge">Stage Hello Continual Harness</span> · <span class="tag-badge">v54-programmatic-state-api</span> · <span class="stage-badge">规划中</span>

## 本章目标

承接 Stage 5 的 programmatic binding，把「改 Harness State」也变成受控的编程函数：

```python
await harness.memory.create(...)
await harness.skills.propose(...)
await harness.prompt.propose(...)
await harness.agents.propose(...)
```

> 不能让 Agent 通过 `fs.write(".harness/...")` 随意修改状态，否则绕过 Permission / Validation / Event / Version / Audit——需要正式的 State API。

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

- Programmatic Harness Interface（Stage 5）、ToolRegistry、Permission、StateStore（ch53）

## 演示建议

让模型程序调用 `await harness.memory.create(...)` 走完 Agent → State API → Validation → Permission → State Store 全链路。

## 遗留矛盾

Memory 是 State 的一种——那它与 Session / Context 到底有什么区别？

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v54-programmatic-state-api`