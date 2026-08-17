---
title: "29 · 为什么 Core 应该保持小"
description: "提出架构原则：Core ≠ 产品功能集合。把 src/ 从「平铺」重构为「有边界的 Core」——Model / Runtime / Context / Tool / Event / Session 六个抽象住进 src/core/，其余能力留在外面，并演示「只用 Core 也能跑」。"
gitTag: "v29-small-core"
stage: 4
---

# 29 · 为什么 Core 应该保持小

> <span class="stage-badge">Stage Hello Pi</span> · <span class="tag-badge">v29-small-core</span>

第二十八章，我们让对话复活了——`hello --resume <会话id>` 一条命令接着昨天的任务干。Stage 3 的 Coding CLI 正式收官：**能进代码库、按章法干活、落盘续跑**。

但收官的那一刻，我盯着 `src/` 的目录结构，心里其实不太踏实。

它长这样：

```text
src/
  model/       # Model 抽象 + OpenAI 实现
  agent/       # AgentRuntime / AgentStep / AgentRun
  context/     # AgentContext
  events/      # 事件系统
  errors/      # 结构化错误
  tools/       # Tool 接口 + Registry + 6 件具体工具
  workspace/   # Workspace
  session/     # Session + SessionStore
  cli/         # 命令行入口
```

看上去整整齐齐，对吗？但仔细看，**这里面没有「核心」和「非核心」的区别**。`model/`、`agent/`、`tools/read.ts`、`cli/index.ts` 平起平坐，全都是 `src/` 下的一等公民。如果我现在问你三个问题：

1. 哪几个文件是「这个 Harness 的灵魂」，缺了它们 Agent 就不成立？
2. 哪几个文件是「可以替换、可以换实现」的皮肉？
3. 加一个新能力（比如 Skill、权限门）时，改哪个文件是安全的、改哪个文件要慎之又慎？

——恐怕我们答不上来。因为**代码里根本没有一条边界**。

这一章，我们要把这条边界画出来。这也是 Stage 4 的开篇：**先立原则，再动刀**。接下来进入正题。

<!-- more -->

## 一、上一版存在什么问题？

回顾 Stage 3 结束时平铺的 `src/`，问题其实已经非常具体了：

1. **没有「核心」这个概念的落点**：我们口口声声说 Core 要保持小，但 `src/` 里没有任何一层叫 Core——**「小核心」只是理念，代码里找不到它**；
2. **核心与能力混在一锅**：`model/model.ts`（抽象）和 `tools/read.ts`（具体能力）、`agent/runtime.ts`（循环）和 `cli/index.ts`（产品壳）平铺在同一层——**想替换一个实现，不知道动了骨架还是皮肉**；
3. **工具在指数膨胀**：从 `calculator` 到 `read/write/edit/bash`，每加一个能力就在 `src/tools/` 里多一个文件——**按这个趋势，几十个工具只是时间问题，平铺结构必然失控**；
4. **没有「安全改动区」**：加一个 Skill、一个权限门，改文件时永远要担心是不是会牵连到 Runtime——**边界缺席，风险无法局部化**；
5. **无法对账架构红线**：AGENTS.md 白纸黑字写着「Model 不知道 Agent」「Tool 不知道 Agent」「Runtime 不绑定 Provider」——**但没有物理目录把这条红线固定下来，全靠自觉**。

> 一句话：**上一版是「什么都住在一个平层里」——src/ 里有完整的 Harness，却没有「核心」和「功能」之分。能力越多，这个平层越危险。** 说白了，边界不是画出来的，是长出来的；而我们还没开始画。

## 二、本篇解决什么问题？

问题既已明确：平铺的 `src/` 无法回答「什么是核心、什么是能力」。那么这一章做四件事：

