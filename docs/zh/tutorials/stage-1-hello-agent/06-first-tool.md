---
title: "06 · 第一个 Tool"
description: "实现第一个 Tool（calculator），定义 Tool 接口：name、description、parameters、execute。"
gitTag: "v06-tool"
stage: 1
---

# 06 · 第一个 Tool

> <span class="stage-badge">Stage Hello Agent</span> · <span class="tag-badge">v06-tool</span>

![cover](https://imgbed.ppai.top/file/1786956562535_fchpiR9sD.jpeg)

上一章，小伙伴拿到了模型的 `ToolCall`——它说「我想调 `get_weather`」。但当时我们对着空气手舞足蹈：**只有说明书，没有执行者**。

这一章，我们把说明书和执行力焊在一起，造出整个系列的**第一个有身体的 Tool**。老朋友 `calculator` 登场。

<!-- more -->

## 一、上一版存在什么问题？

回看 05 章的 `--tools`：

```bash
$ pnpm dev -- --tools "北京今天天气怎么样？"
ToolCall :
  get_weather({"city":"北京"})
```

它正确地产出了动作意图——**然后呢？** 没有然后。

- `weatherTool` 只是一个「说明书」（`ToolDefinition`），`execute` 无处安放；
- 说明书散落在 `index.ts` 里，没有和实现**长在一起**；
- 最关键的是：**模型的「想」和真实世界的「做」之间，还没有桥**。

> 换句话说：上一版的模型是个**只会点菜、没人炒菜的餐厅**。菜单写得很漂亮（description / parameters），后厨却是空的。

## 二、本篇解决什么问题？

1. 定义 `interface Tool`：**声明（说明书） + 执行力（execute）合体**；
2. 实现第一个真实工具 **`calculator`**：能真的算出 `17 × 38 = 646`；
3. 拿到 `ToolCall` 后，**按名查表、真正执行、打印结果**——第一次完成「模型提议 → 我们动手」的闭环（执行权还在我们手里）。

解决完上面三件事，咱们回过头把这条线串一下：**上一章留下的「只有说明书、没有执行者，模型的想和真实世界的做之间没桥」这些遗留问题 → 这一章用「Tool 接口 + calculator 实现 + 按名查表执行」解决掉 → 接下来看看我们到底得到了什么收获。**

### 解决之后，我们收获了什么？

- **「想」与「做」第一次接通**：`ToolCall` 落到了 `execute` 上，模型的意图真正变成了世界里的 `646`；
- **声明与实现同居一处**：`name/description/parameters/execute` 长在同一个对象里，改一处即可同步，再也不会「说明书满天飞、实现找不到」；
- **安全边界显性化**：`execute` 只归应用层，输入过了白名单和结果校验才敢算，危险输入当场被拦；
- **结构可扩展**：加工具只是 `Record` 里多一行，为第 10 章的 Registry 攒下了原型。

> 一句话收个尾：遗留的「只有说明书、没有执行力」问题被这一章的 `Tool` 解决掉，换来的则是「能执行、声明实现合一、可控、可扩展」四笔实实在在的收获——这就是「遗留问题 → 解决问题 → 得到收获」的闭环。

## 三、先看最终效果

```bash
PS D:\Workspace\hui\project\hello-harness> pnpm dev -- --tools "17 乘以 38 等于多少？"

> hello-harness@0.1.0 dev D:\Workspace\hui\project\hello-harness
> node --import tsx --env-file-if-exists=.env src/index.ts "--tools" "17 乘以 38 等于多少？"

ToolCall :
  calculator({"expression":"17 * 38"})
Result  : {"value":646}
Model  : deepseek-ai/DeepSeek-V4-Flash · 4458ms · 405 in / 125 out
```

看最后两行：模型**提议**调用 `calculator`，我们把 `ToolCall.arguments` 喂给 `tool.execute()`，得到真实的 `646`。

再试试危险输入，看我们的工具怎么守门：

```ts
await calculator.execute({ expression: "rm -rf" })   // → { error: "表达式包含非法字符：rm -rf" }
await calculator.execute({ expression: "1/0" })      // → { error: "表达式无法计算为数值：1/0" }
```

工具不再是「嘴上的承诺」，而是「手头的功夫」——而且这双手**懂规矩**。

## 四、架构变化

`src/` 下长出 `tool/` 目录：

```text
src/
├── messages.ts
├── events.ts
├── index.ts
├── model/          # 不变：模型与 SDK 解耦
└── tool/           # 新增：能力层
    ├── tool.ts        # interface Tool
    └── calculator.ts  # 第一个真实工具
```

![image.png](https://imgbed.ppai.top/file/1786614485872_image.png)

| 文件 | 职责 |
| --- | --- |
| `tool/tool.ts` | `interface Tool`：能力契约（声明 + 执行） |
| `tool/calculator.ts` | 第一个实现：数学表达式计算 |
| `index.ts` | 一个极简的 `Record<string, Tool>` 查表 + 执行 |

注意：这里故意**不**做花哨的注册机制——一个 `Record` 就够。真正的 `Tool Registry` 是第 10 章的事，现在还不需要。

## 五、核心抽象

### Tool：声明与执行合体

```ts
interface Tool extends ToolDefinition {
  execute(input: unknown): Promise<unknown>;
}
```

`ToolDefinition` 是 05 章的「说明书」（`name` / `description` / `parameters`），`Tool` 给它补上灵魂 `execute`：

| 字段 | 谁在用 | 作用 |
| --- | --- | --- |
| `name` | 模型 | 在 `ToolCall` 里指名道姓 |
| `description` | 模型 | 决定「什么时候该调用我」 |
| `parameters` | 模型 | 知道「入参长什么样」 |
| `execute` | **应用层** | 真正干活——**模型永远摸不到它，它是由应用层自己来决定执行与否的** |

**重点关注**：这个划分是整个 Tool 体系最优雅的一点：

> **模型只见过工具的「脸」（声明），永远摸不到工具的「手」（execute）。**
>
> 声明给模型看，实现给代码用——两边各取所需，安全边界自动形成。

### 为什么 `execute` 返回 `unknown`

工具的产出千奇百怪：可能是 `{ value: 646 }`，可能是 `{ error: ... }`，将来还可能是文件内容、Git 输出、HTML。**让每个工具自己定义返回结构**，比造一个万能 `ToolResult` 更有弹性——至于要不要统一结果类型，是第 07 章的话题。

### 工具为什么需要守门

`calculator` 用 `eval` 求值——这是**演示用**的妥协。真实生产绝不允许拿不可信输入直接 `eval`。于是我们至少做两件事：

1. **白名单校验**：表达式只允许数字和运算符，出现别的字符直接拒绝；
2. **结果校验**：算出来不是有限数值（如 `1/0`）就报错。

> 牢记 AGENTS.md 的安全规则：**有副作用的操作必须受控**。宁可拒绝，不可冒险。这一课，后面每一章都会以更严肃的方式重演。

## 六、实现代码

### 工具契约实现

我们定义一个统一的工具契约层，所有的工具都需要实现它，这样就可以更方便的实现工具扩展、加载

**`src/tool/tool.ts`**：

```ts
import type { ToolDefinition } from "../model/types";

export interface Tool extends ToolDefinition {
  execute(input: unknown): Promise<unknown>;
}
```

### 一个真实的计算器工具实现

**`src/tool/calculator.ts`**：

```ts
const SAFE_EXPRESSION = /^[\d+\-*/().%\s]+$/;   // 白名单：只允许数字和运算符

export const calculator: Tool = {
  name: "calculator",
  description: "计算数学表达式，支持加减乘除、括号与取模",
  parameters: {
    type: "object",
    properties: {
      expression: { type: "string", description: "数学表达式，例如：17 * 38" },
    },
    required: ["expression"],
  },
  async execute(input: unknown) {
    const { expression } = input as { expression?: unknown };
    if (typeof expression !== "string" || expression.trim() === "") {
      return { error: "参数 expression 必须是字符串" };
    }
    if (!SAFE_EXPRESSION.test(expression)) {
      return { error: `表达式包含非法字符：${expression}` };
    }

    try {
      const value = Function(`"use strict"; return (${expression})`)();
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return { error: `表达式无法计算为数值：${expression}` };
      }
      return { value };
    } catch {
      return { error: `表达式非法：${expression}` };
    }
  },
};
```

三行守卫各守一道门：**类型不对 → 拒；字符越界 → 拒；算不出数 → 拒**。然后把干净的 `{ value }` 或 `{ error }` 交出去。

### 应用层工具执行实现

**`src/index.ts`**——查表与执行，一共十几行：

- 首先是维护上工具表： name -> 工具
- 大模型返回工具调用时：
  - 根据 name -> 定位工具
  - 写入传参 -> 执行工具调用 
  - 返回结果

```ts
const tools: Record<string, Tool> = {
  calculator,
};

for (const call of response.toolCalls) {
  console.log(`  ${call.name}(${JSON.stringify(call.arguments)})`);
  const tool = tools[call.name];
  if (!tool) {
    console.log("    → 未知工具，无法执行");
    continue;
  }
  const result = await tool.execute(call.arguments);
  console.log(`Result  : ${JSON.stringify(result)}`);
}
```

`tools[name]` 找不到就报「未知工具」——模型偶尔会编出我们没注册的工具名，这里天然兜底。

## 七、运行 Demo

接下来进入正题，正确的使用姿势如下：

```bash
pnpm dev -- --tools "17 乘以 38 等于多少？"   # 计算：模型提议 → 工具执行 → 真实结果
pnpm dev -- --tools "(1 + 2) * 3 是多少？"   # 换表达式，观察参数随问随变
pnpm dev -- --tools "写一首小诗"             # 对照：不需要工具的问题 → 模型直接回答
```

![image.png](https://imgbed.ppai.top/file/1786614958391_image.png)

重点看下上面的真实执行情况，我们会发现 第二个 ` "(1 + 2) * 3 是多少？"` 调用，没有调用工具，这也是非常经典的一个问题场景，虽然你注册了工具，但是大模型可能不会执行你的工具、或者执行错了工具（这也同样是每个做Agent开发的小伙伴不得不解决的问题）

再直接测守卫（不经过模型，绕过网络）：

```bash
node --import tsx -e "import { calculator } from './src/tool/calculator.ts';
console.log(await calculator.execute({ expression: 'rm -rf' }));"
# → { error: '表达式包含非法字符：rm -rf' }
```

> 提示：感兴趣的小伙伴，`--tools` 模式下如果模型直接回答了（没调用工具），说明它认为问题不需要工具——多换几个算术问法即可。网络受限用本地 mock 或 `$env:HTTPS_PROXY`。

## 八、新架构解决了什么？

- **「想」与「做」接通**：`ToolCall` 落到了 `execute` 上，模型意图第一次转化为真实结果；
- **声明与实现同居**：`name/description/parameters/execute` 长在同一个对象里，改一处即可同步；
- **安全边界显性化**：`execute` 只归应用层调用，输入经过白名单与结果校验；
- **结构可扩展**：`Record<string, Tool>` 加工具只是多一行注册，为第 10 章的 Registry 攒下了原型；
- **未知工具兜底**：模型编造工具名时，代码明确说「无法执行」，而不是静默出错。

## 九、它又引入了什么问题？

现在给大模型添加了触手，第一次让模型「通过我们的手」做一些事，有好处当然也会带来新的问题，那么新的坑又埋在哪了？

- **只执行了一次**：拿到结果就结束了，**没有把结果喂回给模型**——模型不知道 `646` 算出来了，它只知道自己「提议过」；
- **对话断线了**：`calculator` 的结果没有进入 `messages`，模型对前面的对话「失忆」，多步任务无法连续；
- **`ToolResult` 没有一个统一形状**：`{ value }`、`{ error }` 全凭自觉，将来程序要「读懂」结果时靠什么区分成功与失败？
- **参数校验是手写的**：每个工具都要自己写「类型对不对」的判断，`parameters` 明明已经是 JSON Schema——**用 Schema 自动校验**的诱惑已经出现；
- **执行是串行硬编码的**：两个 ToolCall 就得手写两个 `await`，还都是「一次就停」。

## 十、下一章

**07 · Tool Result**——把这一章欠下的「回传」补上，建立真正的完整循环：

```text
User → LLM → Tool Call → Tool → Tool Result → LLM → Answer
```

核心动作只有一个：**把工具的执行结果写成 `tool` 消息、push 回 `messages`，再让模型看一眼**。从下一章起，「一次问答」将变成「一个能连续干活的循环」——Agent 的真正形态，就差最后一脚。

要实现结果回传，那么新的问题就来了——结果写回 `messages` 时该用什么角色？模型看到 `tool` 消息后会不会又想调一次工具、陷入死循环？`{ value }` 和 `{ error }` 不统一，程序又该怎么判断成功还是失败？

以上这些问题，下一篇我们将逐一介绍。ok，本章就到这里结束。

请阅读到这里的小伙伴，不妨亲手算一遍 `17 × 38`，然后盯着 `Result  : {"value":646}` 想十秒钟：这是模型这辈子第一次**通过你的手**触摸向了真实世界，那么它除了计算之外，还能干些什么呢？

欢迎点赞、关注公众号「一灰灰Blog」，下一章我们让模型看见结果 😊

---

微信公众号: 一灰灰Blog