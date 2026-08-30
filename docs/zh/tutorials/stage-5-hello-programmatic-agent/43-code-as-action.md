---
title: "43 · Code as Action"
description: "第一次让模型生成程序：一次 Action 内多次调用 Harness 能力（循环、过滤、组合由模型自己写）。"
gitTag: "v43-code-as-action"
stage: 5
---

# 43 · Code as Action

> <span class="stage-badge">Stage Hello Programmatic Agent</span> · <span class="tag-badge">v43-code-as-action</span> · <span class="stage-badge">规划中</span>

## 本章目标

让模型第一次输出「程序」而不是「单个 Tool Call」：

```python
files = await glob("src/**/*.ts")
targets = []
for file in files:
    text = await read(file)
    if "AgentRuntime" in text and len(text.splitlines()) > 300:
        targets.append(extract_class(text))
```

> 核心：**Model 负责生成程序，Harness 负责执行能力。** 把能力编排权从 Harness Loop 的多轮 Tool Calling，部分交给模型生成的程序。

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

- Model（输出可执行代码）、Agent Loop（收集 Action 结果回填上下文）

## 核心抽象

`CodeAction`：一段模型生成的代码，执行结果成为一条新的上下文输入。

## 演示建议

承接 ch42 的同一组合任务，用一段程序完成，对比「一次 Action vs 多次往返」。

## 遗留矛盾

程序每次执行都是全新环境——`files`、`targets` 等变量在下一轮消失。

## 验收清单

- [ ] 正文撰写
- [ ] 最小示例与可复现的演示命令
- [ ] 对应 Git Tag `v43-code-as-action`