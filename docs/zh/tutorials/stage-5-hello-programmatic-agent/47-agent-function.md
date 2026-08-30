---
title: "47 · Agent as Function"
description: "agent() 底层直接复用 AgentRuntime，不是新 Agent 实现——LLM 调用本身成为可编程函数。"
gitTag: "v47-agent-function"
stage: 5
---

# 47 · Agent as Function

> <span class="stage-badge">Stage Hello Programmatic Agent</span> · <span class="tag-badge">v47-agent-function</span> · <span class="stage-badge">规划中</span>

## 本章目标

Code as Action 最重要的演进：**LLM 调用本身也成为一个可编程函数**。

```python
auth = await agent("分析认证模块", context=auth_files)
```

`agent()` 从哪来？——直接调用前面的 **AgentRuntime**：

```text
Programmatic Environment → agent() → AgentRuntime → Session
```

> 复用 Stage 2 的 Runtime、Stage 3 的 Session、Stage 4 的 Skills——Agent 成为编程环境里的一个一等函数。

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

- **AgentRuntime**（ch12）、Context（ch11）、Session（ch26）、Events、Provider

## 演示建议

模型程序里 `agent()` 启动一个带独立 Session 的子任务，验证其复用同一套 runtime 能力。

## 遗留矛盾

父 Agent 调用子 Agent 后，子 Agent 该看到多少上下文？递归深度如何收口？

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v47-agent-function`