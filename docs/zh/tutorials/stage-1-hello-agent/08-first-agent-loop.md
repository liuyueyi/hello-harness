---
title: "08 · 第一个 Agent Loop"
description: "while(true) 循环：Agent 本质不是一个神秘对象，而是一个循环。"
gitTag: "v08-agent-loop"
stage: 1
---

# 08 · 第一个 Agent Loop

> <span class="stage-badge">Stage Hello Agent</span> · <span class="tag-badge">v08-agent-loop</span>

整个系列最标志性的一篇，来了。

前七章我们做过：调用模型、流式、抽象 Model、让模型产出 ToolCall、实现 Tool、把结果回传。每一步都像搭积木。现在，见证奇迹的时刻到了，**把这七块积木拼成一个会自己一直干到完的循环**——`while(true)`，从而实现我们的第一个Agent

> **Agent 本质不是一个神秘对象，而是一个循环。**

<!-- more -->

## 一、上一版存在什么问题？

07 章的循环是「焊死的一遍」：

```ts
let response = await model.generate({ messages: history, tools: ... });

if (response.toolCalls.length > 0) {
  history.push(assistantMessage(response.content, response.toolCalls));
  for (const call of response.toolCalls) {
    const result = await tool.execute(call.arguments);
    history.push(toolMessage(call.id, JSON.stringify(result) ?? ""));
  }
  response = await model.generate({ messages: history });   // 只回一次
}
```

三个硬伤：

1. **只走一遍**：`"((1+2)×3+4)×5"` 这种连环计算，第一轮算完 1+2，第二轮算完×3，第三轮就没人接着干了；
2. **逻辑长在演示里**：循环、执行、回写全堆在 `index.ts`，Agent 本身没有姓名、没有文件、没有「存在」；
3. **「完成」靠猜**：代码写死「没 tool_call 就算完」，但没人把它提炼成明确的规则。

> 换句话说：上一版是**一个只会翻一页的书童**，而我们要的是一个**不把活干完绝不放下书卷的学徒**。

## 二、本篇解决什么问题？

1. 抽出 **`runAgent()`**：一个 `while(true)`，模型不停止调用工具就不停，直到给出最终答案；
2. 让 Agent 拥有**自己的文件**（`src/agent.ts`）、自己的签名（model + request + tools）——「第一个 Agent」正式诞生；
3. 代码控制在 **30～50 行**，一眼能读完、能背下来、能讲给别人听。

解决完上面三件事，咱们回过头把这条线串一下：**上一章留下的「循环只走一遍、Agent 没有姓名、完成靠猜」这些遗留问题 → 这一章用「runAgent 循环 + 抽成文件 + maxIterations 兜底」解决掉 → 接下来看看我们到底得到了什么收获。**

### 解决之后，我们收获了什么？

- **任意多轮覆盖**：连环任务不再写死，模型自己决定干几轮，真正的「干到完」；
- **Agent 有了姓名**：`runAgent` 有了签名和文件，可复用、可测试、可讲给别人听；
- **停止不再是玄学**：朴素停止条件 + 迭代上限兜底，循环先安全转起来；
- **关注点彻底分离**：`agent.ts` 管循环、`tool/` 管能力、`model/` 管连接、`index.ts` 管展示。

> 一句话收个尾：遗留的「只走一遍、没姓名、靠猜」问题被这一章的 `runAgent` 解决掉，换来的则是「能多轮、有姓名、可停、可分离」四笔实实在在的收获——这就是「遗留问题 → 解决问题 → 得到收获」的闭环。

## 三、先看最终效果

来一道必须**连环调用**的题：

```bash
PS D:\Workspace\hui\project\hello-harness> pnpm dev -- --tools "计算 (1+2)，结果再乘以 5，是多少？"

> hello-harness@0.1.0 dev D:\Workspace\hui\project\hello-harness
> node --import tsx --env-file-if-exists=.env src/index.ts "--tools" "计算 (1+2)，结果再乘以 5，是多少？"

ToolCall : calculator({"expression":"1 + 2"})
Result  : {"value":3}
ToolCall : calculator({"expression":"3 * 5"})
Result  : {"value":15}
Answer  : 最终结果是 **15**。
Steps   : 3 轮 · 7 条消息 · 22850ms
```

看清楚了：**三轮模型调用，Agent 自己说了算**。它算完 `1+2`，觉得不够，又调了一次算 `×5`，确认拿到最终结果才停。全程没有一行代码管「第几步做什么」——只有一个循环，让它自己决定什么时候继续、什么时候算完。

## 四、架构变化

