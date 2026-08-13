---
title: 教程地图
---

# 教程地图

> 从 `Hello LLM` 到 `Hello Agent Lab`，81 篇章节、8 个 Stage、每章一个可检出的 Git Tag。

## 阅读方式

每完成一章，就有一个对应的 Git Tag。你可以直接检出该章节的最终状态来对照阅读：

```bash
git checkout v08-agent-loop
git checkout v40-pi-style
git checkout v56-rlm
git checkout v70-continual-harness
```

## Stage 一览

| Stage | 主题 | 章节 | Git Tag 范围 | 完成产物 |
| --- | --- | --- | --- | --- |
| [Stage 0](stage-0-hello-llm/) | Hello LLM | 00–04 | `v00-empty` ~ `v04-provider` | CLI Chat |
| [Stage 1](stage-1-hello-agent/) | Hello Agent | 05–09 | `v05-tool-call` ~ `v09-stop-condition` | Tool Calling Agent |
| [Stage 2](stage-2-hello-harness/) | Hello Harness | 10–18 | `v10-tool-registry` ~ `v18-minimal-harness` | Minimal Agent Runtime |
| [Stage 3](stage-3-hello-coding-agent/) | Hello Coding Agent | 19–28 | `v19-read` ~ `v28-resume` | Coding CLI |
| [Stage 4](stage-4-hello-pi/) | Hello Pi | 29–40 | `v29-small-core` ~ `v40-pi-style` | Extensible Coding Agent |
| [Stage 5](stage-5-hello-rlm/) | Hello RLM | 41–56 | `v41-tool-limit` ~ `v56-rlm` | Recursive Runtime Agent |
| [Stage 6](stage-6-hello-continual-harness/) | Hello Continual Harness | 57–70 | `v57-harness-state` ~ `v70-continual-harness` | Persistent Self-Adapting Agent |
| [Stage 7](stage-7-hello-agent-lab/) | Hello Agent Lab | 71–80 | `v71-task-dataset` ~ `v80-self-improving` | Evaluated Self-Improving Harness |

## 整体叙事

```text
Chat Completion
    ↓
Tool Calling
    ↓
Agent Loop
    ↓
Minimal Harness
    ↓
Coding Agent
    ↓
Pi-style Extensible Harness
    ↓
Code Runtime
    ↓
Persistent Runtime
    ↓
RLM
    ↓
Recursive Agent
    ↓
Continual Harness
    ↓
Self-Improving Agent
```

整个教程核心不是“堆功能”，而是不断回答：

```text
为什么要增加这一层？
旧架构出现了什么问题？
新的抽象解决了什么？
它又带来了什么新问题？
```

## 每一篇的统一结构

所有章节都按同一模板写作：

```text
01 · 上一版存在什么问题？
02 · 本篇解决什么问题？
03 · 先看最终效果
04 · 架构变化
05 · 核心抽象
06 · 实现代码
07 · 运行 Demo
08 · 新架构解决了什么？
09 · 它又引入了什么问题？
10 · 下一章
```

最关键的是第 9 条：**每一篇都故意留下一个架构矛盾**，由下一章解决，让文章天然串联。

## 状态说明

- 带 <span class="stage-badge">规划中</span> 标记的章节：正文待撰写，占位页只给出本章目标与验收清单。
- 正文完成后，对应 `<span class="tag-badge">Git Tag</span>` 会在该章标注。