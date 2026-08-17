---
title: "32 · Extension 注册 Hook"
description: "让 ctx 再长大一个能力：ctx.hooks。六类钩子（beforeRun/afterRun/beforeModel/afterModel/beforeTool/afterTool）由扩展注册、在 AgentRuntime 的运行节点触发，扩展从「提供能力」进化到「参与运行」。"
gitTag: "v32-hooks"
stage: 4
---

# 32 · Extension 注册 Hook

> <span class="stage-badge">Stage Hello Pi</span> · <span class="tag-badge">v32-hooks</span>

第三十一章，我们把六个工具搬出了门——`ctx.tools` 让`extension`能「往 harness 里塞能力」。`hello-coding` 从空壳变成了真身，`createAgent` 瘦成一行 `install`。

但收工的时候，又萌生了一个新的想法：

> **工具能「挂上去」，可挂上去之后呢？** `extension`此刻是「一次性的」——安装时布置完，运行时就只能袖手旁观。模型调了几次、工具跑了多久、结果对不对，**`extension`完全插不上手**。而一个真正的 Coding Agent，需要的东西恰恰是「在关键时刻插一手」：模型调用前注入点约束、工具执行后检查下结果、整轮运行完记一笔账。

这一章，我们让 `ctx` 再长大一个能力：**`ctx.hooks`**。注册 `beforeRun` / `afterRun` / `beforeModel` / `afterModel` / `beforeTool` / `afterTool` 六类钩子，让`extension`从「提供能力」进化到「**参与运行**」。接下来进入正题。

## 一、上一版存在什么问题？

一般来讲，能挂东西上去只是第一步，挂上去之后能不能「管得着」才是关键。ch31 让`extension`能塞工具，但`extension`对「运行」仍然一无所知：

1. **`extension`只能「提供」，不能「参与」**：装完工具，runtime 跑的时候`extension`没有发言权——**不能看、不能改、不能拦**，只能等下一轮安装时再布置；
2. **观察点全在「旁观者」手里**：ch15 的事件系统是**事后广播**——`emit` 完就散了，订户（如 CLI）只能看。想在「模型调用之前」注入点什么、「工具执行之后」检查点什么，事件系统做不到；
3. **没有「事中协作」的位置**：可观察（events）解决的是「看到」，不解决「干预」——而未来的 Permission Gate（ch37）那种「跑之前拦一道」、Skill 注入（ch36）那种「跑之前塞知识」，都需要一个**运行中可插手**的机制。

> 一句话：**`extension`能往 harness 里塞东西，但在 harness 运行中插不上手。** 而「参与运行」，才是一个`extension`真正的价值。说白了就是装上去就甩手，能干的事太少了 😂

## 二、本篇解决什么问题？

那么问题来了：既然`extension`装完工具就只能干看着，那怎么让它「在运行中插一手」？接下来看下这一章的具体解决姿势，一共四件事：

1. **`ctx` 再长大一个能力 `hooks`**：`extension`在 `setup` 里写 `ctx.hooks.register(name, handler)`——**在 6 个运行节点各挂一个钩子**；
2. **六类钩子落地**：`beforeRun` / `afterRun` / `beforeModel` / `afterModel` / `beforeTool` / `afterTool`，覆盖「一轮运行」「一次模型调用」「一次工具调用」三个粒度；
3. **Runtime 集成**：`AgentRuntime` 在这 6 个节点调用 `hooks.run(...)`——**钩子由`extension`注册，由核心执行**；
4. **让钩子「能做事」**：`beforeModel` 可以**改**发给模型的请求（演示：注入一条系统消息），`afterModel` / `afterTool` 可以**看**返回与结果——不是摆设，是真干预。

核心心智模型：

> **events 是「事后广播」，讲给旁观者听；hooks 是「事中参与」，做给协作者用。** 事件回答「发生了什么」，钩子回答「现在，我可以做点什么」。

这一章把线串一下：**上一版「`extension`只能提供、不能参与、运行中没有位置」这些遗留问题 → 这一章用「ctx.hooks 六类钩子」解决 → 接下来看一个`extension`怎么在运行的真实时序里逐节点插手。**

