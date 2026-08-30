---
title: "66 · Verifier"
description: "定义任务是否完成的客观验证器：tests/typecheck/lint/expected file/output equality，拒绝 Agent 自述成功。"
gitTag: "v66-verifier"
stage: 7
---

# 66 · Verifier

> <span class="stage-badge">Stage Hello Agent Lab</span> · <span class="tag-badge">v66-verifier</span> · <span class="stage-badge">规划中</span>

## 本章目标

定义任务是否完成的客观验证器：

```ts
interface Verifier {
  verify(task: EvalTask, run: AgentRun): Promise<VerificationResult>;
}
```

验证方式：tests pass / typecheck pass / lint pass / expected file exists / output equals expected。

> 不能让 Agent 自己说「任务已经完成」作为成功标准。尤其 Coding Agent 天然存在大量可以机械验证的任务。

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

- bash/read 工具（ch22/19）作为 Verifier 的执行手段、AgentRun（ch14）

## 演示建议

对「修复 failing test」任务的完成由 tests 结果判定，而不是模型自述。

## 遗留矛盾

判定了对错，但「成功但有代价」——还需要成本测量。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v66-verifier`