1. **立住架构原则：Core ≠ 产品功能集合**——Core 不是「把能想到的功能都塞进去的地方」，而是「一套最小、稳定、可扩展的骨架」；
2. **画出物理边界**：新增 `src/core/`，把 **Model / Runtime / Context / Tool / Event / Session** 六个抽象（外加错误基础设施）搬进去，其余能力留在外面；
3. **给 Core 一张「名片」**：新增 `src/core/index.ts` 作为唯一公共出口——外部只准从这张名片进入核心，核心内部用相对路径互相引用；
4. **证明「只用 Core 也能跑」**：写一个只 import `src/core` 的最小多轮 Agent——它不吃任何 `read/write/edit/bash`、不用 Workspace、不用 CLI，但 Model / Runtime / Context / Tool / Event / Session 六件套一应俱全，照样把两轮对话跑完。

核心心智模型：

> **Core 是一棵树的树干，功能是枝桠。树干只负责「撑住整个结构」，枝桠负责「开花结果」；树干要的是「稳」，枝桠要的是「多」。**

解决完上面四件事，把线串一下：**上一版「没有核心边界、能力无处安放」这些遗留问题 → 这一章用「Core 与功能物理分层」解决 → 接下来看一棵干净的小树干，怎么挂上第一根枝桠（Extension）。**

### 解决之后，我们收获了什么？

- **边界肉眼可见**：`src/core/` 里躺着的是什么、外面是什么，打开目录一眼便知；
- **六个抽象独立可替换**：换 Model 实现、换事件实现，只动 Core 内部，外面零感知；
- **Core 可被数出来**：13 个文件、约 683 行、零第三方依赖，占整个 `src/` 约四成——**「小核心」从口号变成可验证的数字**；
- **能力有了安全生长区**：接下来 Stage 4 的 Extension / Skill / Permission / TUI 全部长在 Core 之外——**「改能力」不再动到「骨架」**；
- **红线落地**：AGENTS.md 的架构边界第一次有了物理载体。

> 一句话收个尾：遗留的「没有边界、能力与骨架混住」问题被这一章的 `src/core/` 解决掉，换来的则是「**核心保持小而稳，一切能力都能在核心之外生长**」——Pi 最值钱的思想，从这一行开始落地。

## 三、先看最终效果

先跑起来看效果。这一步不需要任何 API Key，`examples/stage-4/29-small-core/demo.mts` 是一个纯本地的演示：

```bash
$ node --import tsx examples/stage-4/29-small-core/demo.mts
```

输出分两段。

**第一段：Core 边界报告**——数出 `src/` 里哪些文件属于核心、各占多少行（实测结果）：

```text
=== Core 边界报告（src/ 的文件数与行数） ===
Core（src/core/，共 13 个文件，683 行）：
  context/context.ts       29 行
  errors/errors.ts         59 行
  events/events.ts         39 行
  index.ts                 32 行
  model/messages.ts        43 行
  model/model.ts           10 行
  model/types.ts           30 行
  runtime/run.ts           24 行
  runtime/runtime.ts      304 行
  runtime/step.ts          32 行
  session/session.ts       35 行
  tool/registry.ts         36 行
  tool/tool.ts             10 行
Core 之外（共 12 个文件，1001 行）：
  cli/chat.ts
  cli/index.ts
  cli/render.ts
  providers/openai.ts
  session/store.ts
  tools/bash.ts
  tools/calculator.ts
  tools/edit.ts
  tools/random.ts
  tools/read.ts
  tools/write.ts
  workspace/workspace.ts

Core 占比：约 41%（683 / 1684 行）
Core 第三方依赖：无（只 import node 内置模块与 core 内部文件）
```

注意几个信息：整个 `src/` 一共 25 个文件、1684 行，其中核心占 13 个文件、683 行、约 41%——**核心不是「最大的那块」，而是「最小却顶得住的那块」**。更关键的是最后一行：**Core 没有任何第三方依赖**——它不 import 任何 npm 包，唯一的跨包引用是 node 内置模块。想换掉 Provider、工具、CLI，Core 纹丝不动。

**第二段：只用 Core 跑一个多轮 Agent**——`double` 工具是当场写在 demo 里的，模型是假的，但循环、上下文、会话、事件全是真家伙：