## 三、先看最终效果

先跑 demo（无需 API Key，下面是标准的使用姿势）：

```bash
$ node --import tsx examples/stage-4/32-extension-register-hook/demo.mts
```

输出结果如下：

```text
=== 32 · Extension 注册 Hook：在运行中插手 ===

=== 1. 定义扩展：setup 里用 ctx.hooks.register ===

=== 2. 安装 + 跑一个会调用工具的 Agent ===
install(hello-trace) 完成（hooks 已接进 runtime）
[ext:hello-trace] beforeRun   run 开始 · 输入「21 翻倍是多少？」
[ext:hello-trace] beforeModel 注入系统消息，请求现有 2 条消息
[ext:hello-trace] afterModel  模型返回 1 个工具调用
[ext:hello-trace] beforeTool  即将执行 double
[ext:hello-trace] afterTool   double → ok=true
[ext:hello-trace] beforeModel 注入系统消息，请求现有 4 条消息
[ext:hello-trace] afterModel  模型返回 0 个工具调用
[ext:hello-trace] afterRun    run 结束 · completed / finished
run 结果：completed / finished · 答案「21 翻倍等于 42」

=== 3. 没有 hooks 的 runtime 依然照常跑 ===
run 结果：completed / finished · 答案「21 翻倍等于 42」
```

注意三个信息（**重点关注**这三点）：

1. **六类钩子全部按序触发**：一轮 run 里 `beforeRun → beforeModel → afterModel → beforeTool → afterTool → (again) → afterRun`——**钩子挂在了运行的真实时序上**；
2. **钩子能动手**：`beforeModel` 往请求里注入了一条系统消息，请求消息数从 2 涨到 4——**钩子不是监听器，是参与者**；
3. **钩子是「可选的」**：第三段，同一个 `ToolRegistry`、同一个假模型，不传 hooks 的 runtime 照常跑完——**没有钩子，run 不受任何影响**。

> 这就是这一章的兑现：**`extension`第一次能在 harness 运行中插上手。** 「`extension`」从「装上去就完事」变成「运行中持续在场」。然后就可以愉快的接着玩了。

## 四、架构变化

这一章的架构变化：**核心新增一个「钩子机制」，`extension`层多一个注册入口。**

```text
src/core/hooks/hooks.ts        ← 新增：HookManager + HookEvent（六类钩子的类型契约）
src/core/index.ts              ← 导出 HookManager / HookEvent / HookName / HookHandler
src/core/runtime/runtime.ts    ← options.hooks；runContext 在 6 个节点调用 hooks.run
src/extensions/extension.ts    ← ExtensionContext 增加 readonly hooks: HookManager
src/extensions/registry.ts     ← 注入 hooks（可选），setup(ctx) 带上 hooks
src/cli/index.ts               ← createAgent 建 HookManager 并接线进 runtime options
```

数据流分两条线：

```text
【注册线】cli/createAgent → new HookManager() → ExtensionRegistry({ hooks })
        → install(hello-trace) → setup(ctx) 里 ctx.hooks.register("beforeModel", handler)

【触发线】new AgentRuntime(model, registry, { hooks }) → runContext()
        → 节点处 await hooks.run("beforeModel", { request })
        → 调 handler({ type: "beforeModel", request })
```

**依赖方向依然干净**：`core/hooks` 是核心基础设施，runtime 消费它；`extensions` 依赖 `core/hooks`；core 依旧不认识 extensions。

> 关键点：**Hook 机制住进 Core，Hook 注册留在`extension`。** 机制（怎么触发、什么时序）是稳定的核心契约，注册（谁来挂、挂什么）是可演进的外部状态——这正是「Core 与可演进状态隔离」的又一次落地（机制与状态各司其职）。

## 五、核心抽象

这一章的核心抽象是 **HookManager**——一个极简的「名字 → 处理器」注册表：

