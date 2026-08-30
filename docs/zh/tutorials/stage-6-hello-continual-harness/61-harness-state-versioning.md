---
title: "61 · Harness State Versioning"
description: "让 Harness State 的每一次修改都产生版本：Harness State v12 → Apply → v13，记录来源 Run。"
gitTag: "v61-state-versioning"
stage: 6
---

# 61 · Harness State Versioning

> <span class="stage-badge">Stage Hello Continual Harness</span> · <span class="tag-badge">v61-state-versioning</span> · <span class="stage-badge">规划中</span>

## 本章目标

让 Harness State 的每一次修改都产生版本：

```text
Harness State v12 → Apply（Create Skill）→ Harness State v13
```

> 如果 Harness 持续变化，但不知道「什么时候改的 / 改了什么 / 为什么改 / 由哪个 Run 触发」，就无法审计、比较、评估、回滚。

```ts
interface HarnessStateVersion {
  id: string;
  parentId?: string;
  mutations: HarnessMutation[];
  sourceRunIds: string[];
}
```

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

- HarnessStateStore（ch53）、Run id（ch14）、HarnessMutation（ch59）、Policy（ch60）

## 演示建议

提交两次 Mutation，展示 vN → vN+1 → vN+2 的版本链与 sourceRunIds。

## 遗留矛盾

版本有了，但「有些变化是错误的」——需要回滚能力兜底。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v61-state-versioning`