---
title: "09 · Agent 的停止条件"
description: "maxSteps / timeout / abort / finished / failed：让循环长出判断力。"
gitTag: "v09-stop-condition"
stage: 1
---

# 09 · Agent 的停止条件

> <span class="stage-badge">Stage Hello Agent</span> · <span class="tag-badge">v09-stop-condition</span>

08 章的 `runAgent` 里，有个不太好意思的角落——`maxIterations` 超了会**直接 throw**。摔得难看不说，辛辛苦苦算到一半的历史也全扔了。

这一章，小伙伴，我们把「什么时候停」从一根保险丝，升级成一套**会说人话的停止协议**。

<!-- more -->

## 一、上一版存在什么问题？

回看 08 章的停止处理：

```ts
while (true) {
  iterations += 1;
  if (iterations > maxIterations) {
    throw new Error(`Agent 超过最大迭代次数（${maxIterations}），已强制停止`);   // 粗暴
  }
  ...
}
```

四个问题摆上台面：

1. **超限 = 爆炸**：`throw` 把整个调用炸掉，**已完成的中间步骤全部丢失**；
2. **只有一个保险丝**：只有步数上限，没有时间上限、没有取消、没有失败分类；
3. **无法回答「为什么停」**：调用方拿到结果，分不清「正常完成」和「被硬拦下来的」；
4. **无法中途喊停**：模型跑疯了一直调工具，你只能干瞪眼等它撞上保险丝。

> 换句话说：上一版的循环是个**没有仪表盘的引擎**——能转，但你不知道它什么时候、因为什么停下来，更没法主动让它停。

## 二、本篇解决什么问题？

引入一套完整的**停止协议**，让 `runAgent` 停下时自带「诊断报告」：

```text
finished    # 正常完成：模型不再要动作
maxSteps    # 撞上步数预算
timeout     # 撞上时间预算
aborted     # 用户主动取消
failed      # 明确失败（模型/工具抛异常）
```

每个结果都回答同一个问题：**「为什么停？」** 从今往后，Agent 每一次停下都是**有据可查的**。

解决完上面这件事，咱们回过头把这条线串一下：**上一章留下的「超限就爆炸、只有一个保险丝、回答不了为什么停、没法中途喊停」这些遗留问题 → 这一章用「五态停止协议 + finish 统一收场 + AbortSignal」解决掉 → 接下来看看我们到底得到了什么收获。**

### 解决之后，我们收获了什么？

- **停止不再爆炸**：所有停止点统一走 `finish`，历史与部分成果全部保留；
- **「为什么停」有据可查**：`status` + `stopReason` + `error` 三件套，调用方不再靠猜；
- **超时与取消上线**：时间预算挡无限拖，`AbortSignal` 把控制权还给用户；
- **异常被驯服**：模型/工具抛错归类为 `failed`，不再把程序炸掉。

> 一句话收个尾：遗留的「停得难看、说不清、拦不住」问题被这一章的停止协议解决掉，换来的则是「不爆炸、可诊断、可取消、可分类」四笔实实在在的收获——这就是「遗留问题 → 解决问题 → 得到收获」的闭环。

## 三、先看最终效果

同一个「作死」问题（无限算 1+1），四个不同的停法：

```bash
# 1) 步数预算
$ pnpm dev -- --tools --steps 1 "一直算 1+1 不要停"
ToolCall : calculator({"expression":"1+1"})
Result  : {"value":2}
Answer  :
Steps   : 2 轮 · 4 条消息 · 7039ms
Status  : completed (maxSteps)          # 有据可查：撞上限，但中间结果保住了

# 2) 时间预算
$ pnpm dev -- --tools --timeout 5 "一直算 1+1 不要停"
ToolCall : calculator({"expression":"1+1"})
Result  : {"value":2}
Answer  : 好的，开始计算：1+1
Steps   : 2 轮 · 4 条消息 · 8930ms
Status  : failed (timeout) · 超过超时上限 5ms


# 3) 用户取消（协作式：下一轮迭代入口生效）
$ node --import tsx -e "... ctrl.abort() ..."
ToolCall : calculator({"expression":"1 + 1"})   # 当前这一步会先执行完
Status  : aborted (aborted) · 任务已被取消      # 然后在下一轮入口停下


# 4) 正常完成
$ pnpm dev -- --tools "17 乘以 38 等于多少？"
ToolCall : calculator({"expression":"17 * 38"})
Result  : {"value":646}
Answer  : 17 × 38 = **646**。
Steps   : 2 轮 · 5 条消息 · 2832ms
Status  : completed (finished)
```

四个停法，四份清晰诊断。**「停」不再是一个意外，而是一种被建模的状态。**

## 四、架构变化

`src/agent.ts` 里，停止从「一个 if + 一个 throw」变成「一套协议」：

```text
AgentOptions（新增）
├── maxSteps      # 步数预算（默认 20）
├── timeoutMs     # 时间预算（默认 120s）
└── signal        # AbortSignal：用户取消

AgentResult（升级）
├── status        # completed / failed / aborted
├── stopReason    # finished / maxSteps / timeout / aborted / failed
├── answer        # 最终回答（失败/中止时可能是空或部分）
├── history       # 完整轨迹（含被截断的部分！）
├── iterations
└── error?        # 失败/中止原因描述
```

