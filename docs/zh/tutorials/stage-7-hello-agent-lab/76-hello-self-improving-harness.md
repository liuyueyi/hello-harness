---
title: "76 · Hello Self-Improving Harness"
description: "系统性总结：Static → Extensible → Programmatic → Continual → Evaluated Continual → Self-Improving Harness。"
gitTag: "v76-self-improving"
stage: 7
---

# 76 · Hello Self-Improving Harness

> <span class="stage-badge">Stage Hello Agent Lab</span> · <span class="tag-badge">v76-self-improving</span> · <span class="stage-badge">规划中</span>

## 本章目标

整个教程最后的系统性总结。

> 什么才真正算 Self-Improving Harness？不是「能写 Skill、能存 Memory、能改 Prompt」，而是：能从运行中发现问题、能提出 Harness 改动、能构建 Candidate、能客观评估 Candidate、能拒绝退化、能晋升更优版本。

完整跃迁：

```text
Static Harness
  → Extensible Harness
  → Programmatic Harness
  → Continual Harness
  → Evaluated Continual Harness
  → Self-Improving Harness
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

以上全部：从 Model（Stage 0）到 Evaluation（Stage 7）的整条链路。

## 演示建议

最终毕业演示：一套任务集上，Harness 经历一轮「发现问题 → 提出变更 → 候选评估 → 晋升」，并输出可复现证据。

## 遗留矛盾

整套教程到此闭环；「性能提升必须由可复现评测证明」成为最重要的一条原则。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v76-self-improving`