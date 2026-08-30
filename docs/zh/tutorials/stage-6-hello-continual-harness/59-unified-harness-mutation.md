---
title: "59 · Unified Harness Mutation"
description: "把 Create Memory / Create Skill / Update Prompt / Create Agent 统一抽象为 HarnessMutation 与单一 Mutation Pipeline。"
gitTag: "v59-unified-mutation"
stage: 6
---

# 59 · Unified Harness Mutation

> <span class="stage-badge">Stage Hello Continual Harness</span> · <span class="tag-badge">v59-unified-mutation</span> · <span class="stage-badge">规划中</span>

## 本章目标

把前面 Create Memory / Create Skill / Update Prompt / Create Agent 统一抽象：

```ts
type HarnessMutation =
  | CreateMemoryMutation
  | CreateSkillMutation
  | UpdateSkillMutation
  | UpdatePromptMutation
  | CreateAgentMutation
  | UpdateAgentMutation;
```

> 如果每种状态都有自己的「自我改进系统」（MemoryManager / SkillCreator / PromptOptimizer / AgentGenerator），架构会迅速分裂。真正需要的是统一 Mutation Pipeline：Proposal → Validate → Authorize → Apply。

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

- State API（ch54）、Skill / Prompt / Agent Profile 各类 Proposal（ch57–58）

## 演示建议

把三种不同修改统一进同一个 Mutation 类型并跑通统一 Pipeline。

## 遗留矛盾

所有修改风险不一样——「存一条经验」与「修改全局 system prompt」不能同等对待。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v59-unified-mutation`