```text
=== 只用 Core（Model · Runtime · Context · Tool · Event · Session）跑一个多轮 Agent ===
  [model ] 调用工具：double
  [tool  ] double({"n":21}) = 42
  [model ] 调用工具：（无，直接回答）
  [finish] finished
  turn1 : completed (finished) · 答案「21 翻倍等于 42」 · 4 步
  [model ] 调用工具：double
  [tool  ] double({"n":42}) = 84
  [model ] 调用工具：（无，直接回答）
  [finish] finished
  turn2 : completed (finished) · 答案「42 再翻倍等于 84」 · 4 步

  注意：这个循环只用到了 src/core 的 6 个抽象 ——
  Model · Runtime · Context · Tool · Event · Session
  没有任何 read/write/edit/bash、Workspace、CLI 参与，也能完整跑通两轮对话。
```

> 这就是这一章的核心证据：**Core 不是一个「概念」，而是一套能独立跑通的骨架。** 它能单独跑，是因为它真的只依赖自己；它值得单独住一个目录，是因为别的能力都不需要住进去。

## 四、架构变化

这一章的架构变化只有一句话：**把 `src/` 从「平铺」改成「核心 + 外圈」**。

**之前**（Stage 3 收官状态）：

```text
src/
  model/       agent/      context/     events/      errors/
  tools/       workspace/  session/     cli/
```

**之后**（本章）：

```text
src/
  core/                  ← 新增：核心边界，按抽象分包，零第三方依赖
    index.ts             ← Core 的「名片」：唯一公共出口
    model/               ← Model：model.ts + types.ts + messages.ts（ch02-04）
    runtime/             ← Runtime：runtime.ts + run.ts + step.ts（ch12-17）
    context/             ← Context：context.ts（ch11）
    tool/                ← Tool：tool.ts + registry.ts（ch06/10）
    events/              ← Event：events.ts（ch15）
    session/             ← Session：session.ts（ch26）
    errors/              ← 错误基础设施：errors.ts（ch16）
  providers/             ← 新增：Model 的具体 Provider 实现（openai.ts）
  tools/                 ← 具体能力：read/write/edit/bash/calculator/random
  workspace/             ← 环境抽象：Workspace
  session/               ← 持久化：SessionStore（store 留在外面）
  cli/                   ← 产品壳
```

归属表看得更清楚——**每个目录为什么住在 Core 里 / 为什么住在外面**：

| 目录 / 文件 | 归属 | 一句话理由 |
| --- | --- | --- |
| `core/model/model.ts` | **Core** | `Model` 接口：与 Provider 无关的抽象（ch04），几乎不变 |
| `core/model/types.ts` | Core | `ModelRequest / Response / ToolCall` 等跨层共享类型 |
| `core/model/messages.ts` | Core | `Message` 判别联合（ch02），所有层都在用它 |
| `core/runtime/runtime.ts` | **Core** | `AgentRuntime`：一次任务怎么跑（ch12-17），Harness 的心脏 |
| `core/runtime/run.ts` / `step.ts` | Core | `AgentRun` / `AgentStep`：运行与步骤的类型契约 |
| `core/context/context.ts` | **Core** | `AgentContext`：Agent 当前可见世界（ch11） |
| `core/tool/tool.ts` | **Core** | `Tool` 接口：能力的统一契约（ch06/10） |
| `core/tool/registry.ts` | Core | `ToolRegistry`：工具的登记与执行（ch10） |
| `core/events/events.ts` | **Core** | `AgentEvent` / `AgentEventEmitter`：每一步都可观察（ch15） |
| `core/session/session.ts` | **Core** | `Session`：一次会话的状态（ch26） |
| `core/errors/errors.ts` | Core | `HarnessError` 体系（ch16）：**基础设施，不是产品功能** |
| `providers/openai.ts` | **外圈** | `OpenAIModel` + 工厂：**Model 的具体实现**，绑定 OpenAI SDK 与 `.env` |
| `tools/*.ts` | 外圈 | 具体工具：read / write / edit / bash——**可替换的能力** |
| `workspace/` | 外圈 | Workspace：面向具体文件系统的环境抽象 |
| `session/store.ts` | 外圈 | SessionStore：`.sessions/` 落盘与读取——**持久化实现** |
| `cli/` | 外圈 | 命令行入口、渲染、chat 循环——**产品壳** |

