---
title: "64 · Continual ≠ Improving"
description: "第一章节掉错误认识：会修改自己 ≠ 会改进自己，正式引出 Evaluation Harness。"
gitTag: "v64-continual-vs-improving"
stage: 7
---

# 64 · Continual ≠ Improving

> <span class="stage-badge">Stage Hello Agent Lab</span> · <span class="tag-badge">v64-continual-vs-improving</span> · <span class="stage-badge">规划中</span>

## 本章目标

第一章节掉一个错误认识：

```text
会修改自己 ≠ 会改进自己
```

Stage 6 可能产生更多 Memory、更多 Skills、更长 Prompt、更多 Agent Profile——但这些变化可能造成更贵、更慢、更容易误调用、更高 Context 占用、更差成功率。

> 正式引出 Evaluation Harness，并建立「change → candidate → evidence → selection」的思维方式。

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

- Continual Harness（Stage 6）、HarnessStateVersion / Rollback（ch61–62）

## 演示建议

让一个「变长的 Prompt」在同类任务上对比前后成本与成功率。

## 遗留矛盾

要比较就得有可重复执行的任务单元——Eval Task。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v64-continual-vs-improving`