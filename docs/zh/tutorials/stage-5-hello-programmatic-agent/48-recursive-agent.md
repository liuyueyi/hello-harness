---
title: "48 · Recursive Agent"
description: "Parent → Child AgentRuntime：depth / parent-child / usage / abort / lifecycle，全部复用前面的 Runtime。"
gitTag: "v48-recursive-agent"
stage: 5
---

# 48 · Recursive Agent

> <span class="stage-badge">Stage Hello Programmatic Agent</span> · <span class="tag-badge">v48-recursive-agent</span> · <span class="stage-badge">规划中</span>

## 本章目标

当 `agent()` 成为函数，递归结构自然出现：根 Agent 生成的程序里再调用 `agent()`，产生子 AgentRuntime 与子 Session。

```text
Root AgentRuntime
    ↓ 生成的程序
Programmatic Layer
    ↓ await agent("...")
AgentSpawner
    ↓
Child AgentRuntime
  ├── Child Session
  └── Child Context
```

学习子 Agent 的 **depth / parent-child / usage / abort / lifecycle**——这全部复用前面的 Runtime，不新造一套。

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

- **AgentRuntime**、Session、Events（Stage 2–3）；AgentSpawner（ch47）

## 演示建议

用最大深度预算演示两层递归子 Agent，展示 usage 汇总与 abort 传播。

## 遗留矛盾

递归必须上预算（最大深度 / 子 Agent 预算 / 取消传播）；多个子 Agent 能否同时跑？

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v48-recursive-agent`