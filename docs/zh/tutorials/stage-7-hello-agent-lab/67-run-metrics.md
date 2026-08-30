---
title: "67 · Run Metrics"
description: "除成功/失败外再测量运行成本：steps / modelCalls / toolCalls / tokens / durationMs，得到可比较数据。"
gitTag: "v67-run-metrics"
stage: 7
---

# 67 · Run Metrics

> <span class="stage-badge">Stage Hello Agent Lab</span> · <span class="tag-badge">v67-run-metrics</span> · <span class="stage-badge">规划中</span>

## 本章目标

除了成功 / 失败，再测量运行成本：

```ts
interface RunMetrics {
  success: boolean;
  steps: number;
  modelCalls: number;
  toolCalls: number;
  tokens: number;
  durationMs: number;
}
```

> 两个 Harness 都能成功：A 用 6 steps，B 用 27 steps——显然并不等价。Self-improving 不应该只有「能不能做成」，还应该考虑成本 / 效率 / 稳定性。

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

- AgentRun / steps / token 计数（ch13–14、ch18）、Events（ch15）

## 演示建议

对同一个 EvalTask 跑两个 Harness，输出可比较的 RunMetrics。

## 遗留矛盾

单个任务不足以判断一个 Harness 好坏——需要任务集合。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v67-run-metrics`