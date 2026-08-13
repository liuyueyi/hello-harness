---
title: 关于本项目
---

# 关于本项目

## 为什么做这个项目

越来越强的模型让“给模型再加一个 Tool”不再是唯一答案。一个现代 Harness 需要逐步回答这些问题：

- 怎样从一次模型调用，构建可靠的 Agent Loop？
- 怎样把 Tool、Context、Session、Event 和 Permission 组织成一个可扩展的运行时？
- 当模型已经会写代码时，为什么不让它在受控 Runtime 中组合能力？
- 怎样把 Agent 从一条调用链，演进为可递归、可并发协作的 Agent Tree？
- 怎样让 Prompt、Skill、Memory 和 Agent 配置持续改进，同时保持版本化、可验证与可回滚？

`hello-harness` 将这些问题拆成小步、可运行的实现，而不是一开始就交付一个难以理解的大框架。

## 我们不是在做什么

- 不是“Pi 的简化版”——Pi 的某些思想（Minimal Core + Extension）会被学习，但目标不是复刻。
- 不是“Prime Agent 的教学复刻版”——Prime Agent 的思想（RLM、Recursive、Continual）会被拆解，但实现保持独立。
- 不是又一个黑盒 Agent Framework——核心保持小、透明、可跟读。

## 我们在做什么

> **Hello Harness —— 从 Agent Loop 到 Self-Improving Harness，亲手实现现代 Coding Agent 的核心架构。**

整个技术地图：

```text
Model
  ↓
Agent Loop
  ↓
Harness ── Context / Tools / Session / Events
  ↓
Pi-style Extensions / Skills / Permission
  ↓
Code Runtime / Context as Variable
  ↓
Recursive Subagents
  ↓
Memory / Skill / Prompt / Agent State
  ↓
Evaluation / Regression / Improvement Loop
```

## 毕业作品

| 阶段 | 最终产物 |
| --- | --- |
| Stage 0 · Hello LLM | CLI Chat |
| Stage 1 · Hello Agent | Tool Calling Agent |
| Stage 2 · Hello Harness | Minimal Agent Runtime |
| Stage 3 · Hello Coding Agent | Coding CLI |
| Stage 4 · Hello Pi | Extensible Coding Agent |
| Stage 5 · Hello RLM | Recursive Runtime Agent |
| Stage 6 · Hello Continual Harness | Persistent Self-Adapting Agent |
| Stage 7 · Hello Agent Lab | Evaluated Self-Improving Harness |

最终用户一路从：

```bash
hello "你好"
```

走到：

```bash
hello "分析项目、修复问题，并把可复用的方法沉淀成 Skill"
```

系统自行：观察项目 → 分析 → spawn 子 Agent → 修改代码 → 测试 → 总结经验 → 创建 Skill → 评估 Skill → 写入 Harness State。

## 架构边界

1. **Model 不知道 Agent**：只做 provider 无关的输入/输出与流式响应。
2. **Tool 不知道 Agent**：只处理 `input → environment → output`。
3. **Runtime 不绑定 Provider**：OpenAI / Anthropic / Gemini / Local 可随时切换。
4. **Continual Harness 不能随意修改 Core**：Agent 可以改 Prompt、Skill、Memory、Agent Config 与 Policy Proposal，但必须经过 `propose → validate → apply → version → rollback`。