**关键点有两个**：

1. **`agent/`、`model/`、`context/`、`events/`、`errors/` 这些目录名从此退出历史舞台**——它们的文件没有改名、没有改逻辑，只是**搬进 `core/` 下的分包住下了**。每个抽象一个子目录，镜像着未来 `packages/core/{model,runtime,context,events,session}` 的目标形态；
2. **`openai.ts` 没有搬进 `core/`，而是去了 `providers/`**——它不符合「进出 Core 的三条标准」里的第三条（不是具体实现），所以它住在核心之外，用 `core/model/model.ts` 的接口依赖核心，而不是被核心依赖。

> 注意 `session/store.ts` 的去向：`Session`（状态）是核心，`SessionStore`（怎么把状态存到磁盘）是**实现**——一个跟文件系统、目录结构、JSON 格式耦合的实现（后续可能扩展为持久化到DB、远程服务上），因此没有资格住在核心。

## 五、核心抽象

这一章的「核心抽象」就是问题本身：**哪些东西有资格住进 Core？** 我们给出答案——**六件套 + 一条原则**。

### 六件套：Core 只留这六个抽象

```text
Model      # 与 Provider 无关的模型抽象
Runtime    # 一次任务怎么跑
Context    # Agent 当前可见世界
Tool       # 能力的统一契约
Event      # 每一步都被观察
Session    # 一次会话的状态
```

每一件都对应一个「几乎不会变」的问题：**模型怎么调、任务怎么跑、世界怎么看、能力怎么定、过程怎么观、对话怎么续**。这些问题问过一遍之后，答案基本不会变——这就是它们住在 Core 里的资格。

### 一条补丁：errors 为什么也住进去

规划里写的是「六件套」，但 `core/` 里多了一个 `errors/`。这不是违约，是诚实：

> **Core ≠ 产品功能集合，但 Core 也不等于「只准有六个目录」。** `errors.ts` 不是功能，是**基础设施**——所有核心抽象（Runtime 抛错、Tool 返回失败、Session 恢复）都要引用 `ErrorKind` / `HarnessError`。基础设施属于骨架的一部分，所以它住进 Core，理由和六件套一样：**它几乎不变，且被所有人依赖**。

### 一条例外：Provider 不住进来

再看一眼边界报告的最后一行——**Core 没有任何第三方依赖**。这靠的不是自觉，而是 `openai.ts` 的搬离：

> **`Model` 接口是抽象，住在 Core；`OpenAIModel` 是某个厂商的具体实现，住在 `providers/`。** 实现要 import `openai` SDK、要读 `.env`、要把消息翻译成 OpenAI 的线格式——这些全是「具体实现」的活，和六件套的资格（几乎不变、跨能力通用、不是实现）格格不入。所以它依赖核心（import `Model` 接口），而不是被核心依赖。

### 一张「名片」：`core/index.ts`

Core 的公共出口只有一条：

```ts
// 外部（cli、providers、tools、examples）只允许从这里进入 Core
import {
  AgentRuntime, ToolRegistry, AgentContext, Session,
  systemMessage, userMessage, ...
} from "./core";
```

规则很简单，两条：

1. **外部只准 import `core/index.ts`**——它是 Core 的「脸」，想看 Core 有什么，看这一张表就够了；
2. **Core 内部用相对路径互相引用**——`runtime/runtime.ts` 直接 `import { AgentContext } from "../context/context"`，不走 index（避免循环依赖，也让「谁依赖谁」一目了然）。

### 进出 Core 的三条标准

今后想往 Core 里塞东西（或把东西踢出去），对着这三条标准自问一遍：

