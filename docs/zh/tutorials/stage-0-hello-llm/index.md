---
title: Stage 0 · Hello LLM
---

# Stage 0 · Hello LLM

> <span class="stage-badge">Stage 0</span> · Git Tag 范围：<span class="tag-badge">v00-empty</span> ~ <span class="tag-badge">v04-provider</span>

## 目标

先把一切 Agent 概念拿掉，只理解模型调用。不要出现 Agent、Tool、Memory、Skill、MCP、Planner，只做最干净的 Model Layer。

## 毕业作品

**CLI Chat**

## 章节清单

| # | 章节 | Git Tag | 状态 |
| --- | --- | --- | --- |
| 00 | [项目初始化](00-project-setup) | v00-empty | 已完成 |
| 01 | [第一次调用模型](01-first-model-call) | v01-model | 已完成 |
| 02 | [Messages 是什么](02-messages) | v02-messages | <span class="stage-badge">规划中</span> |
| 03 | [Streaming](03-streaming) | v03-stream | <span class="stage-badge">规划中</span> |
| 04 | [Model Provider 抽象](04-provider-abstraction) | v04-provider | <span class="stage-badge">规划中</span> |
| 阶段结尾 |

这一阶段结束：你有了最干净的 Model Layer，下一步进入 Tool Calling，构建真正的 Agent Loop。