---
title: "07 · Tool Result"
description: "建立完整循环：User → LLM → Tool Call → Tool → Tool Result → LLM → Answer。"
gitTag: "v07-tool-result"
stage: 1
---

# 07 · Tool Result

> <span class="stage-badge">Stage Hello Agent</span> · <span class="tag-badge">v07-tool-result</span>

![cover](https://imgbed.ppai.top/file/1787019393563_fcl5M8kCW.jpeg)

上一章，小伙伴的 `calculator` 算出了 `646`——然后呢？我们把结果打印到屏幕上，就再也没有然后了。**模型从头到尾都不知道 `646` 这回事。**

这一章补上闭环里最关键的一环：**把工具结果喂回给模型**。

<!-- more -->

## 一、上一版存在什么问题？

06 章的 `--tools` 是这样的：

```bash
> pnpm dev -- --tools "17 乘以 38 等于多少？"

ToolCall :
  calculator({"expression":"17 * 38"})
Result  : {"value":646}
```

「Result」打出来了，但结果只落在**我们**的眼睛里，模型没看见。它此刻的内心戏是：

> 我提议调用 calculator 了……然后呢？没人告诉我算出来多少。我该说什么？

于是多步任务做不了：**模型查完天气，却无法基于天气决定要不要带伞**——因为它根本不知道查出来的天气是什么。

> 换句话说：上一版的工具像个**把消息带回来却对着墙汇报的信使**。情报已经到手，但听汇报的人是聋子。

## 二、本篇解决什么问题？

建立完整循环：

```text
User → LLM → Tool Call → Tool → Tool Result → LLM → Answer
```

核心动作只有两个：

1. **把工具结果写成一种新消息（`tool` 消息）**，push 回 `messages` 历史；
2. **再让模型看一眼更新后的历史**，让它基于真实结果给出最终回答。

解决完上面两件事，咱们回过头把这条线串一下：**上一章留下的「结果只落在我们眼里、模型看不见，多步任务做不了」这些遗留问题 → 这一章用「tool 消息回写历史 + 带着结果再问一次」解决掉 → 接下来看看我们到底得到了什么收获。**

### 解决之后，我们收获了什么？

- **模型第一次「看见」结果**：执行完工具后模型基于真实数据作答，幻觉的一大来源被掐掉；
- **工作记忆建立**：`messages` 成了任务上下文，模型能「记住」自己做过什么、看到什么——多步推理的土壤出现了；
- **循环闭环成形**：提议 → 执行 → 回写 → 再问，Agent 最基本的工作节律诞生；
- **消息类型自洽**：四种消息 + 按角色翻译，`Model` 接口零改动，演进成本锁在 wire 层。

> 一句话收个尾：遗留的「模型看不见结果、多步做不了」问题被这一章的 `tool` 消息解决掉，换来的则是「见事实、有记忆、成闭环、可演进」四笔实实在在的收获——这就是「遗留问题 → 解决问题 → 得到收获」的闭环。

## 三、先看最终效果

```bash
PS D:\Workspace\hui\project\hello-harness> pnpm dev -- --tools "17 乘以 38 加上 55 等于多少？"

> hello-harness@0.1.0 dev D:\Workspace\hui\project\hello-harness
> node --import tsx --env-file-if-exists=.env src/index.ts "--tools" "17 乘以 38 加上 55 等于多少？"

ToolCall :
  calculator({"expression":"17 * 38 + 55"})
Result  : {"value":701}
Answer  : 17 × 38 = 646，646 + 55 = 701。答案是 **701**。
Model  : deepseek-ai/DeepSeek-V4-Flash · 3286ms · 179 in / 60 out
```

注意最后一行 `Answer`：**它出现在第二次模型调用之后**。第一次调用模型提议动作，第二次调用模型拿着真实结果完成了回答。

![image.png](https://imgbed.ppai.top/file/1786617782860_image.png)

## 四、架构变化

`messages.ts` 从「三种消息」长成「四种消息」：

```text
Message 类型演化
├── system      # 0 章就有
├── user        # 0 章就有
├── assistant   # 02 章
│   └── + toolCalls?   # 新增：带动作的助手消息
└── tool        # 新增：工具的执行结果
```

正因为我们需要将工具执行的结果写回去，那么必然就有一问一答两种类型的消息，正好的对应的就是下面的 `ToolMessage` 和 `AssistantMessage`

| 消息 | role | 关键字段 | 说明 |
| --- | --- | --- | --- |
| AssistantMessage | `assistant` | `content`, `toolCalls?` | 模型说了一句话，**顺带想动手** |
| ToolMessage | `tool` | `toolCallId`, `content` | 针对某次调用的执行结果 |


`toWireMessages` 相应扩展：把 `toolCalls` 翻译回线上的 `tool_calls`，把 `ToolMessage` 翻译成 `{ role: "tool", tool_call_id, content }`。**翻译仍然是 `openai.ts` 内部的事**。

## 五、核心抽象

### 历史的两个铁律

铁律一：**assistant 的 `tool_calls` 消息必须「带着动作」进历史**。模型说「我要调用 calculator」，这句话不能丢——它和后面的结果消息是成对出现的，API 也强制要求。

铁律二：**工具结果必须写成 `tool` 消息，按 `tool_call_id` 认领**：

```ts
{ role: "tool", tool_call_id: "call_abc123", content: "{\"value\":646}" }
```

`tool_call_id` 是模型给的（05 章就在 `ToolCall` 里留了 `id`），现在它派上用场：**结果回执必须签收在正确的调用单上**。

### 上下文 = 工作记忆

**重点关注**：从这一刻起，「对话历史」不再是「记录」，而是 **Agent 的工作记忆**：

```text
messages 数组 = 模型在这个任务里所见的一切
```

每一次工具执行的结果都写进记忆，模型才能「记住」它做过的事、看到的结果——**多步推理的土壤出现了**。

### 模型只读文本

注意 `ToolMessage.content` 是字符串（我们把 `{"value":646}` 序列化进去）。**模型不读对象，只读文本**。结果是 `{ value: 646 }` 还是 `{ error: "..." }`，它都是靠读字面意思理解——所以将来我们写结果时，措辞要「写给模型看」（这部分内容第 11 章会正式展开）。

## 六、实现代码

### 新增工具消息

**`src/messages.ts`**——新增两种消息：

```ts
export interface AssistantMessage {
  role: "assistant";
  content: string;
  toolCalls?: ToolCall[];          // 新增：这次回复想要的动作
}

export interface ToolMessage {
  role: "tool";
  toolCallId: string;              // 认领哪次调用
  content: string;                 // 结果文本
}

export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;
```

### Provider层消息层扩展

**`src/model/openai.ts`**——`toWireMessages` 升级为按角色翻译，新增对工具消息的处理，关键的对比如下

![image.png](https://imgbed.ppai.top/file/1786618229708_image.png)

```ts
function toWireMessages(messages: Message[]): ChatCompletionMessageParam[] {
  return messages.map((m): ChatCompletionMessageParam => {
    switch (m.role) {
      case "assistant":
        return {
          role: "assistant",
          content: m.content,
          tool_calls: m.toolCalls?.map((call) => ({
            id: call.id,
            type: "function",
            function: { name: call.name, arguments: JSON.stringify(call.arguments) },
          })),
        };
      case "tool":
        return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
      default:
        return { role: m.role, content: m.content };
    }
  });
}
```

### 应用层工具消息回写

**`src/index.ts`**——`runToolCall` 升级为「执行 → 回写 → 再问」：

![image.png](https://imgbed.ppai.top/file/1786618375866_image.png)

```ts
const history = [...request.messages];

let response = await model.generate({ messages: history, tools: Object.values(tools) });

if (response.toolCalls.length > 0) {
  history.push(assistantMessage(response.content, response.toolCalls));

  for (const call of response.toolCalls) {
    console.log(`  ${call.name}(${JSON.stringify(call.arguments)})`);
    const tool = tools[call.name];
    const result = tool ? await tool.execute(call.arguments) : { error: `未知工具：${call.name}` };
    console.log(`Result  : ${JSON.stringify(result)}`);

    history.push(toolMessage(call.id, JSON.stringify(result) ?? ""));   // 回写工作记忆
  }

  response = await model.generate({ messages: history });               // 带着结果再问一次
}

console.log(`Answer  : ${response.content}`);
```

看这三步：**提议进历史（assistant+tool_calls）→ 结果进历史（tool）→ 模型看着完整历史回答**。循环的骨架已经成形，只是还写死成「只走一遍」。

## 七、运行 Demo

接下来进入正题，正确的使用姿势如下：

```bash
pnpm dev -- --tools "17 乘以 38 等于多少？"   # 经典：提议 → 执行 → 回传 → 回答
pnpm dev -- --tools "(1 + 2) * 3 是多少？"   # 换表达式
pnpm dev -- --tools "你好"                   # 对照：不需要工具 → 直接回答
```

![image.png](https://imgbed.ppai.top/file/1786618501469_image.png)


可以打印 `history` 看看循环结束时模型「看见」了什么，下面是一个执行过程

```
PS D:\Workspace\hui\project\hello-harness> pnpm dev -- --tools "17 乘以 38 等于多少？"

> hello-harness@0.1.0 dev D:\Workspace\hui\project\hello-harness
> node --import tsx --env-file-if-exists=.env src/index.ts "--tools" "17 乘以 38 等于多少？"

ToolCall :
  calculator({"expression":"17 * 38"})
Result  : {"value":646}
Answer  : 17 × 38 = 646。
Model  : deepseek-ai/DeepSeek-V4-Flash · 3398ms · 179 in / 16 out

--------- 打印history ---------------
[
  { role: 'system', content: '你是一个简洁、直接的中文助手，工具可以使用时必须调用工具' },
  { role: 'user', content: '17 乘以 38 等于多少？' },
  {
    role: 'assistant',
    content: '17 × 38 = 646。',
    toolCalls: [ [Object] ]
  },
  {
    role: 'tool',
    toolCallId: '019ffac43305555508a238ac8e3c74e8',
    content: '{"value":646}'
  }
]
```

![image.png](https://imgbed.ppai.top/file/1786618654867_image.png)



> 提示：感兴趣的小伙伴，结果回传后若模型仍想调用工具（比如连环计算），本章代码只会打印文本——「循环不止跑一遍」正是下一章的主题。 同样的网络受限的小伙伴用 mock 或 `$env:HTTPS_PROXY`。

## 八、新架构解决了什么？

- **模型第一次「看见」结果**：执行完工具后模型能基于真实数据作答，幻觉的关键来源之一被掐掉；
- **工作记忆建立**：`messages` 成为任务上下文，多步推理有了承载；
- **循环闭环成形**：提议 → 执行 → 回写 → 再问，Agent 的最基本节律诞生；
- **消息类型自洽**：四种消息 + 按角色翻译，`Model` 接口零改动（改的只是 wire 翻译层）。

## 九、它又引入了什么问题？

闭环虽然接通了，可为啥它还像个一次性开关、转不动第二圈？循环闭环了，但它是**僵的**：

- **只走一遍就停**：`if (response.toolCalls.length > 0)` 只处理一轮——连环计算（先算 1+2 再算 ×3）走不完；
- **没有停止条件**：什么时候算「完成」？现在靠直觉（「没 tool_call 就算完成」），但没人把这个直觉写成规则；
- **结果措辞是裸 JSON**：`{"value":646}` 直接扔给模型，格式好、但可读性差——模型读得懂，人可读不懂；
- **没有异常处理**：工具抛异常（网络错误、权限拒绝）时，历史里只有空结果，模型无法区分「算不出」和「算错了」；
- **上下文会膨胀**：结果越长，`messages` 越肥，迟早撞上上下文窗口上限——上下文管理问题已经浮出水面。

## 十、下一章

**08 · 第一个 Agent Loop**——把「只走一遍」改成「循环到完」：

```ts
while (true) {
  const response = await model.generate({ messages, tools });

  messages.push(response.message);

  if (!response.toolCalls?.length) {
    return response.text;     // 没有动作 → 任务完成
  }

  // 执行工具、回写结果……
}
```

这是整套教程**最标志性的一篇**：代码 30～50 行，却把一个「问答程序」变成了一个真正意义上**会自己干活直到干完**的 Agent。而它的停止条件——什么时候该停下来——顺理成章成为下一篇的主角。

那么问题来了——「只走一遍」怎么改成「循环到完」？循环里谁来喊停、靠什么条件判断任务结束？结果要是连环出现，上下文越堆越长又该怎么收？

以上这些问题，留在下一篇逐一介绍，这一章的重心放在工具执行的回传大模型。

最后请再看一眼 `Answer  : 17 × 38 = 646` 再看一眼：这条回答，是模型**基于你替它拿到的事实**说出来的，而不是凭空编的。

欢迎点赞、关注公众号「一灰灰Blog」，下一章我们让这个循环转起来 😊

---

微信公众号: 一灰灰Blog