| 标准 | 通过才可进 Core |
| --- | --- |
| **几乎不变** | 这个抽象是不是经历了多章考验、极少改动？ |
| **跨能力通用** | 是不是所有能力（工具、Skill、权限……）都依赖它？ |
| **不是具体实现** | 它是不是只描述「契约」，而不绑定文件系统、磁盘、某个 Provider？ |

三条全过 → 住进 Core；任何一条不过 → 留在外圈。`openai.ts` 就是被第三条标准请出去的——**标准是死的，边界是活的**。这正是 Pi 的精神：

> **small core，everything else optional。**

## 六、实现代码

先交代一句大实话：**这一章几乎没有「新代码」，只有「搬家 + 立界碑」。** 我们不会新发明任何逻辑——把文件挪进 `src/core/`，改一行行 import 路径，加一张 `index.ts` 名片，完事。这正是「重构」最朴素的样子：**行为不变，结构变了**。

### 搬移对照表：旧路径 → 新路径

| 旧路径 | 新路径 |
| --- | --- |
| `src/model/model.ts` | `src/core/model/model.ts` |
| `src/model/types.ts` | `src/core/model/types.ts` |
| `src/model/messages.ts` | `src/core/model/messages.ts` |
| `src/model/openai.ts` | `src/providers/openai.ts` ← **搬出 Core** |
| `src/agent/runtime.ts` | `src/core/runtime/runtime.ts` |
| `src/agent/run.ts` | `src/core/runtime/run.ts` |
| `src/agent/step.ts` | `src/core/runtime/step.ts` |
| `src/context/context.ts` | `src/core/context/context.ts` |
| `src/tools/tool.ts` | `src/core/tool/tool.ts` |
| `src/tools/registry.ts` | `src/core/tool/registry.ts` |
| `src/events/events.ts` | `src/core/events/events.ts` |
| `src/session/session.ts` | `src/core/session/session.ts` |
| `src/errors/errors.ts` | `src/core/errors/errors.ts` |

每个文件里的逻辑一行没改，改的只是「import 从哪个目录找邻居」：

```ts
// core/runtime/runtime.ts 之前
import { AgentContext } from "../context/context";
import { AgentEventEmitter } from "../events/events";
import { ToolRegistry } from "../tools/registry";

// core/runtime/runtime.ts 之后 —— 邻居都住进 core 的对应分包
import { AgentContext } from "../context/context";
import { AgentEventEmitter } from "../events/events";
import { ToolRegistry } from "../tool/registry";
```

而 Core 之外的文件，import 从「指向具体目录」改为「指向 Core 的分包」，Provider 从 `providers/` 拿：

```ts
// cli/index.ts 之前
import { AgentRuntime } from "../agent/runtime";
import { ToolRegistry } from "../tools/registry";
import { createOpenAIModel } from "../model/openai";
import { systemMessage, userMessage } from "../model/messages";

// cli/index.ts 之后 —— 核心的从 core 分包拿，Provider 从 providers 拿，具体工具仍从 tools 拿
import { AgentRuntime } from "../core/runtime/runtime";
import { ToolRegistry } from "../core/tool/registry";
import { createOpenAIModel } from "../providers/openai";
import { systemMessage, userMessage } from "../core/model/messages";
import { calculator } from "../tools/calculator";       // 具体工具，仍从 tools 拿
import { createBashTool } from "../tools/bash";         // 具体工具，仍从 tools 拿
```

### 新文件只有两个：`core/index.ts` 和 demo

真正「新增」的代码只有一个半。第一个是 Core 的名片 `src/core/index.ts`（完整片段）：

