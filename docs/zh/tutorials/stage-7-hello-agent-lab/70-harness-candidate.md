---
title: "70 · Harness Candidate"
description: "把 Stage 6 的 Mutation 组织成可运行的候选 Harness：baseVersion + mutations；Candidate ≠ 正式版本。"
gitTag: "v70-harness-candidate"
stage: 7
---

# 70 · Harness Candidate

> <span class="stage-badge">Stage Hello Agent Lab</span> · <span class="tag-badge">v70-harness-candidate</span> · <span class="stage-badge">规划中</span>

## 本章目标

把 Stage 6 的 Mutation 组织成候选 Harness：

```ts
interface HarnessCandidate {
  baseVersion: string;
  mutations: HarnessMutation[];
}
```

> Stage 6 的 Mutation 只是「变化描述」；Stage 7 需要一个可以真正运行的 Candidate State，才能进行测试。形成：Current v12 → Mutation Proposal → Candidate v12+c1，但 Candidate 尚未晋升成正式版本。

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

- HarnessMutation（ch59）、HarnessStateStore / Version（ch53/61）、State API（ch54）

## 演示建议

从当前 v12 构造一个只叠加一条 Skill Mutation 的 Candidate，并在沙箱运行。

## 遗留矛盾

不同种类的 Mutation（Prompt / Skill / Memory / Agent）不能用各自不同的评估系统——需要统一评估。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v70-harness-candidate`