```ts
class HookManager {
  register(name: HookName, handler: HookHandler): void;
  run(name: HookName, event): Promise<void>;   // 依次调用，支持 async handler
}
```

六类钩子，覆盖三个粒度：

| 钩子 | 粒度 | 触发时机 | 能做什么 |
| --- | --- | --- | --- |
| `beforeRun` | 一轮运行 | run 开始前 | 拿到 input，报个到 |
| `afterRun` | 一轮运行 | run 结束后 | 拿到整个 `AgentRun`，记账 / 检查结果 |
| `beforeModel` | 一次模型调用 | 发请求前 | **改 request**（注入消息、调整工具） |
| `afterModel` | 一次模型调用 | 拿到响应后 | 看 response，统计 / 审计 |
| `beforeTool` | 一次工具调用 | 执行前 | 看 call，预警 |
| `afterTool` | 一次工具调用 | 执行后 | 看 call + result，校验 |

### events vs hooks：一字之差，本质不同

| | AgentEvent（ch15） | Hook（本章） |
| --- | --- | --- |
| 角色 | 旁观者 | 协作者 |
| 方向 | runtime → 听众（单向广播） | runtime → 钩子 → 影响 runtime（双向） |
| 能否干预 | 不能 | **能**（改 request / 看 result） |
| 谁在听 | CLI 渲染、订阅者 | `extension`注册的处理器 |
| 一句话 | 发生了什么 | 现在，我能做点什么 |

> 为什么核心要有两个相似的东西？**因为可观察（events）和可干预（hooks）是两个不同的能力。** 合并成一个，要么旁观者有了动手的权力，要么协作者只能干看——两个都糟。骚操作谈不上，但这步区分很必要。

## 六、实现代码

### `src/core/hooks/hooks.ts`（完整）

下面给出完整实现：

```ts
import type { ModelRequest, ModelResponse, ToolCall } from "../model/types";
import type { ToolResult } from "../tool/tool";
import type { AgentRun } from "../runtime/run";

export type HookEvent =
  | { type: "beforeRun"; input: string }
  | { type: "afterRun"; run: AgentRun }
  | { type: "beforeModel"; request: ModelRequest }
  | { type: "afterModel"; request: ModelRequest; response: ModelResponse }
  | { type: "beforeTool"; call: ToolCall }
  | { type: "afterTool"; call: ToolCall; result: ToolResult };

export type HookName = HookEvent["type"];

export type HookHandler<E extends HookEvent = HookEvent> = (event: E) => void | Promise<void>;

export class HookManager {
  private readonly hooks = new Map<HookName, HookHandler[]>();

  register<E extends HookName>(name: E, handler: HookHandler<Extract<HookEvent, { type: E }>>): void {
    const list = this.hooks.get(name) ?? [];
    list.push(handler as HookHandler);
    this.hooks.set(name, list);
  }

  async run<E extends HookName>(name: E, event: Omit<Extract<HookEvent, { type: E }>, "type">): Promise<void> {
    for (const handler of [...(this.hooks.get(name) ?? [])]) {
      await (handler as HookHandler)({ type: name, ...event } as unknown as HookEvent);
    }
  }
}
```

三个细节值得点名（**重点关注**这三点）：

1. **`HookEvent` 是判别联合，`HookName` 从它推导**——加一个钩子类型，所有签名自动跟进，**改不动漏**；
2. **`run(name, event)` 的 event 不用带 `type`**——名字已说了它是谁，`run` 内部补上 `type` 再派发，调用点更干净；
3. **handler 支持 `void | Promise<void>`**——`run` 会 `await`，钩子想做异步的事（将来查个权限、读个文件）不用回头改接口。

### `AgentRuntime`：拆出 runOnce，六个节点插钩子（关键片段）

既然我们的Hook是在各关键节点的执行前后插入锚点，所以我们需要在 `runtime.ts` 的 `AgentRuntime` 中，完成六个钩子嵌入

