
<h1 align="center">Hello Harness</h1>

<p align="center"><strong>从 0 到 1 构建一个现代 Coding Agent Harness，并理解它如何从简单的 Tool Calling，逐步演进为 Runtime-oriented、Recursive、Continual 与 Self-Improving Harness。</strong></p>


> 不是教你调用某个 Agent Framework；而是亲手拆解一个现代 Agent Harness 怎样一步一步生长出来。

## 为什么做这个项目

越来越强的模型让“给模型再加一个 Tool”不再是唯一答案。一个现代 Harness 需要逐步回答这些问题：

- 怎样从一次模型调用，构建可靠的 Agent Loop？
- 怎样把 Tool、Context、Session、Event 和 Permission 组织成一个可扩展的运行时？
- 当模型已经会写代码时，为什么不让它在受控 Runtime 中组合能力？
- 怎样把 Agent 从一条调用链，演进为可递归、可并发协作的 Agent Tree？
- 怎样让 Prompt、Skill、Memory 和 Agent 配置持续改进，同时保持版本化、可验证与可回滚？

`hello-harness` 将这些问题拆成小步、可运行的实现，而不是一开始就交付一个难以理解的大框架。

## 演进路线

```text
Hello LLM
  → Hello Agent
  → Hello Harness
  → Hello Coding Agent
  → Hello Pi
  → Hello RLM
  → Hello Continual Harness
  → Hello Agent Lab
```

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

## 教程地图

| Stage | 主题 | 你将完成的成果 |
| --- | --- | --- |
| 0 | Hello LLM | CLI Chat：模型调用、消息、流式与 Provider 抽象 |
| 1 | Hello Agent | Tool Calling Agent：函数调用、Tool Result、Agent Loop |
| 2 | Hello Harness | Minimal Agent Runtime：Registry、Context、Step、Run、Event、错误与中断 |
| 3 | Hello Coding Agent | Coding CLI：读写编辑文件、Shell、Workspace、Session 与 Resume |
| 4 | Hello Pi | Extensible Coding Harness：Extension、Hook、Skill、Permission、Package、TUI |
| 5 | Hello RLM | RLM Harness：Code as Action、持久 Runtime、Context as Variable、递归与并行 Agent |
| 6 | Hello Continual Harness | Persistent Self-Adapting Agent：Memory、Skill Creator、Prompt 版本、Harness Mutation |
| 7 | Hello Agent Lab | Evaluated Self-Improving Harness：Task、Trajectory、Verifier、Reward、Regression、Optimizer |

完整章节顺序与每章的设计目标见 `plan/教程规划.md`，产品定位与长期架构思考见 `plan/产品路线.md`（`plan/` 不入库，只作为本地工程依据）。

## 文档站点

教程正文与项目文档统一放在 [`docs/`](docs/) 下，基于 VitePress 构建，并通过 GitHub Actions + GitHub Pages 自动发布。站点源码根为 `docs/`，教程章节位于 `docs/zh/tutorials/`。

```bash
pnpm docs:dev      # 本地预览
pnpm docs:build    # 构建（输出 docs/.vitepress/dist）
```

部署工作流见 [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)。

## 快速开始（开发本教程代码）

技术栈：TypeScript + Node.js + pnpm。需要 Node.js >= 22.9（`--env-file-if-exists` 依赖）。

```bash
pnpm install      # 安装依赖
pnpm dev          # 运行最小入口 src/index.ts
pnpm typecheck    # TypeScript 类型检查
```

环境变量约定：

1. 凭据只存在于 `.env`（已被 `.gitignore` 忽略），仓库中只保留 `.env.example` 作为模板。
2. 启动时由 `node --env-file-if-exists=.env` 自动加载，`.env` 不存在时程序照常运行（未配置的项会给出提示）。

```bash
cp .env.example .env   # 然后填入真实 Key
```

## 四次认知升级