```ts
export type { Model } from "./model/model";
export type { ModelRequest, ModelResponse, ModelEvent, ToolDefinition, ToolCall } from "./model/types";
export type { Role, Message, SystemMessage, UserMessage, AssistantMessage, ToolMessage } from "./model/messages";
export { systemMessage, userMessage, assistantMessage, toolMessage } from "./model/messages";

export { AgentRuntime, withGuard } from "./runtime/runtime";
export type { AgentRuntimeOptions } from "./runtime/runtime";
export type { AgentRun, RunStatus, StopReason } from "./runtime/run";
export type { AgentStep, ModelStep, ToolStep, FinishStep, ErrorStep } from "./runtime/step";

export { AgentContext } from "./context/context";
export type { ContextSnapshot } from "./context/context";

export type { Tool, ToolResult } from "./tool/tool";
export { ToolRegistry } from "./tool/registry";

export type { AgentEvent, AgentEventListener } from "./events/events";
export { AgentEventEmitter } from "./events/events";

export { Session } from "./session/session";
export type { SessionSnapshot } from "./session/session";

export type { ErrorKind, HarnessError } from "./errors/errors";
export {
  ModelError, ToolError, RuntimeError, ContextError, PermissionError,
  toHarnessError, errorMessage,
} from "./errors/errors";
```

第二个就是演示脚本 `examples/stage-4/29-small-core/demo.mts`——它只 import 了 `src/core`，一个 `double` 工具当场定义，一个假模型按剧本回答，然后 `Session.turn()` 跑两轮：

```ts
import {
  AgentRuntime, Session, ToolRegistry, systemMessage,
  type Model, type ModelResponse, type Tool, type ToolResult,
} from "../../../src/core";
// ↑ 全部来自 src/core：这就是「只用 Core 也能跑」的字面证明

const registry = new ToolRegistry();
registry.register(double);                    // Tool：当场定义的能力

const runtime = new AgentRuntime(model, registry, { maxSteps: 5 });  // Runtime + Event（on 订阅）
runtime.on("step", (e) => { /* 打印每一步 */ });

const session = new Session(undefined, [systemMessage("你是一个最小 Agent。")]);  // Session
const run1 = await session.turn(runtime, "21 翻倍是多少？");                        // Context 随会话延续
const run2 = await session.turn(runtime, "那再把结果翻倍一次呢？");                  // 第二轮
```

**重点**：这个 demo 里没有任何 `read/write/edit/bash`、没有任何 `Workspace`、没有任何 `CLI`——它证明的是「**Core 自足**」：六个抽象凑在一起，已经是一个能转的 Agent。外面的东西不是「骨架的一部分」，而是「可选的皮肉」。

> **为什么要这样设计？** 因为「核心」这个词只有在「没有它也能自证」时才是真的。如果 Core 离开 CLI 和工具就转不起来，那 Core 就不是核心，只是「一个大目录」。`index.ts` 加上这个 demo，让 Core 的边界既看得见、又跑得动。

## 七、运行 Demo

**跑法一：边界报告 + 核心自足演示（本章的主角，无需 API Key）**：

```bash
$ node --import tsx examples/stage-4/29-small-core/demo.mts
```

会依次输出第三节那两段内容——先是 `Core 边界报告`（13 个文件 / 683 行 / 占比 41% / 无第三方依赖），再是 `只用 Core 跑一个多轮 Agent`（两轮对话，每轮 4 步）。

**跑法二：类型检查，证明搬家的行为没有破坏任何东西**：

```bash
$ pnpm typecheck
```

零报错，说明这次搬家只是「换了门牌号」，所有 import 都指向了正确的新地址。

**跑法三：老姿势全保留——CLI 一条都不破**（需要 `.env` 里的真实 Key）：

```bash
$ pnpm dev -- "帮我修复这个项目"
$ pnpm dev -- --chat
$ pnpm dev -- --resume <会话id>
```

核心搬了家，产品壳丝毫未动——`hello` 还是那个 `hello`。

> 复测验证的小伙伴，重点观察以下关键证据：