```text
src/
├── messages.ts
├── events.ts
├── agent.ts        # 新增：第一个 Agent（就是那个循环）
├── model/
│   ├── model.ts
│   ├── openai.ts
│   └── types.ts
├── tool/
│   ├── tool.ts
│   └── calculator.ts
└── index.ts        # 瘦身：只剩 CLI 与演示编排
```

![image.png](https://imgbed.ppai.top/file/1786619918246_image.png)

注意那条**tool消息回写**之后然后重新回调了 `model_generate` —— 这个循环的关键不在多写了多少代码，而在于「让决策权回到模型手里」。

模型说继续，就继续；模型说完了，才算结束。

## 五、核心抽象

### Agent = 循环，不是对象

先拆掉那层神秘滤镜：

| 我们以为的 Agent | 实际上的 Agent |
| --- | --- |
| 一个会思考的实体 | 一个 `while(true)` 循环 |
| 有「意识」做决定 | 决定权交给了模型的 `tool_calls` |
| 神秘的行为系统 | 观察 → 行动 → 观察……直到停止 |

**重点关注**：循环里只有三个角色：

- `model`：负责「思考」——每次读一遍历史，说一句话或要一个动作；
- `history`：负责「记忆」——所有观察（含工具结果）都写在这里，模型每次都要重读；
- `tools`：负责「行动」——模型提议，这里执行，结果写回记忆。

### 「完成」的定义，此刻是朴素的

```ts
if (response.toolCalls.length === 0) {
  return response.answer;   // 模型不再要动作 → 任务完成
}
```

这是最朴素的停止条件。它足够好用，但还不够可靠（万一模型发疯一直要动作呢？）。所以我们**先用 `maxIterations` 兜底**，把正式的停止条件（maxSteps / abort / timeout / finished / failed）完整交给下一章。

### 历史重放 = 可观察的轨迹

循环跑完后，`history` 里躺着**每一步的完整记录**。我们演示里打印的 `ToolCall` / `Result` 全部来自历史重放，而不是执行时的临时输出——这无意中埋下了一个重要伏笔：**Agent 干过什么，天然是可重放、可审计的轨迹**（这个「轨迹」概念，会一直用到最后的 Evaluation 阶段）。

## 六、实现代码

### 循环执行的Agent实现

**`src/agent.ts`**——整个 Agent，一个文件、一个函数：

```ts
export interface AgentResult {
  answer: string;
  history: Message[];
  iterations: number;
}

export interface AgentOptions {
  maxIterations?: number;
}

export async function runAgent(
  model: Model,
  request: ModelRequest,
  tools: Record<string, Tool>,
  options: AgentOptions = {},
): Promise<AgentResult> {
  const maxIterations = options.maxIterations ?? 10;
  const history = [...request.messages];
  let iterations = 0;

  while (true) {
    iterations += 1;
    if (iterations > maxIterations) {
      throw new Error(`Agent 超过最大迭代次数（${maxIterations}），已强制停止`);
    }

    const response = await model.generate({
      messages: history,
      tools: Object.values(tools),
    });
    history.push(assistantMessage(response.content, response.toolCalls));

    if (response.toolCalls.length === 0) {
      return { answer: response.content, history, iterations };
    }

    for (const call of response.toolCalls) {
      const tool = tools[call.name];
      const result = tool ? await tool.execute(call.arguments) : { error: `未知工具：${call.name}` };
      history.push(toolMessage(call.id, JSON.stringify(result) ?? ""));
    }
  }
}
```

数一数：核心逻辑不到 30 行。**一个真实的 Agent，就长这样。**

注意两处「硬」设计：

1. **每轮都带 `tools` 重新声明**——模型每次「思考」都必须知道手里有什么牌；
2. **大模型响应的AssestMessage先入历史，再判完成**——即使模型直接答完，那句回答也留在 `history` 里，保持轨迹完整。

### 应用层适配

**`src/index.ts`**——Agent 的「观众席」，只负责把历史重放出来：

![image.png](https://imgbed.ppai.top/file/1786620325908_image.png)

从上面的对比改造也可以很清晰的看出，我们将之前的模型调用、工具执行 -> 整个直接替换为 `agent` 的一行调用

```ts
async function runAgentDemo(model: Model, request: ModelRequest) {
  const startedAt = Date.now();
  const { answer, history, iterations } = await runAgent(model, request, tools);
  const elapsedMs = Date.now() - startedAt;

  for (const m of history) {
    if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      for (const call of m.toolCalls) {
        console.log(`ToolCall : ${call.name}(${JSON.stringify(call.arguments)})`);
      }
    } else if (m.role === "tool") {
      console.log(`Result  : ${m.content}`);
    }
  }
  console.log(`Answer  : ${answer}`);
  console.log(`Steps   : ${iterations} 轮 · ${history.length} 条消息 · ${elapsedMs}ms`);
}
```

> 注意： 大模型直接进行工具调用时，对于 `计算 (1+2)，结果再乘以 5` 大概率会直接传一个 `(1+2)*5` 的表达式给工具一次执行，而不是按照我们的预期进行多次调用，此时我们可以调整系统提示词，如`你是一个简洁、直接的中文助手，工具可以使用时必须调用工具；对于复杂的数学计算，你应该拆分成多个简单的表达式，进行多次的工具调用`


## 七、运行 Demo

接下来进入正题，正确的使用姿势如下：

```bash
pnpm dev -- --tools "计算 (1+2)，结果再乘以 5"     # 连环：看它自己决定多调几轮
pnpm dev -- --tools "17 乘以 38 等于多少？"        # 单步：一轮工具调用即完成
pnpm dev -- --tools "用一句话介绍你自己"            # 无工具：直接回答，零轮工具
pnpm dev -- --tools "一直算 1+1 不要停"            # 作死：观察 maxIterations 兜底报错
```


第四条命令尤其值得跑：一个永远在调工具的问题，会撞上迭代上限——你会亲眼看到**为什么循环必须要有停止条件**。

![image.png](https://imgbed.ppai.top/file/1786620574890_image.png)

> 提示：感兴趣的小伙伴，`maxIterations` 是 `runAgent` 的可选参数（默认 10），可传 `{ maxIterations: 3 }` 观察提前兜底。网络受限用 mock 或 `$env:HTTPS_PROXY`。

## 八、新架构解决了什么？

- **任意多轮覆盖**：连环任务不再写死，模型自己决定要干几轮；
- **Agent 有了姓名**：`runAgent` 有了签名和文件，可复用、可测试、可讲给别人听；
- **停止不再是玄学**：朴素停止条件 + 迭代上限，先让循环安全转起来；
- **轨迹可重放**：`history` 既是记忆又是审计日志，`ToolCall`/`Result` 的打印只是一次重放；
- **关注点彻底分离**：`agent.ts` 管循环，`tool/` 管能力，`model/` 管连接，`index.ts` 管展示。

## 九、它又引入了什么问题？

循环终于转起来了，可为啥问题清单反而更长了、还个个都带「Agent 级别」的分量？

- **停止条件还是半吊子**：`maxIterations` 是保险丝不是开关——「何时算完成」没有严谨定义，超时、用户取消、任务失败都还没有交代；
- **上下文无限膨胀**：每轮历史都变长，连环任务 token 成本线性涨，迟早撞上窗口上限——**上下文管理**第一次变成真问题；
- **工具调用风暴**：模型失控时可能疯狂调工具，`maxIterations` 只拦数量，拦不住「每次都在做无用功」；
- **串行且单模型**：多个 `tool_calls` 挨个等、没有并行，没有子任务、没有记忆持久化——Agent 的「单兵」形态已到极限；
- **异常会炸掉整条循环**：工具抛异常、网络闪断，整个 `runAgent` 直接 throw，**没有降级、没有部分成果保留**。

## 十、下一章

**09 · Agent 的停止条件**——把 `maxIterations` 这根保险丝，换成一套**精确的停止协议**：

```text
maxSteps    # 最多跑几步
timeout     # 最多跑多久
abort       # 用户说停就停
finished    # 正常完成（无 tool_calls）
failed      # 明确失败，而不是无限重试
```

一个真正可靠的 Agent，必须能回答「我为什么停」——正常完成、超时、被取消、还是失败？这四个答案，决定了一个循环从「能转」到「可控」。Stop condition，就是让循环长出「判断力」的下一块积木。

那么问题来了——`maxSteps` / `timeout` / `abort` 这几个停止信号该怎么同时生效？用户中途取消时，已经跑出来的部分成果要不要保留？工具抛异常了，循环是该重试、跳过还是整体认输？

以上这些问题，留在下一篇逐一介绍。

请把那 30 行 `runAgent` 读三遍，这里的实现，也是Agent编程范式中，大名鼎鼎的 `ReAct`，也可以说是现在所有Agent的核心基石 —— 从这一篇起，你写的每一个 Agent，骨子里都是这个循环。

最后欢迎阅读到这里的小伙伴，点赞、关注公众号「一灰灰Blog」，下一章我们给循环装上刹车和仪表盘 😊

---

微信公众号: 一灰灰Blog