`RunStatus` 按规划定义：

```ts
type RunStatus =
  | "running"      # 预留：将来长生命周期 Run 会用到（Stage 2）
  | "completed"
  | "failed"
  | "aborted";
```

## 五、核心抽象

### 状态与原因，两个维度

| RunStatus | 含义 | 常见 StopReason |
| --- | --- | --- |
| `completed` | 停下来时有交付物 | `finished`（正常）、`maxSteps`（预算截断，部分交付） |
| `failed` | 没交付，出问题了 | `timeout`（超时）、`failed`（异常） |
| `aborted` | 用户叫停 | `aborted` |

**重点关注**：一个 `status` 讲「结局」，一个 `stopReason` 讲「缘由」——调用方不需要猜。

### 为什么 `maxSteps` 是 completed 而不是 failed

撞上步数预算时，Agent 已经做了不少事（算了好几轮），只是没「做完」。**把它标记为 `completed (maxSteps)`，语义是「预算耗尽，交付了能交付的」**——调用方可以基于部分成果继续（比如：让用户加预算重跑），而不是把辛辛苦苦的中间结果一杆子打成「失败」。

> 设计取向：**结果被截断 ≠ 结果作废**。只要历史保留，就还能再续。

### 协作式取消（cooperative cancellation）

`abort` 的实现是**迭代间检查**，不是飞行中掐断：

```ts
if (signal?.aborted) {
  return finish("aborted", "aborted", { error: "任务已被取消" });
}
```

每次迭代入口看一眼「用户喊停了吗」，喊了就优雅收场、保留历史。它的局限很诚实：**正在进行中的 `model.generate` 或 `tool.execute`（都是阻塞 await）无法被打断**——取消只能等这一步结束、在下一轮入口生效。要真正掐断飞行中的请求，需要把 `signal` 穿透进 `Model` 层和 HTTP 层（甚至每个 Tool 也要能感知取消），那是 Stage 2 Runtime 的活。先教学，后完美。

### 停止判定的顺序

```text
每轮迭代入口，依次问三个问题：
① 用户取消了吗？   → aborted
② 步数超了吗？     → completed (maxSteps)
③ 时间超了吗？     → failed (timeout)
都没问题 → 正常发起一次 model.generate
```

## 六、实现代码

**`src/agent.ts`**——停止协议核心：

```ts
export type RunStatus = "running" | "completed" | "failed" | "aborted";
export type StopReason = "finished" | "maxSteps" | "timeout" | "aborted" | "failed";

export async function runAgent(
  model: Model,
  request: ModelRequest,
  tools: Record<string, Tool>,
  options: AgentOptions = {},
): Promise<AgentResult> {
  const maxSteps = options.maxSteps ?? 20;
  const timeoutMs = options.timeoutMs ?? 120_000;
  const signal = options.signal;
  const history = [...request.messages];
  const startedAt = Date.now();
  let iterations = 0;
  let lastText = "";

  // 统一的「收场」函数：每个停止点都走这里，保证结果结构一致
  const finish = (status, stopReason, extra = {}): AgentResult => ({
    status, stopReason,
    answer: extra.answer ?? lastText,
    history, iterations,
    ...(extra.error ? { error: extra.error } : {}),
  });

  while (true) {
    iterations += 1;

    if (signal?.aborted) {
      return finish("aborted", "aborted", { error: "任务已被取消" });
    }
    if (iterations > maxSteps) {
      return finish("completed", "maxSteps");
    }
    if (Date.now() - startedAt > timeoutMs) {
      return finish("failed", "timeout", { error: `超过超时上限 ${timeoutMs}ms` });
    }

    let response;
    try {
      response = await model.generate({ messages: history, tools: Object.values(tools) });
    } catch (error) {
      return finish("failed", "failed", { error: errorMessage(error) });
    }
    lastText = response.content;
    history.push(assistantMessage(response.content, response.toolCalls));

    if (response.toolCalls.length === 0) {
      return finish("completed", "finished");
    }

    try {
      for (const call of response.toolCalls) {
        const tool = tools[call.name];
        const result = tool ? await tool.execute(call.arguments) : { error: `未知工具：${call.name}` };
        history.push(toolMessage(call.id, JSON.stringify(result) ?? ""));
      }
    } catch (error) {
      return finish("failed", "failed", { error: errorMessage(error) });
    }
  }
}
```

变化最大的三点：**throw 全部消失**（改走 `finish` 优雅收场）、**异常被捕获归类**（不再一路炸到外层）、**四个停止点各有其职**。

**`src/index.ts`**——把诊断报告打印出来，一个 `--steps` / `--timeout` 就能复现各种停法：

```ts
console.log(`Status  : ${result.status} (${result.stopReason})${result.error ? ` · ${result.error}` : ""}`);
```

## 七、运行 Demo

接下来进入正题，正确的使用姿势如下：

