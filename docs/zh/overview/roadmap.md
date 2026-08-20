---
title: 演进路线
---

# 演进路线

> 随着模型能力增强，Agent Harness 的架构应该怎样演进？

这是整个 `hello-harness` 教程在回答的核心问题。我们把答案组织成一条 **“三代 Harness 演进史”**：

```text
Generation 0 · Chat API
  ↓
Generation 1 · Tool-Calling Harness
  ↓
Generation 2 · Pi-style Minimal Harness
  ↓
Generation 3 · PrimeAgent-style RLM Harness
  ↓
Generation 4 · Continual / Self-Improving Harness
```

## 三个控制哲学

整个项目可以浓缩成三种“谁来决定能力”的控制哲学：

### 1. Tool-oriented：Model chooses tools

```text
Developer decides capabilities
        ↓
Model chooses tools
```

代表：普通 Function Calling Agent。

### 2. Runtime-oriented：Model programs capabilities

```text
Developer provides runtime
        ↓
Model programs capabilities
```

代表：PrimeAgent / RLM。模型面对的不再是一组设计好的 Tool Schema，而是一个可编程环境（如 persistent Python runtime），由模型自己组合 `fs`、`shell`、`search`、`skills`、`agents` 等能力。

### 3. Continual Harness：Agent evolves harness

```text
Developer provides boundaries
        ↓
Agent evolves harness
```

代表：Self-improving Agent。Harness 本身成为 Agent 可以修改的状态（Prompt、Skill、Memory、Agent Config），但必须版本化、可验证、可回滚。

一条更漂亮的成长曲线：

```text
Call tools
    ↓
Compose tools
    ↓
Create tools
    ↓
Create agents
    ↓
Improve harness
```

> 以下四处「反转」是 Stage 5–7（规划中）才会正面回答的问题；它们解释了为什么 Harness 不能停在 Stage 4。

## 两次关键“反转”

### 反转一：我们可能不需要这么多 Tool

前 20 篇（Stage 0–4）告诉用户 Tool Calling 非常重要。然后在 Stage 5 提出：

> 如果模型已经很会写代码，我们为什么还要给它几十个 JSON Tool？

从 `LLM → Tool` 变成 `LLM → Program → Tool`，即 **Code as Action**。

### 反转二：我们可能不应该替 Agent 管理所有 Context

前 35 篇强调 Context 管理。然后在 Stage 5 后半段提出：

> Context 不再是 Prompt，而是一种数据结构。

Context 本身成为模型能够操作的数据：`search`、`slice`、`filter`、`transform`、`summarize`、`delegate`。

### 反转三：为什么 Skill 一定要人写？

> Agent Generated Skill —— Agent 在任务中发现重复模式，自己创建 Skill。

### 反转四：如果 Agent 可以改进自己的 Harness 呢？

> Continual Harness —— 从 `Developer improves Agent` 到 `Agent proposes improvements`。

## Stage 划分

> Stage 0–4（40 篇）已落地；Stage 5–7 为规划中路线。

| Stage | 主题 | 章节 | 完成产物 | 状态 |
| --- | --- | --- | --- | --- |
| 0 | Hello LLM | 00–04 | CLI Chat | <span class="badge-done">已落地</span> |
| 1 | Hello Agent | 05–09 | Tool Calling Agent | <span class="badge-done">已落地</span> |
| 2 | Hello Harness | 10–18 | Minimal Agent Runtime | <span class="badge-done">已落地</span> |
| 3 | Hello Coding Agent | 19–28 | Coding CLI | <span class="badge-done">已落地</span> |
| 4 | Hello Pi | 29–40 | Extensible Coding Agent | <span class="badge-done">已落地</span> |
| 5 | Hello RLM | 41–56 | Recursive Runtime Agent | <span class="badge-planned">规划中</span> |
| 6 | Hello Continual Harness | 57–70 | Persistent Self-Adapting Agent | <span class="badge-planned">规划中</span> |
| 7 | Hello Agent Lab | 71–80 | Evaluated Self-Improving Harness | <span class="badge-planned">规划中</span> |

完整章节清单见 [教程地图](../tutorials/)，产品定位与长期架构思考的完整讨论见仓库内 `plan/产品路线.md`。