1. `LLM = Chatbot` → `LLM + Loop + Tool = Agent`
2. `Agent = 一堆代码` → `Harness = Runtime System`
3. `LLM chooses tools` → `LLM programs capabilities`
4. `Developer improves agent` → `Agent proposes improvements`

## 架构原则

- Model 层不依赖 Agent；Tool 层不依赖 Agent。
- Runtime 不绑定任何单一模型 Provider。
- 核心代码保持小、透明、可跟读。
- 自我改进的对象是可版本化 Harness State，而不是不可控地修改 Core。
- 每一个改进都必须经过验证、评测和回归检查，并支持回滚。

## 教程如何使用

项目正处于初始化阶段。后续每一章会对应一份最小实现、一个可运行示例和一个 Git Tag。完成后你可以直接检出某个里程碑来阅读该章的最终状态：

```bash
git checkout v08-agent-loop
git checkout v40-pi-style
git checkout v56-rlm
git checkout v70-continual-harness
```

章节会持续围绕同一批任务演进，例如 Hello World、修复 failing test、实现功能、大型代码库分析、多模块协作和重复任务优化。这样可以看见 Harness 能力增长带来的真实差异，而非每章更换一个孤立 Demo。

## 当前状态

**Stage 0 · Hello LLM**

- ✅ **[00 · 项目初始化](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-0-hello-llm/00-project-setup)** 
  - —— 最小 TypeScript + pnpm 工程，`.env` 凭据约定 
  - —— 源码GitTag: `[v00-empty](https://github.com/liuyueyi/hello-harness/releases/tag/v00-init-repository)`
- ✅ **[01 · 第一次调用模型](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-0-hello-llm/01-first-model-call)** 
  - —— OpenAI 接口风格调用（`chat.completions` + `OPENAI_BASE_URL`，可切换服务商） 
  - —— 源码GitTag: `[v01-model](https://github.com/liuyueyi/hello-harness/releases/tag/v01-model)`
- ✅ **[02 · Messages](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-0-hello-llm/02-messages)** 
  - —— `messages.ts` 消息判别联合（system / user / assistant）与多轮上下文累积 
  - —— 源码GitTag: `[v02-messages](https://github.com/liuyueyi/hello-harness/releases/tag/v02-messages)`
- ✅ **[03 · Streaming](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-0-hello-llm/03-streaming)** 
  - —— `events.ts` 定义流式输出 `AsyncIterable<ModelEvent>`（content / usage），打字机式输出与首 token 延迟观测 
  - —— 源码GitTag: `[v03-stream](https://github.com/liuyueyi/hello-harness/releases/tag/v03-stream)`
- ✅ **[04 · Model Provider 抽象](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-0-hello-llm/04-provider-abstraction)** 
  - —— `src/model/` 长出 `interface Model`（generate / stream），OpenAI 实现与工厂，应用层与 SDK 解耦 
  - —— 源码GitTag: `[v04-provider](https://github.com/liuyueyi/hello-harness/releases/tag/v04-provider)`

**Stage 1 · Hello Agent**

- ✅ **[05 · Function Calling](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-1-hello-agent/05-function-calling)** 
  - —— 模型输出从文本变为结构化动作 `ToolCall`，`ModelRequest.tools` 声明能力，`ToolDefinition` 说明书 
  - —— 源码GitTag: `[v05-tool-call](https://github.com/liuyueyi/hello-harness/releases/tag/v05-tool-call)`
- ⏳ **06 · 第一个 Tool** —— 给 `get_weather` 补上实现，`interface Tool`（声明 + execute） —— 规划中


## 参与约定

开发与文档协作规则见 [AGENTS.md](AGENTS.md)。实现前请优先阅读 `plan/` 中的规划，避免在早期阶段引入后续教程的复杂度。

## 愿景

最终的 `Hello Harness` 应仍然是一个足够小的教育性核心，让读者能理解其中每一层：

```text
Task → Agent → Trajectory → Evaluation → Improvement Proposal
     → Validated Harness State → Next Run
```

目标不是让 Harness “看起来会自我进化”，而是让每一次改进都可观察、可验证、可回滚。
