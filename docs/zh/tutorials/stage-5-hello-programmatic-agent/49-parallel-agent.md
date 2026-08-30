---
title: "49 · Parallel Agents"
description: "因为 agent 已经是函数，并行自然出现：gather(agent(...), agent(...), agent(...))。"
gitTag: "v49-parallel-agent"
stage: 5
---

# 49 · Parallel Agents

> <span class="stage-badge">Stage Hello Programmatic Agent</span> · <span class="tag-badge">v49-parallel-agent</span> · <span class="stage-badge">规划中</span>

## 本章目标

ch47 之后 agent 是函数，ch48 之后它可递归；本章让它可并行：

```python
results = await gather(
    agent("分析前端"),
    agent("分析后端"),
    agent("分析数据库"),
)
```

并行不是新抽象，而是「函数可组合」的自然结果。仍需处理：**并发预算（同时跑几个）、共享资源冲突（同一文件被多子 Agent 改写）、取消的级联**。

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

- **AgentRuntime、AgentSpawner**（ch47–48）、Events、Permission（写冲突需要过闸）

## 演示建议

多模块分析任务并行跑 3 个子 Agent，展示汇总结果与并发预算限制。

## 遗留矛盾

并行子 Agent 的结果如何留到「下一轮」用？变量在每次程序执行后是否还活着？

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v49-parallel-agent`