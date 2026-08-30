---
title: "55 · Memory as Harness State"
description: "把 Memory 重新定义为 Harness State 的一种持久化资产，与 Session 区分：Session=同一次工作继续，Memory=跨 Run 保留经验。"
gitTag: "v55-memory-harness-state"
stage: 6
---

# 55 · Memory as Harness State

> <span class="stage-badge">Stage Hello Continual Harness</span> · <span class="tag-badge">v55-memory-harness-state</span> · <span class="stage-badge">规划中</span>

## 本章目标

正式引入 Memory，但重新定义它：

> Memory 不是独立的「AI 神奇能力」，而是 Harness State 的一种持久化资产。

第一版：

```ts
interface MemoryItem {
  id: string;
  lesson: string;
  useWhen?: string;
  sourceRunId?: string;
}
```

> Session 只能恢复一次任务；Memory 解决的是——上一次任务学到的东西，下一次全新任务还能不能复用。

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

- Session / Context（ch26–28）、HarnessStateStore（ch53）

## 演示建议

演示同一 Memory 在两次全新 Run 之间被加载使用。

## 遗留矛盾

Memory 不能把聊天记录永久保存——需要只提炼真正值得保留的经验。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v55-memory-harness-state`