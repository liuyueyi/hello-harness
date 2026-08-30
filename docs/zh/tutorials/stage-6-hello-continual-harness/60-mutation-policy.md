---
title: "60 · Mutation Policy"
description: "把 Stage 4 的 Permission 应用到 Harness Mutation：Create Memory → auto allow，Update Prompt → require approval，Delete Skill → deny。"
gitTag: "v60-mutation-policy"
stage: 6
---

# 60 · Mutation Policy

> <span class="stage-badge">Stage Hello Continual Harness</span> · <span class="tag-badge">v60-mutation-policy</span> · <span class="stage-badge">规划中</span>

## 本章目标

把 Stage 4 的 Permission 进一步应用到 Harness Mutation：

```text
Create Memory → auto allow
Create Skill → allow
Update Prompt → require approval
Delete Skill → deny
```

```ts
interface MutationPolicy {
  check(mutation: HarnessMutation): MutationDecision;
}
```

> 不是所有 Harness 修改风险都一样：「存一条经验」与「修改全局 system prompt」风险完全不同。

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

- PermissionGate（ch37）、PermissionPolicy（ch37）、HarnessMutation（ch59）

## 演示建议

用 MutationPolicy 对三类 Mutation 得到 allow / deny / ask 决策并结构化返回。

## 遗留矛盾

Harness 开始持续变化，但我们不知道「什么时候改的、改了什么、为什么改」——需要版本。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v60-mutation-policy`