---
title: 首页
layout: home

hero:
  name: Hello Harness
  text: 从 0 到 1 构建现代 Coding Agent Harness
  tagline: 从 Tool Calling 到 Extensible Coding Harness，亲手拆解一个现代 Agent Harness 怎样一步一步生长出来。
  actions:
    - theme: brand
      text: 开始阅读
      link: /zh/tutorials/
    - theme: alt
      text: 项目概览
      link: /zh/overview/
    - theme: alt
      text: GitHub
      link: https://github.com/liuyueyi/hello-harness
      target: _blank

features:
  - icon: 🧩
    title: 教程
    details: 5 个 Stage 已落地、40 篇章节，每章一个可检出的 Git Tag，从第一个模型调用写到 Extensible Coding Harness。
    link: /zh/tutorials/
  - icon: 🗺️
    title: 概览
    details: 项目定位、三代 Harness 演进路线与贯穿全程的真实案例。
    link: /zh/overview/
  - icon: 📚
    title: 资源
    details: 参考资料、术语约定与开发命令，可直接复制使用。
    link: /zh/resources/
---

## 演进路线

```mermaid
flowchart TD
    %% 主节点：白底，深色实线边框（重点突出演进阶段）
    classDef mainNode fill:#ffffff,stroke:#222222,stroke-width:1.5,rounded:10
    %% 注释节点：浅灰背景，灰色边框，弱化层级
    classDef noteNode fill:#f2f2f2,stroke:#707070,stroke-width:1.2,rounded:10
    %% 规划中‑主节点：白底，虚线边框
    classDef mainPlanned fill:#ffffff,stroke:#888888,stroke-width:1.5,stroke-dasharray:4 3,rounded:10
    %% 规划中‑注释节点：浅灰背景，虚线边框
    classDef notePlanned fill:#f2f2f2,stroke:#aaaaaa,stroke-width:1.2,stroke-dasharray:4 3,rounded:10

    A["Hello LLM"]:::mainNode -.->| | A_note["Model · Messages · Streaming"]:::noteNode
    B["Hello Agent"]:::mainNode -.->| | B_note["Tool Calling · Agent Loop"]:::noteNode
    C["Hello Harness"]:::mainNode -.->| | C_note["Runtime · Context · Step · Event"]:::noteNode
    D["Hello Coding Agent"]:::mainNode -.->| | D_note["FS · Shell · Workspace · Session"]:::noteNode
    E["Hello Pi"]:::mainNode -.->| | E_note["Extensions · Skills · Permission"]:::noteNode
    F["Hello RLM"]:::mainPlanned -.->| | F_note["Code Runtime · Context as Variable"]:::notePlanned
    G["Hello Continual Harness"]:::mainPlanned -.->| | G_note["Memory · Skill Creator · Mutation"]:::notePlanned
    H["Hello Agent Lab"]:::mainPlanned -.->| | H_note["Eval · Verifier · Regression"]:::notePlanned

    %% 主流程链路
    A --> B
    B --> C
    C --> D
    D --> E
    E -. 规划中 .-> F
    F -. 规划中 .-> G
    G -. 规划中 .-> H

    %% 主节点到注释的连接线弱化为浅灰色
    linkStyle 0,1,2,3,4,5,6,7 stroke:#cccccc,stroke-width:1
```

> Stage 0–4（40 篇）已落地；Stage 5–7 为规划中的长期演进路线，文中以虚线标注。

## 四次认知升级

<ul class="index-list">
  <li><code>LLM = Chatbot</code> → <code>LLM + Loop + Tool = Agent</code></li>
  <li><code>Agent = 一堆代码</code> → <code>Harness = Runtime System</code></li>
  <li><code>LLM chooses tools</code> → <code>LLM programs capabilities</code></li>
  <li><code>Developer improves agent</code> → <code>Agent proposes improvements</code></li>
</ul>

## 三个控制哲学

```text
Developer decides capabilities → Model chooses tools    （Tool-oriented）
Developer provides runtime     → Model programs capabilities （Runtime-oriented）
Developer provides boundaries  → Agent evolves harness   （Continual Harness）
```

## 教程如何使用

目前 Stage 0–4 已落地，每章对应一个 Git Tag。你可以直接检出该章节的最终状态来对照阅读：

```bash
git checkout v08-agent-loop
git checkout v40-pi-style
```

Stage 5–7 的 Tag（如 `v56-rlm`、`v70-continual-harness`）属于规划中的后续路线，正文撰写完成后会陆续补齐。

## 架构原则

- Model 层不依赖 Agent；Tool 层不依赖 Agent。
- Runtime 不绑定任何单一模型 Provider。
- 核心代码保持小、透明、可跟读（Core 目标 < 2000 LOC）。
- 自我改进的对象是可版本化 Harness State，而不是不可控地修改 Core。
- 每一个改进都必须经过验证、评测和回归检查，并支持回滚。

## 愿景

最终的 `Hello Harness` 应仍然是一个足够小的教育性核心，让读者能理解其中每一层：

```text
Task → Agent → Trajectory → Evaluation → Improvement Proposal
     → Validated Harness State → Next Run
```

目标不是让 Harness “看起来会自我进化”，而是让每一次改进都可观察、可验证、可回滚。