```bash
pnpm dev -- --tools "17 乘以 38 等于多少？"        # 正常：completed (finished)
pnpm dev -- --tools --steps 1 "一直算 1+1 不要停"   # 步数预算：completed (maxSteps)
pnpm dev -- --tools --timeout 5 "一直算 1+1 不要停" # 时间预算：failed (timeout)
```

![image.png](https://imgbed.ppai.top/file/1786621693553_image.png)

取消演示（脚本里主动 `abort`）：

```bash
node --import tsx -e "import { runAgent } from './src/agent.ts';
import { createOpenAIModel } from './src/model/openai.ts';
import { systemMessage, userMessage } from './src/messages.ts';
import { calculator } from './src/tool/calculator.ts';
const ctrl = new AbortController();
setTimeout(() => ctrl.abort(), 30);
runAgent(createOpenAIModel(), { messages: [systemMessage('x'), userMessage('一直算 1+1')] },
  { calculator }, { signal: ctrl.signal })
  .then((r) => console.log('status:', r.status, '| reason:', r.stopReason, '| error:', r.error));"
```

> ⚠️ **别被这个示例骗了——取消是「协作式」的。** `signal.aborted` 只在每轮迭代的入口被检查一次：
>
> - 如果取消发生时，模型调用或工具执行**正在阻塞等待**，`abort` 会**等到这一步结束**，在下一轮入口才生效；
> - 所以真实 API（一次模型调用好几秒）下，`setTimeout(ctrl.abort, 30)` **并不能立刻打断**——你得等当前那次调用返回，循环才会发现「被取消了」并停下；
> - 上面输出之所以「秒停」，是因为本地 mock 每次迭代只有 1ms，30ms 里已经跨过许多次迭代入口，取消在下一次入口被及时发现；
> - 要**真正打断飞行中的请求**（掐断 HTTP 连接），必须把 `signal` 穿透到 `Model` 层和网络层——那是 Stage 2 Runtime 的活，本章先立住「取消是一种状态」这个心智。

> 提示：感兴趣的小伙伴，`--timeout` 的单位是毫秒。真实调用建议默认 120s（代码内默认值）足够；想观察超时，把 `--timeout` 调小即可。网络受限用 mock 或 `$env:HTTPS_PROXY`。

## 八、新架构解决了什么？

- **停止不再爆炸**：所有停止点统一走 `finish`，历史与部分成果全部保留；
- **「为什么停」有据可查**：`status` + `stopReason` + `error` 三件套，调用方不再靠猜；
- **超时与取消上线**：时间预算挡住无限拖，`AbortSignal` 把控制权还给用户；
- **异常被驯服**：模型/工具抛错归类为 `failed`，而不是把整个程序炸掉；
- **设计取向明确**：「截断 ≠ 作废」——预算耗尽也带着交付物回来。

## 九、它又引入了什么问题？

停止协议是装上了，但是请注意每个「停」背后还都可能藏着新坑：

- **协作式取消的边界**：飞行中的模型调用或工具执行停不下来，慢调用时用户还是得等——真正的中断需要把 `signal` 穿透到 HTTP 层与每个 Tool（Stage 2 见）；
- **`timeout` 只能拦「迭代间」**：单次调用本身若超过预算，得靠 SDK 自身的超时兜底，协议层管不到；
- **预算语义仍粗糙**：`maxSteps` 只数「轮」，没有区分「工具调用次数」与「思考轮次」；「无效重试」还是会白白烧预算；
- **失败后没有重试/续跑**：`failed` 之后怎么办？历史还在，但「基于历史续跑」的能力还没长出来；
- **工具集还是硬编码**：`tools` 是调用方传进来的 `Record`——工具一多，靠手写对象就不是办法了。

## 十、下一章

**Stage 2 · Hello Harness** 开篇——**10 · Tool Registry**：

```ts
class ToolRegistry {
  register(tool: Tool): void
  get(name: string): Tool
  list(): ToolDefinition[]
  execute(call: ToolCall): Promise<ToolResult>
}
```

08 章埋下的问题——「工具越来越多怎么办」——正式提上日程。同时，前面九章攒下的「能工作的 Agent」，将从**一堆松散的函数**，走向**一个可以维护的 Harness**：注册、上下文、运行时、步骤、事件……每个都是 Stage 2 的一块砖。

工具一多，靠手写 `Record` 还撑得住吗？上下文越来越长，怎么管才不爆窗口？运行时、事件、步骤这些「Harness 的砖」该从哪块先垒？

以上这些问题，留在 Stage 2 逐一介绍。好了，HelloAgent到这一章就算收尾了，这一大块完成之后，我们就能收获一个能干完一条完整链路的Agent了，Agent有了，那么Harness还会远吗？

请跑一遍 `--steps 1` 和 `--timeout 5`，亲眼看「Agent 为什么停」变成一行清晰的诊断——控制一个系统，第一步就是让它把话说清楚。

欢迎点赞、关注公众号「一灰灰Blog」，下一章进入 Harness 启动 😊

---

微信公众号: 一灰灰Blog