---
title: "53 · Harness State Store"
description: "给所有可演进 Harness State 建立统一存储层 .harness/，否则版本、回滚、比较、评估都很难做。"
gitTag: "v53-harness-state-store"
stage: 6
---

# 53 · Harness State Store

> <span class="stage-badge">Stage Hello Continual Harness</span> · <span class="tag-badge">v53-harness-state-store</span> · <span class="stage-badge">规划中</span>

## 本章目标

给所有可演进 Harness State 建立统一存储层：

```text
.harness/
├── prompts/
├── skills/
├── memories/
├── agents/
└── state.json
```

```ts
interface HarnessStateStore {
  load(): Promise<HarnessState>;
  save(state: HarnessState): Promise<void>;
}
```

> 如果没有统一 Store，Skill / Prompt / Memory / Agent Profile 各自保存，后面的版本、回滚、比较、评估都会很难做。

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

- Session 持久化思想（ch27–28）、Workspace（ch23）

## 演示建议

让 StateStore 复用 Workspace 读写 `.harness/state.json`，演示 load / save。

## 遗留矛盾

模型程序还只能「用」Harness，不能「改」State——需要正式 State API。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v53-harness-state-store`