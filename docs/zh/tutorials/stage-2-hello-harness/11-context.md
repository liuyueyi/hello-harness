---
title: "11 · Context"
description: "把 messages[] 升级为 AgentContext，理解 Context 是 Agent 当前可见世界（先不要叫 Memory）。"
gitTag: "v11-context"
stage: 2
---

# 11 · Context

> <span class="stage-badge">Stage Hello Harness</span> · <span class="tag-badge">v11-context</span> · <span class="stage-badge">规划中</span>

## 本章目标

把 messages[] 升级为 AgentContext，理解 Context 是 Agent 当前可见世界（先不要叫 Memory）。

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

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v11-context`