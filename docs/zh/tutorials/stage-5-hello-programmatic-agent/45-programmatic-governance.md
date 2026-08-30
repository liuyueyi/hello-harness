---
title: "45 · Permission / Event / Error 仍然有效"
description: "Programmatic Calling 改变的是调用方式，不是 Harness 的治理体系：Permission / Hook / Event / Timeout / Error 全部继续生效。"
gitTag: "v45-programmatic-governance"
stage: 5
---

# 45 · Permission / Event / Error 仍然有效

> <span class="stage-badge">Stage Hello Programmatic Agent</span> · <span class="tag-badge">v45-programmatic-governance</span> · <span class="stage-badge">规划中</span>

## 本章目标

演示程序里的 `await bash("rm -rf dist")` **不是 Python 自己执行 shell**，而是：

```text
Python call → Harness Bridge → bash Tool → Permission Gate → Shell Executor
```

于是 Stage 4 的 `Permission / Hooks / Events / Workspace / Tool Timeout / Error Model` 全部继续生效。

> 核心：**Programmatic Calling 改变的是调用方式，不是 Harness 的治理体系。** 从 ch44 的 bridge 往下，Permission 完全复用。

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

- **PermissionGate**（ch37）、Hooks（ch32）、Events（ch15）、Workspace、Tool 超时、ErrorModel（ch16）

## 演示建议

让程序执行被权限策略拒绝的 bash 命令，验证结构化拒绝（`kind: permission`）原样回到模型。

## 遗留矛盾

拒绝发生在能力调用级，程序内部的控制流无法被逐行治理——那「程序化的技能」应该如何受控？

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v45-programmatic-governance`