| 观察点 | 期望 | 实测 |
| --- | --- | --- |
| Core 边界报告 | 打印 `src/core/` 的文件数与行数 | `13 个文件，683 行` ✓ |
| Core 占比 | 不到一半 | `约 41%（683 / 1684 行）` ✓ |
| Core 第三方依赖 | 无（只 import node 内置模块与 core 内部） | `Core 第三方依赖：无` ✓ |
| 核心自足 | 只用 `src/core` 的 import 跑通两轮对话 | `turn1` / `turn2` 均 `completed (finished)` ✓ |
| 上下文延续 | 第二轮记得第一轮的答案 | 第二轮直接 `double({"n":42})` ✓ |
| 老 CLI 不破 | `pnpm typecheck` 零报错 | ✓ |

## 八、新架构解决了什么？

- **边界从「理念」变成「目录」**：`src/core/` 就是边界——**六件套按抽象分包住里面，能力住外面，一眼可辨**；
- **六个抽象独立可替换**：换 Model 实现、换事件实现，只动 Core 内部——**外面引用的是接口，不是实现**；
- **「小核心」从口号变成数字**：13 个文件、约 683 行、占比 41%、**零第三方依赖**——**下次有人说「Core 好大」，把这份报告拍在他面前**；
- **能力有了安全生长区**：Skill、权限、TUI 从下一章起全部长在 Core 之外——**「加能力」不再动「骨架」，风险被局部化**；
- **红线第一次有了物理载体**：AGENTS.md 的「Model 不知道 Agent / Tool 不知道 Agent / Runtime 不绑定 Provider」第一次对应到真实的目录关系——`Model` 接口在 Core、Provider 在 `providers/`，**Runtime 不 import 任何 SDK**；
- **依赖方向单一**：`model/messages` 是叶子，`tool`、`context`、`events` 依赖它，`runtime` 把所有人汇聚在一起——**core 内部只存在一条「由叶子指向汇聚点」的依赖流，没有反向依赖**；
- **核心自足被证明**：demo 证明离开所有具体工具、Provider 和 CLI，Core 自己就能转——**它是树干，不是仓库**。

## 九、它又引入了什么问题？

泼盆冷水，看看这条边界还留了哪些坑：

1. **`providers/` 只有一个实现，还没有正式契约**：OpenAI 适配器被请出了 Core，但 `providers/` 现在孤零零一个文件——**「约定 Model 接口」和「正式 provider adapter 契约」是两回事**，等 Anthropic / 本地模型进来，需要一个更结构化的协议，ch38 Package 时再议；
2. **边界是「习惯法」不是「强制法」**：任何人都可以 `import "../core/errors/errors"` 或者从 Core 外的文件互相 import——**我们没有工具强制边界，只能靠 code review 和自觉**；
3. **`errors` 到底算不算核心**：规划写「六件套」，实际多了一个 `errors/`——**「六个」和「七个」的争议说明标准本身也有灰度**，需要后续章节不断校准；
4. **`src/` 依然是「一个仓库里的平铺」**：Core 只是其中一个子目录，`tools/`、`workspace/`、`cli/` 还在同一个包内——**真正的包级拆分（`hello-harness-core` / `-coding` / `-cli`）要等 ch40**；
5. **`index.ts` 有变成「垃圾场」的风险**：什么方便就从 `core/index.ts` 导什么，**天长日久 Core 的「脸」会越变越胖**——这要求我们严格遵守「进出 Core 的三条标准」；
6. **还没有任何「在 Core 之外生长能力」的机制**：边界画好了，但**外面怎么挂新能力**（Extension）还是一片空白——这正是下一章的活。

## 十、下一章

边界画好了，接下来自然要问：**能力怎么在 Core 之外生长？** 如果「加一个工具就要改 `src/cli/index.ts`」，那 Core 再小也没用——因为它没把「可扩展」变成机制。

下一章，我们正式设计 **Extension API**：一个 `name + setup(ctx)` 的极简接口，让工具、Hook、提示词、Skill 都能以「扩展」的形态插到 Core 外面——Pi 思想的第二块拼图：**Minimal Core + Extension First**。

> **Core 保持小，不是因为它没能力，而是因为能力都长在外面。这一章立了边界，下一章开一个口子。**

欢迎点赞、关注公众号「一灰灰Blog」 我们下章见

---

微信公众号: 一灰灰Blog
