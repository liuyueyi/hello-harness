---
title: "63 · Hello Continual Harness"
description: "阶段总结：Static Harness → Versioned Mutable State → Continual Harness；Harness 会持续变化，但还不能说会持续变好。"
gitTag: "v63-continual-harness"
stage: 6
---

# 63 · Hello Continual Harness

> <span class="stage-badge">Stage Hello Continual Harness</span> · <span class="tag-badge">v63-continual-harness</span> · <span class="stage-badge">规划中</span>

## 本章目标

把 Stage 6 的所有概念串起来：

```text
Task → AgentRuntime → Run → Experience → Mutation Proposal → Policy → Harness State vN+1 → Next Task
```

> 什么叫 Continual Harness？不是「有 Memory」也不是「会自动创建 Skill」，而是：Harness 的可演进状态，可以持续由执行经验驱动产生变化。

最终：

```text
Static Harness → Versioned Mutable Harness State → Continual Harness
```

但此时只敢说「Harness 会持续变化」，还不能说「Harness 会持续变好」——这正好进入 Stage 7。

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

以上全部：StateStore、State API、Memory、Experience、Skill Proposal、Mutation、Policy、Version、Rollback。

## 演示建议

完整体验：一次任务 → 提炼经验 → 提出 Skill/Prompt 变更 → 策略放行 → 生成新版本 State。

## 遗留矛盾

Agent「会修改自己」≠「会改进自己」——谁来证明修改是有效的？→ Stage 7。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v63-continual-harness`