![image.png](https://imgbed.ppai.top/file/1786949102235_image.png)

`runContext` 变成「包装 + 内层」：钩子包在真正执行的两头，而执行体 `runOnce` 只负责跑（核心逻辑不赘述，看片段）：

```ts
async runContext(context: AgentContext): Promise<AgentRun> {
  const input = [...context.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  // 一次agent运行的前后
  await this.hooks?.run("beforeRun", { input });
  const run = await this.runOnce(context, input);
  await this.hooks?.run("afterRun", { run });
  return run;
}
```

循环里四个节点，每一个都是在「对应动作发生」的前/后各插一手：

```ts
// beforeModel：发请求前，钩子可以先改 request
const modelRequest = { messages: context.messages, tools };
await this.hooks?.run("beforeModel", { request: modelRequest });
this.events.emit({ type: "model:start", runId: id, request: modelRequest });

// afterModel：拿到响应后，钩子可以看 response
response = await this.generate(modelRequest);
await this.hooks?.run("afterModel", { request: modelRequest, response });

// beforeTool / afterTool：工具执行的前后
await this.hooks?.run("beforeTool", { call });
result = await withGuard(...);
await this.hooks?.run("afterTool", { call, result });
```

> 注意：**钩子跑在对应事件之前**——`beforeModel` 在 `model:start` 之前、`afterModel` 在 `model:end` 之前。因为钩子可能改 request / response，改了之后广播出去、记进步骤，才算「闭环」。

### 扩展与 CLI：一行一行的接线

`ExtensionContext` 加一行，`ExtensionRegistry` 注入一行，`createAgent` 建一个 HookManager：

```ts
// extensions/extension.ts
export interface ExtensionContext {
  readonly name: string;
  log(message: string): void;
  readonly tools: ToolRegistry;
  // 新增 hookManager
  readonly hooks: HookManager;
}


// extensions/registry.ts
export interface ExtensionRegistryOptions {
  log?: (name: string, message: string) => void;
  tools?: ToolRegistry;
  // 新增hookManager
  hooks?: HookManager;
}

export class ExtensionRegistry {
  private readonly hooks: HookManager;

  constructor(options: ExtensionRegistryOptions = {}) {
    this.log = options.log ?? ((name, message) => console.log(`[ext:${name}] ${message}`));
    this.tools = options.tools ?? new ToolRegistry();
    // 扩展注册机制中，新增HookManager
    this.hooks = options.hooks ?? new HookManager();
  }

  install(extension: Extension): void {
    const name = extension.name;
    if (typeof name !== "string" || name.trim() === "") {
      throw new RuntimeError("扩展名不能为空");
    }
    if (this.extensions.has(name)) {
      throw new RuntimeError(`扩展 ${name} 已注册`);
    }
    extension.setup({
      name,
      log: (message) => this.log(name, message),
      tools: this.tools,
	  // 上面的 ExtensionContext新增了HookManager，这里实现初始化的传入，确保每个 HookExtension 的实现，可以被 HookManager 统一管理
      hooks: this.hooks,
    });
    this.extensions.set(name, extension);
  }
}
```

### TraceHook实现：支持关键traceLog输出

为了演示Hook的机制，我们实现一个 `trace-hook.ts`，来在关键链路上进行日志打印

按照标准的扩展机制进行实现

```ts
import { defineExtension } from "./extension";

export interface TraceHookOptions {
  log?: (message: string) => void;
}

function shortArgs(argumentsValue: unknown): string {
  const text = JSON.stringify(argumentsValue);
  return text.length > 50 ? `${text.slice(0, 50)}…` : text;
}

export function createTraceHookExtension(options: TraceHookOptions = {}) {
  const runStartedAt = Date.now();
  const toolStartedAt = new Map<string, number>();

  return defineExtension({
    name: "trace-hook",
    version: "0.1.0",
    description: "Hook 机制演示：在 6 个运行节点打印 trace 日志（纯观察，不改请求）。",
    setup(ctx) {
      const log = options.log ?? ((message: string) => ctx.log(message));

      ctx.hooks.register("beforeRun", (e) => {
        log(`beforeRun   一轮运行开始 · 输入「${e.input}」`);
      });

      ctx.hooks.register("beforeModel", (e) => {
        log(`beforeModel 发请求 · 消息 ${e.request.messages.length} 条 · 工具 ${e.request.tools?.length ?? 0} 个`);
      });

      ctx.hooks.register("afterModel", (e) => {
        log(
          `afterModel  模型返回 · toolCalls ${e.response.toolCalls.length} 个 · ${e.response.inputTokens} in / ${e.response.outputTokens} out`,
        );
      });

      ctx.hooks.register("beforeTool", (e) => {
        toolStartedAt.set(e.call.id, Date.now());
        log(`beforeTool  即将执行 ${e.call.name}(${shortArgs(e.call.arguments)})`);
      });

      ctx.hooks.register("afterTool", (e) => {
        const elapsedMs = Date.now() - (toolStartedAt.get(e.call.id) ?? Date.now());
        toolStartedAt.delete(e.call.id);
        log(`afterTool   执行完成 · ${e.call.name} → ok=${e.result.ok} · ${elapsedMs}ms`);
      });

      ctx.hooks.register("afterRun", (e) => {
        const elapsedMs = Date.now() - runStartedAt;
        log(`afterRun    运行结束 · ${e.run.status} / ${e.run.stopReason} · ${e.run.steps.length} 步 · ${elapsedMs}ms`);
      });
    },
  });
}
```

> 有个细节值得停一下：**请注意**，为什么注入的系统消息没有让请求一路涨到 5、6 条，而是稳定在「2 → 4」？因为 `context.messages` 是**防御性拷贝**（ch11 的 `get messages()` 返回的是副本）。所以钩子改的是「**这一次发给模型的请求**」，而不会偷偷污染会话历史。**这是特性，不是 bug**——想改历史得走显式的 `context.add(...)`（ch33 的 Prompt 注入会用到这个边界）。


然后添加在creatAgent处，进行hook的逻辑注入

![image.png](https://imgbed.ppai.top/file/1786950150518_image.png)

```ts
// cli/index.ts
const hooks = new HookManager();
const extensions = new ExtensionRegistry({ tools: registry, hooks });
if (options.traceHook) {
	// 通过命令行参数，确定是否需要启用 TraceHook
    extensions.install(createTraceHookExtension());
}
```


`createAgent` 返回新增 `hooks`，同样的，`AgentRuntimeOptions` 中也会携带上带上它

——`runAgentDemo` 和 `chat` 本来就把 `options` 整个传给 `new AgentRuntime(...)`，**hooks 自动接进所有 runtime**。


### TraceHook 命令行参数

TraceHook 这个Extension 我们采用命令行参数的方式来启用，默认不启用它（因为我们实现的主要就是为了本章的验证效果）

具体的实现逻辑，也就是上面的 `if (options.traceHook)` 这个条件判断

```
  --trace-hook             开启 trace-hook 扩展：打印 6 个 hook 节点的运行轨迹
  --no-trace-hook          关闭 trace-hook 扩展（默认即关闭）
```

## 七、运行 Demo

三种跑法，三个层面（**最基本的**，手动加强语气，建议逐条核一遍）：

```bash
# 1. 本章 demo：hook 扩展 + 假模型，无需 API Key
$ node --import tsx examples/stage-4/32-extension-register-hook/demo.mts

# 2. 回归 ch31：工具注册 demo 不受影响
$ node --import tsx examples/stage-4/31-extension-register-tool/demo.mts
```

上面这两个的输出我们直接省略了，有兴趣的小伙伴可以动手跑一下；我们来重点测试下，这个 trace-hook

```bash
# 3. 老 CLI：--extensions 清单、--tools 跑 agent 都不变
$ node --import tsx src/cli/index.ts --extensions --trace-hook

Workspace: D:\Workspace\hui\project\hello-harness
已安装扩展（manifest）：
  hello-coding@0.4.0 (active) — Coding Agent 本体：6 个工具（calculator/random/read/write/edit/bash）由扩展注册；方法论 prompt 留待 ch33。
  trace-hook@0.1.0 (active) — Hook 机制演示：在 6 个运行节点打印 trace 日志（纯观察，不改请求）。
```

当我们在命令行中，添加`--trace-hook`，正常就会看到两个扩展： `hello-coding` + `trace-hook`， 接下来我们在 `hello --trace-hook` 对话中来体验一下


```bash
# 一次性对话
$ Hello --trace-hook


# 流式对话
$ Hello --trace-hook --chat
```

![image.png](https://imgbed.ppai.top/file/1786951139477_image.png)

| 验证点 | 结果 |
| --- | --- |
| 六类钩子按序触发 | demo 输出 `beforeRun → beforeModel → … → afterRun` |
| 钩子能改 request | 我们的demo中并没有体现这一点，有兴趣的小伙伴可以试试 |
| 无 hooks 时不受影响 | 第三段照常 completed / finished |
| ch31 回归 | demo 输出不变 |
| 类型检查 | `pnpm typecheck` 通过 |

## 八、解决了什么

这一章，扩展从「提供能力」正式跨进「参与运行」：

1. **扩展在 harness 运行中有位置了**——六类钩子覆盖运行、模型、工具三个粒度，扩展能看、能改、能记账；
2. **为「干预型」机制铺好了路**——Permission Gate（ch37）需要在工具执行前「拦一道」、Skill 注入（ch36）需要在模型调用前「塞知识」，钩子就是它们的立足点；
3. **机制/状态分离的又一次落地**——HookManager 是核心契约，谁来注册、注册什么由扩展决定，核心不必知道具体扩展；
4. **边界被清晰划出**——钩子改的是「本次模型请求」的拷贝，碰不到会话历史，想动历史得走显式的写入通道。

## 九、引入了什么问题

接下来再泼盆冷水，看看这一版还留了哪些坑：

1. **钩子不能「拒绝」**：`beforeModel` 只能改 request，不能中止这次调用；`beforeTool` 只能看，不能 veto——**拦截的权力还没给**。这是 Permission Gate 的活，但我们还没做（ch37）；
2. **执行顺序没有优先级**：同一事件名按注册顺序依次跑，谁先谁后由安装顺序决定，没有优先级、依赖或冲突处理；
3. **异常处理粗糙**：handler 抛错会直接打断 `hooks.run`，进而打断整个 run——一个坏扩展能把 harness 带崩。**容错与隔离是必须补的**；
4. **`ctx.hooks` 暴露了完整 `HookManager`**：扩展只该注册，不该能 `run`——能力面给宽了，与 ch30 的 `tools` 一样是「能用、但收着点」；
5. **清单不显示钩子**：manifest 只列身份与状态，看不出扩展挂了哪些钩子——可观察性差一口气；
6. **钩子还不够细**：还没有 `beforeSkill` / `afterStep` 这类更细的节点——等 Skill 进来（ch34–36）再看。

## 十、下一章

钩子有了，但我们演示的注入是**写死在扩展里的字符串**「【钩子注入】按章法干活」。真正的问题是：**prompt 应该可配置、可扩展**——不同任务、不同用户、不同扩展，要往系统消息里塞不同的方法论。

下一章，**Prompt Extension**：prompt 不再写死。放进 `prompts/*.md` 文件、随扩展加载、用 `ctx` 注入，让「提示词」也变成扩展能参与的一部分。从「钩子里塞一句话」到「prompt 进系统」，ch33 见。

> **本阶段汇总**：`ctx` 一路长大——ch30 有 `name`/`log`，ch31 有 `tools`，ch32 有 `hooks`。下一个该长大的，是 prompt 本身。


上面这些就是 Extension 注册 Hook 的基本使用姿势了，有啥用、怎么接着玩 Prompt Extension，留在下一篇逐一展开。

尽信书则不如，以上内容纯属一家之言，因个人能力有限，难免有疏漏和错误之处，如发现 bug 或者有更好的建议，欢迎批评指正，不吝感激 🙃


欢迎点赞、关注公众号「一灰灰Blog」 我们下章见

---

微信公众号: 一灰灰Blog

