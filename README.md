
<h1 align="center">Hello Harness</h1>

<p align="center"><strong>从 0 到 1 构建一个现代 Coding Agent Harness，并理解它如何从简单的 Tool Calling，逐步演进为 Runtime-oriented、Recursive、Continual 与 Self-Improving Harness。</strong></p>

![harness-cover.jpg](https://imgbed.ppai.top/file/1786792095982_harness-cover.jpg)

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
- ✅ **[06 · 第一个 Tool](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-1-hello-agent/06-first-tool)** 
  - —— `interface Tool`（声明 + execute）合体，实现 `calculator`，按名查表执行并守门（白名单 + 结果校验） 
  - —— 源码GitTag: `[v06-tool](https://github.com/liuyueyi/hello-harness/releases/tag/v06-tool)`
- ✅ **[07 · Tool Result](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-1-hello-agent/07-tool-result)** 
  - —— 建立完整循环：新增 `tool` 消息与带 `toolCalls` 的助手消息，执行结果回写历史再问一轮，输出最终 Answer 
  - —— 源码GitTag: `[v07-tool-result](https://github.com/liuyueyi/hello-harness/releases/tag/v07-tool-result)`
- ✅ **[08 · 第一个 Agent Loop](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-1-hello-agent/08-first-agent-loop)** 
  - —— `src/agent.ts` 的 `runAgent`：`while(true)` 循环，模型不停止调工具就不停，`maxIterations` 兜底，历史即可重放轨迹 
  - —— 源码GitTag: `[v08-agent-loop](https://github.com/liuyueyi/hello-harness/releases/tag/v08-agent-loop)`
- ✅ **[09 · Agent 的停止条件](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-1-hello-agent/09-stop-condition)** 
  - —— 停止协议 `RunStatus` + `StopReason`：`maxSteps` / `timeout` / `abort` / `finished` / `failed`，优雅收场保留历史，诊断报告（status + stopReason + error） 
  - —— 源码GitTag: `[v09-stop-condition](https://github.com/liuyueyi/hello-harness/releases/tag/v09-stop-condition)`

**Stage 1 · Hello Agent** 收官：你有了一个真正可停、可控的 Minimal Agent。下一步进入 **Stage 2 · Hello Harness**：

**Stage 2 · Hello Harness**

- ✅ **[10 · Tool Registry](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-2-hello-harness/10-tool-registry)** 
  - —— `ToolRegistry`（register / get / list / execute）统一注册与执行，引入 `ToolResult = ok:true/false` 标准脸，`runAgent` 改用 Registry 
  - —— 源码GitTag: `[v10-tool-registry](https://github.com/liuyueyi/hello-harness/releases/tag/v10-tool-registry)`
- ✅ **[11 · Context](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-2-hello-harness/11-context)** 
  - —— 裸 `Message[]` 升级为 `AgentContext`（add / snapshot / restore / 防御性拷贝），立住「Context 是 Agent 当前可见世界」
  - —— 源码GitTag: `[v11-context](https://github.com/liuyueyi/hello-harness/releases/tag/v11-context)`
- ✅ **[12 · Agent Runtime](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-2-hello-harness/12-agent-runtime)** 
  - —— `runAgent()` 退役，升级为 `AgentRuntime` 类（依赖注入 Model/Context/ToolRegistry），构造一次多次 run，任务间互不串门
  - —— 源码GitTag: `[v12-runtime](https://github.com/liuyueyi/hello-harness/releases/tag/v12-runtime)`
- ✅ **[13 · Agent Step](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-2-hello-harness/13-agent-step)** 
  - —— 给循环每一步命名：`AgentStep`（Model/Tool/Finish/Error），Runtime「跑一步记一步」，成为 Trace/Replay/UI/Eval 的地基
  - —— 源码GitTag: `[v13-step](https://github.com/liuyueyi/hello-harness/releases/tag/v13-step)`
- ✅ **[14 · Run](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-2-hello-harness/14-run)** 
  - —— `AgentResult` 升级为 `AgentRun`（id/input/steps/status/answer/时间戳），一次运行=一份可引用可审计的档案
  - —— 源码GitTag: `[v14-run](https://github.com/liuyueyi/hello-harness/releases/tag/v14-run)`
- ✅ **[15 · Event System](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-2-hello-harness/15-event-system)** 
  - —— `AgentEvent` 广播 + 类型安全 `AgentEventEmitter`（on/off/emit），`runtime.on('step'/'model:start'/'tool:end')`，Runtime 与 UI 解耦
  - —— 源码GitTag: `[v15-events](https://github.com/liuyueyi/hello-harness/releases/tag/v15-events)`
- ✅ **[16 · Error Model](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-2-hello-harness/16-error-model)** 
  - —— `HarnessError` 基类 + ModelError/ToolError/RuntimeError/ContextError/PermissionError（kind + retryable），`toHarnessError` 统一收编，工具错误也挂 kind/retryable，不再一律 throw
  - —— 源码GitTag: `[v16-errors](https://github.com/liuyueyi/hello-harness/releases/tag/v16-errors)`
- ✅ **[17 · Abort / Timeout / Retry](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-2-hello-harness/17-abort-timeout-retry)** 
  - —— `AbortController` 即时打断 + `withGuard` 单步护栏（模型/工具各自超时）+ `retryable` 指数退避重试（model:retry 事件），治好了「只能等一轮结束的取消」
  - —— 源码GitTag: `[v17-abort](https://github.com/liuyueyi/hello-harness/releases/tag/v17-abort)`
- ✅ **[18 · Hello Harness v1.0](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-2-hello-harness/18-hello-minimal-harness)** 
  - —— Runtime 支持流式模型调用（model:delta 逐字广播 + tool_call 增量拼装，AgentRun 聚合整轮 token 花销），`--chat` 流式多轮对话 CLI，8 类 Event 全量实时展示；`src/` 重构为 `model/ agent/ tools/ context/ events/ errors/ cli/` 分层目录，共约 1077 行
  - —— 源码GitTag: `[v18-minimal-harness](https://github.com/liuyueyi/hello-harness/releases/tag/v18-minimal-harness)`
- ✅ **[19 · Read Tool](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-3-hello-coding-agent/19-read-tool)** 
  - —— 给 Coding Agent 装上第一只手：`read` 工具绑定 workspace root，`resolve` + 包含判断挡下路径穿越（越界 `[permission]`），8000 字符文本截断保护上下文
  - —— 源码GitTag: `[v19-read](https://github.com/liuyueyi/hello-harness/releases/tag/v19-read)`

**Stage 4 · Hello Pi**

- ✅ **[29 · 为什么 Core 应该保持小](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-4-hello-pi/29-small-core)** 
  - —— 立住「Core ≠ 产品功能集合」：`src/` 重构出 `src/core/`（Model / Runtime / Context / Tool / Event / Session 六件套 + errors，按抽象分包，13 文件 / 约 683 行 / 零第三方依赖），`openai` 适配器移入 `src/providers/`，`core/index.ts` 唯一公共出口；demo 证明「只用 Core 也能跑」
  - —— 源码GitTag: `[v29-small-core](https://github.com/liuyueyi/hello-harness/releases/tag/v29-small-core)`
- ✅ **[30 · Extension API](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-4-hello-pi/30-extension-api)** 
  - —— 打开「能力入口」：`src/extensions/`（Extension = `name + setup(ctx)` + ExtensionRegistry 插座 + ExtensionContext 身份/观察口），扩展层只在 Core 之外、只依赖 Core；CLI 新增 `hello --extensions` 查看扩展清单
  - —— 源码GitTag: `[v30-extension](https://github.com/liuyueyi/hello-harness/releases/tag/v30-extension)`
- ✅ **[31 · Extension 注册 Tool](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-4-hello-pi/31-extension-register-tool)** 
  - —— 给 `ctx` 接上第一根线：`ctx.tools.register`；`hello-coding` 的 6 个工具（calculator/random/read/write/edit/bash）从 `createAgent` 迁入扩展，工具所有权移交、双注册表防线
  - —— 源码GitTag: `[v31-extension-tool](https://github.com/liuyueyi/hello-harness/releases/tag/v31-extension-tool)`
- ✅ **[32 · Extension 注册 Hook](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-4-hello-pi/32-extension-register-hook)** 
  - —— 让扩展「参与运行」：`src/core/hooks/` 长出 `HookManager` + 六类钩子（beforeRun/afterRun/beforeModel/afterModel/beforeTool/afterTool），`ctx.hooks.register` 注册、Runtime 节点触发，`beforeModel` 可改本次模型请求；events（旁观）与 hooks（参与）边界立住
  - —— 附 `trace-hook` 扩展 + CLI 开关 `--trace-hook` / `--no-trace-hook`：在 6 个 hook 节点打印运行轨迹（纯观察，默认关闭）
  - —— 源码GitTag: `[v32-hooks](https://github.com/liuyueyi/hello-harness/releases/tag/v32-hooks)`
- ✅ **[33 · Prompt Extension](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-4-hello-pi/33-prompt-extension)** 
  - —— 让提示词变成配置：`prompts/coding.md`、`review.md` 落成文件，`src/prompt/` 长出 `PromptLoader`（*.md → Prompt）+ `PromptRegistry`（register/get/list），`ctx.prompts` 第三个能力，CLI 的 system prompt 改为 `prompts.get("coding")`、写死常量降级为默认兜底，新增 `hello --prompts` 清单
  - —— 源码GitTag: `[v33-prompt-extension](https://github.com/liuyueyi/hello-harness/releases/tag/v33-prompt-extension)`
- ✅ **[34 · Skill](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-4-hello-pi/34-skill)** 
  - —— 立住「Skill 不是 Tool」：`src/skill/` 长出 `Skill = { name, description, content }` + `SkillRegistry`（register/get/list），`ctx.skills` 第四个能力；`.skills/refactor/SKILL.md`、`.skills/debugging/SKILL.md` 落成第一份技能文件（工具是手、技能是脑，技能不进 function calling）
  - —— 源码GitTag: `[v34-skill](https://github.com/liuyueyi/hello-harness/releases/tag/v34-skill)`
- ✅ **[35 · Skill Loader](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-4-hello-pi/35-skill-loader)** 
  - —— 让目录成为技能库，且对齐业界共识的 Agent Skills 开放标准：首次引入应用层第三方依赖 `yaml`，`parseFrontmatter` 用真 YAML 解析（多行/嵌套/数组），`SkillLoader` 按标准布局发现 `scripts/`/`references/`/`assets/` 并做 name（kebab-case）与 description（必填）校验；目录名是 canonical id；用 anthropics/skills 官方真实技能 `internal-comms`（Apache-2.0，fixture 在 examples/）验证加载器；`Skill` 类型更新为 `references?`/`assets?`；hello-coding 0.7.0 加载 `.skills/`，`--skills` 列出 scripts/references/assets 数量
  - —— 源码GitTag: `[v35-skill-loader](https://github.com/liuyueyi/hello-harness/releases/tag/v35-skill-loader)`
- ✅ **[36 · Skill Injection](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-4-hello-pi/36-skill-injection)** 
  - —— 把技能做成真实可用的 harness 能力（对齐 Agent Skills 渐进式披露）：上下文只注入 name+description 目录（`src/skill/inject.ts` 重写为 renderSkillCatalog/injectSkillCatalog，去掉玩具版启发式全文注入）；新增基础设施工具 `load_skill`（`src/tools/skill.ts`）按需加载正文与配套能力——返回 dir + scripts/references/assets 路径（bash 可跑脚本、read 可读资料），同一技能走缓存、最多同时加载 3 个（`MAX_SKILLS_LOADED`）、未知/超限结构化拒绝；`Skill` 增加 `dir`；hello-coding 0.8.0 注册第 7 个工具；CLI 组装 system prompt 注入目录并打印「可用技能」
  - —— 源码GitTag: `[v36-skill-injection](https://github.com/liuyueyi/hello-harness/releases/tag/v36-skill-injection)`
- ✅ **[37 · Permission Gate](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-4-hello-pi/37-permission-gate)** 
  - —— 给工具装上权限的缰绳：Core 新增最小机制 `src/core/permission/gate.ts`（PermissionDecision 三态 allow/deny/ask + PermissionPolicy + PermissionGate + 可注入 AskResolver，ask 无处理器时 fail-closed 拒绝）；`ToolRegistry.execute` 执行前过闸，拒绝以 kind=permission 结构化返回给模型；默认策略 `src/permission/policies.ts`（deny 危险命令 rm -rf 等 / deny 敏感文件 .env/.sessions/.git / 只读工具与只读 bash 命令（ls/dir/cd/node -v/git status 等）放行、其余 ask）；CLI 装配默认门并新增 --permissions / --auto-approve / --no-permissions，chat 复用自身 readline 做交互确认
  - —— 源码GitTag: `[v37-permission](https://github.com/liuyueyi/hello-harness/releases/tag/v37-permission)`
- ✅ **[38 · Package / Plugin](https://liuyueyi.github.io/hello-harness/zh/tutorials/stage-4-hello-pi/38-package-plugin)** 
  - —— 扩展开始独立发布：新增 `src/extensions/loader.ts`（PackageLoader：读 package.json 清单（校验 name/version/main）→ 解析入口（缺省 index.ts）→ 异步 import() → 调默认导出工厂 (workspace)=>Extension → 校验 name+setup，七处失败点均为结构化 RuntimeError）；新增独立扩展包 `packages/git`（@hello-harness/git：git_status/git_log/git_diff 只读工具，execFile 固定参数不拼接命令）与 `packages/web`（@hello-harness/web：fetch_url 工具仅 HTTP GET，协议白名单+超时+截断）；CLI 新增 --package <目录>（可重复）从磁盘加载并 install，权限门不信任新包（git/fetch_url 一律 ask，fail-closed）
  - —— 源码GitTag: `[v38-package](https://github.com/liuyueyi/hello-harness/releases/tag/v38-package)`


## 参与约定

开发与文档协作规则见 [AGENTS.md](AGENTS.md)。实现前请优先阅读 `plan/` 中的规划，避免在早期阶段引入后续教程的复杂度。

## 愿景

最终的 `Hello Harness` 应仍然是一个足够小的教育性核心，让读者能理解其中每一层：

```text
Task → Agent → Trajectory → Evaluation → Improvement Proposal
     → Validated Harness State → Next Run
```

目标不是让 Harness “看起来会自我进化”，而是让每一次改进都可观察、可验证、可回滚。
