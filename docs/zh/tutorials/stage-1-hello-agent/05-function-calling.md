---
title: "05 · Function Calling"
description: "让模型第一次产生结构化动作 ToolCall。"
gitTag: "v05-tool-call"
stage: 1
---

# 05 · Function Calling

> <span class="stage-badge">Stage Hello Agent</span> · <span class="tag-badge">v05-tool-call</span>

![fch4znyta.jpeg](https://imgbed.ppai.top/file/1786960205875_fch4znyta.jpeg)

Stage 0 结束，一路跟随执行过来的小伙伴手里就会有一个会说会写（流式）的模型接口。但此刻的它，本质上还是一个**加强版翻译器**：输入一句话，输出一段话。

这一章，我们按下整个系列的第一个「动作」开关——让模型的输出不再是文本，而是**结构化的动作指令**。

<!-- more -->

## 一、上一版存在什么问题？

让模型回答「北京今天天气怎么样？」，它是怎么做的？

```bash
$ pnpm dev -- --full "北京今天天气怎么样？"
Output : 北京今天的天气为晴，气温 25℃，空气质量优，适宜出行……
```

看起来像模像样，**但是假的**。模型训练时见过类似文字，于是照着编了一段——它既没查过任何天气数据，也不具备任何感知能力。这在 AI 界有个著名的说法：**幻觉（Hallucination）**。

更深一层的问题在于：**模型只会「说」，不会「做」**。

| 场景 | 模型的表现 |
| --- | --- |
| 查天气 | 一本正经地编一个 |
| 算 17 × 38 | 可能算错，还说得很自信 |
| 帮我读某个文件 | 「我无法直接读取文件，请打开后复制给我」 |

模型有语言能力、有世界知识，但它的输出通道只有一条：**文本**。它想做任何事，都只能「建议你去做」，然后干瞪眼。

> 换句话说：上一版的模型是一个**只会表达、不会行动的绅士**。你让它去买杯咖啡，它能写一篇关于咖啡的散文，但杯子不会自己出现在桌上。

## 二、本篇解决什么问题？

1. 让模型的输出从「文本」扩展为「**动作**」：输出一个结构化的 `ToolCall`；
2. 通过 `tools` 参数，把「你有什么能力、每个能力长什么样」**声明**给模型；
3. 引入 `ToolCall` / `ToolDefinition` 类型，把线格式(Wire Format)翻译成结构化数据(Structured Data)。

这三件事串起来，正是应用层最该想清楚的一句：**工具不是模型自带的，是你这个应用「定义」出来、再通过请求「递」给模型的**。你递什么，模型才知道自己能干什么——这也正是本章要反复讲到的「应用层告知模型」模式。

解决完上面三件事，咱们回过头把这条线串一下：**上一章留下的「模型只会说、不会做，遇事只能编（幻觉）」这些遗留问题 → 这一章用「ToolCall + ToolDefinition + tools 声明」解决掉 → 接下来看看我们到底得到了什么收获。**

### 解决之后，我们收获了什么？

- **输出通道从一条变两条**：文本（说话）+ 动作（动手），模型的表达能力质变——它终于能「做」而不只是「说」；
- **动作是结构化的**：`name` + 结构化 `arguments`，代码能可靠解析，不用在自然语言里碰运气；
- **能力可声明**：`tools` 是模型的「能力清单」，模型按需自选，而不是只靠提示词碰运气；
- **执行权牢牢留在应用层**：模型只能「提议」、不能「执行」，安全边界从第一天就立住了——这是后面整个 Agent 的安全基石。

> 一句话收个尾：遗留的「只会说不会做」问题被这一章的抽象解决掉，换来的则是「会动、可解析、可声明、可控」四笔实实在在的收获——这就是「遗留问题 → 解决问题 → 得到收获」的闭环。

## 三、先看最终效果

这次我们不问「你好」，问一个必须查资料才能回答的问题，并声明一个工具：

```bash
PS D:\Workspace\hui\project\hello-harness> pnpm dev -- --tools "北京今天天气怎么样？"

> hello-harness@0.1.0 dev D:\Workspace\hui\project\hello-harness
> node --import tsx --env-file-if-exists=.env src/index.ts "--tools" "北京今天天气怎么样？"

ToolCall :
  get_weather({"city":"北京"})
Model  : deepseek-ai/DeepSeek-V4-Flash · 1828ms · 381 in / 75 out
```

注意看：**模型没有回答**。它返回的不是一段文字，而是一条**结构化指令**：

```json
{
  "id": "call_abc123",
  "name": "get_weather",
  "arguments": { "city": "北京" }
}
```

翻译成人话：**「我想调用 get_weather 这个函数，入参是 city=北京」**。模型不执行任何东西——它只是明确表达了自己的意图。执行权在谁手里？在我们手里。

![image.png](https://imgbed.ppai.top/file/1786609501334_image.png)

## 四、架构变化

`model/types.ts` 扩展了请求与响应契约：

```text
ModelRequest   +tools?            # 声明能力
ModelResponse  +toolCalls         # 模型的动作意图
```

```ts
interface ModelRequest {
  messages: Message[];
  tools?: ToolDefinition[];       // 新增：本次会话可用的工具声明
}

interface ModelResponse {
  content: string;
  toolCalls: ToolCall[];          // 新增：模型想调用的动作
  inputTokens: number;
  outputTokens: number;
}
```

`openai.ts` 负责两条线格式翻译：**我们的 `ToolDefinition[]` → SDK 的 `tools`，SDK 的 `message.tool_calls` → 我们的 `ToolCall[]`**。应用层依旧看不见 SDK。

## 五、核心抽象

### ToolCall：模型的一句话「我要动手了」

```ts
interface ToolCall {
  id: string;          // 一次调用的唯一标识（后面追踪执行结果要认它）
  name: string;        // 想调用哪个工具
  arguments: unknown;  // 入参（结构化对象）
}
```

### ToolDefinition：给模型看的「能力说明书」

```ts
interface ToolDefinition {
  name: string;
  description: string;   // 告诉模型这个工具是干什么的——模型靠它决定何时调用
  parameters: unknown;   // 入参的 JSON Schema：每个字段、类型、必填
}
```

`description` 和 `parameters` 的价值被严重低估：**模型不读代码，它只读你的说明书**。说明书写得越清楚，模型调用就越准。这正是「用文本驯服概率」的体现。

**从应用层的视角看，定义并「告知」模型只需两步**：

第一步，写一个 `ToolDefinition`（就是上面这份说明书）；

第二步，把它塞进 `ModelRequest.tools`。这第二步就是「告诉模型」的全部动作——`tools` 会经 SDK 翻译成 `tools` 字段，一路送到模型面前。

模型本身并不知道世界上有 `get_weather`，是你这次请求把它「介绍」给了模型。换句话说：**能力不是模型自带的，是你这位应用层递过去的。**

### 最重要的心智模型：模型只会「提议」，不会「执行」

**重点关注**：这是 Function Calling 的安全基石，必须刻进脑子里：

> **模型的 `tool_calls` 只是「请求许可」，不是「已经执行」。**
> 它说自己调了 `get_weather`，不代表真的查了天气。
> 执行与否、执行前要不要向用户确认、权限够不够——**决定权永远在应用层**。

## 六、实现代码

**`src/model/types.ts`**：新增三个类型（见上）。

**`src/model/openai.ts`**——请求侧，把声明翻译成线格式：

```ts
function toWireTools(tools: ToolDefinition[]): ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as Record<string, unknown>,
    },
  }));
}
```

响应侧，把线格式翻译回我们的形状。注意 `arguments` 在线上是 **JSON 字符串**，我们在接口层就解析成结构，应用层拿到的永远是干净的对象：

```ts
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;          // 解析失败就保留原文，不假装成功
  }
}
```

```ts
toolCalls: (message?.tool_calls ?? [])
  .filter((call) => call.type === "function")
  .map((call): ToolCall => ({
    id: call.id,
    name: call.function.name,
    arguments: parseJson(call.function.arguments),
  })),
```

**`src/index.ts`**——声明一个「只有说明书、没有实现」的工具：

```ts
const weatherTool: ToolDefinition = {
  name: "get_weather",
  description: "查询指定城市的当前天气",
  parameters: {
    type: "object",
    properties: {
      city: { type: "string", description: "城市名，如：北京" },
    },
    required: ["city"],
  },
};
```

```ts
const response = await model.generate({ ...request, tools: [weatherTool] });

if (response.toolCalls.length > 0) {
  console.log("ToolCall :");
  for (const call of response.toolCalls) {
    console.log(`  ${call.name}(${JSON.stringify(call.arguments)})`);
  }
}
```

> **应用层视角**：上面这两段，就是「定义工具并告知模型」的完整动作。第一段你写下了 `get_weather` 的说明书（`ToolDefinition`）；第二段你把这份说明书随请求一起交给 `model.generate`。模型收到请求那一刻，才第一次「知道」自己手边有查天气的能力——至于调不调、怎么调，是它看完问题后的决定。小伙伴要记住：**你做的只是把能力摆上桌，按不按铃是模型的事。**

## 七、运行 Demo

接下来进入正题，正确的使用姿势如下：

```bash
pnpm dev -- --tools "北京今天天气怎么样？"   # 模型产出结构化 ToolCall
pnpm dev -- --tools "深圳明天会下雨吗？"     # 换城市，观察参数随问随变
pnpm dev -- --full "北京今天天气怎么样？"    # 对照：不声明工具 → 模型告诉你我不知道或者直接编结果
```

![image.png](https://imgbed.ppai.top/file/1786610044263_image.png)

三行命令跑完，感兴趣的小伙伴会清晰地看到「声明工具与否」的差别：**给了工具，模型就选择「行动」；没给工具，它只能「编」或者告诉你我无能为力**。

> 提示：真实 API 下模型可能偶尔直接返回一段文字（比如把问题理解偏了），多试几个问法即可；网络受限时用本地 OpenAI 兼容 mock 或配置 `$env:HTTPS_PROXY`。

## 八、新架构解决了什么？

- **输出通道从一条变两条**：文本（说话）+ 动作（动手），模型的表达能力质变；
- **动作是结构化的**：`name` + 结构化 `arguments`，代码可以**可靠地解析**，不用在自然语言里碰运气；
- **能力可声明**：`tools` 是模型的「能力清单」，模型按需自选，而不是只靠提示词碰运气；
- **执行权留在应用层**：模型只能「提议」，安全边界从第一天就立住了；
- **开启可组合的下一步**：工具调用将驱动出 Tool、Tool Result、Agent Loop——整个 Stage 1 的地基。

## 九、它又引入了什么问题？

那么问题来了——让模型学会「动手」之后，新的坑又埋在哪了？兴奋之余，问题也成串地来了：

- **「想调用」≠「调用成功」**：我们拿到了 `tool_calls`，但 `get_weather` 连个影子都没有——**只有提议，没人执行**；
- **参数可能不合法**：模型可能把城市名写成「BJ」、漏掉必填字段、甚至编一个不存在的工具名——**结构正确不等于语义正确**；
- **说明书与实现分居两地**：`weatherTool` 只有声明（说明书），真正的逻辑还没写，而且声明散落在 `index.ts`——它应该和实现**长在一起**；
- **流式下的 tool_call 还没处理**：`stream` 路径只输出 `content` 增量，模型在流式时想调用工具怎么办？——先欠着；
- **安全隐患浮现**：如果工具是「删除文件」「执行 Shell」，模型被诱导调用怎么办？——**权限与控制**从这一章开始成为主线问题。

## 十、下一章

**06 · 第一个 Tool**——给 `get_weather` 补上**真正的身体**：

```ts
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;

  execute(input: unknown): Promise<unknown>;   // 声明长在实现身边
}
```

到那时，「说明书」和「执行力」会合体成第一个完整的 `Tool`（顺带我们会认识一个老朋友 `calculator`），并且正式回答上面第九节悬而未决的问题：**拿到了 `tool_calls`，下一步到底该干嘛？** 答案很明显，执行工具

那么问题来了——`Tool` 的 `execute` 该跑在哪个进程里？模型编出一个不存在的工具名时谁来拦？流式下的工具调用又该怎么边到边处理？

以上这些问题，留在下一篇逐一介绍，本章就到这里。请有条件的小伙伴务必亲自跑一遍 `--tools` 并感受「模型选择行动而非编造」的那一刻——那是 Agent 路上的第一缕光。欢迎点赞、关注公众号「一灰灰Blog」，下一章我们给工具装上身体 😊

---

微信公众号: 一灰灰Blog