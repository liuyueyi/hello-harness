---
title: "50 · Persistent Working State"
description: "变量跨 Action 存活：files / analysis 不需要塞进 messages；AgentSession 增加 program 会话。"
gitTag: "v50-persistent-state"
stage: 5
---

# 50 · Persistent Working State

> <span class="stage-badge">Stage Hello Programmatic Agent</span> · <span class="tag-badge">v50-persistent-state</span> · <span class="stage-badge">规划中</span>

## 本章目标

为什么需要 persistent？不是炫技：假设上一轮 `files = await glob(...)`、`analysis = await asyncio.gather(...)`，下一轮模型只需要 `len(analysis)`。如果每次代码执行都是新 process，`analysis` 就消失了。

于是：

```text
Code as Action → 需要跨 Action 保留程序状态 → Persistent Execution
```

实现上只是 **Session enhancement**，不是第二套 Runtime：

```ts
interface AgentSession {
  id: string;
  context: AgentContext;
  program?: ProgramSession;   // REPL / Working State：execute(code)
}
```

顺带收获：大文件内容可留在 program state，只有必要结果进入下一轮模型——**Context as Variable 的起点**（降低必须变成 token 的数据量，而非重新实现 Compaction）。

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

- **Session（ch26–28 持久化思想）**、Programmatic Binding（ch44）、Events

## 演示建议

展示同一 Session 下两次程序执行间变量存活；对照「每次执行即死」的差距。大仓库筛选：只有关键摘录 `print` 进入模型上下文。

## 遗留矛盾

Working State 与对话历史必须分离管理（可重置、可快照）；这一整套「程序化使用 Harness」的模式叫什么？

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v50-persistent-state`