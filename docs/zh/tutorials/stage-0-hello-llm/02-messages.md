---
title: "02 · Messages 是什么"
description: "理解 system / user / assistant 三种消息，定义 Message 类型。"
gitTag: "v02-messages"
stage: 0
---

# 02 · Messages 是什么

> <span class="stage-badge">Stage Hello LLM</span> · <span class="tag-badge">v02-messages</span>

![fch2U5lBk.jpeg](https://imgbed.ppai.top/file/1786959606026_fch2U5lBk.jpeg)

上一章咱们终于把「一句话 → 一段文」跑通了。但细心的你肯定已经发现一个不对劲的地方：[01 章末尾](./01-first-model-call)，SDK 逼着我们传了一个叫 `messages` 的数组——那玩意儿到底是什么？里面的 `role`、`content` 又有什么讲究？

这一章，咱们把 SDK 的「魔法数组」正式接管成**自己的类型**，并且顺手让模型学会「记得上下文」。

<!-- more -->

## 一、上一版存在什么问题？

01 章的代码里，消息是这样写的：

```ts
const completion = await client.chat.completions.create({
  model,
  messages: [
    { role: "system", content: "你是一个简洁、直接的中文助手。" },
    { role: "user", content: input },
  ],
});
```

它有三宗罪：

1. **没有类型**：`messages` 就是一堆 `{ role, content }` 对象字面量，写错角色名（比如把 `"system"` 写成 `"System"`）编译器根本拦不住，得等请求发出去了模型才给你脸色看；
2. **角色语义不明**：`system`、`user`、`assistant` 各是什么、谁该出现谁不该出现，代码里没有任何解释，全靠记忆；
3. **无法累积上下文**：每次请求都重新拼一遍数组。模型答完就忘，第二句话问它「刚才那是什么？」——它完全不记得。**多轮对话 = 记忆丧失。**

> 换句话说：上一版的消息数组是「一次性餐具」，用完就扔；而真正的对话需要的是「记得你吃过什么的盘子」。

## 二、本篇解决什么问题？

1. 讲清楚模型眼中的三种消息：**system / user / assistant**；
2. 把它们收敛成一个类型安全的判别联合：`type Message = SystemMessage | UserMessage | AssistantMessage`；
3. 用这个类型驱动一次**多轮对话**：把 assistant 的回答回写进历史，让第二轮的模型「记得」第一轮说了什么。

## 三、先看最终效果

![image.png](https://imgbed.ppai.top/file/1786596513728_image.png)

```bash
PS D:\Workspace\hui\project\hello-harness> pnpm dev -- "用一句话介绍你自己"

> hello-harness@0.1.0 dev D:\Workspace\hui\project\hello-harness
> node --import tsx --env-file-if-exists=.env src/index.ts "用一句话介绍你自己"

User   : 用一句话介绍你自己
Output : 我是DeepSeek，一个由深度求索公司打造的简洁、直接的中文AI助手。
Model  : deepseek-ai/DeepSeek-V4-Flash · 4004ms

User   : 把上一句概括成不超过 5 个字
Output : 我简洁直接
Model  : deepseek-ai/DeepSeek-V4-Flash · 59554ms

--- 完整对话历史 ---
[system] 你是一个简洁、直接的中文助手。
[user] 用一句话介绍你自己
[assistant] 我是DeepSeek，一个由深度求索公司打造的简洁、直接的中文AI助手。
[user] 把上一句概括成不超过 5 个字
[assistant] 我简洁直接
```

注意第二轮的模型**知道**自己第一轮说了什么——它把「那一段话」压缩成了五个字。这就是上下文累积，而它完全靠 `messages` 数组实现。

## 四、架构变化

`src/` 里多了一个新成员，职责也分开了：

```text
src/
├── messages.ts      # 新增：Message 类型与构造器
└── index.ts         # 改造：用 Message[] 驱动多轮对话
```

| 文件 | 职责 |
| --- | --- |
| `messages.ts` | 定义「消息」这个数据结构的**形状** |
| `index.ts` | 负责**组装、累积、发送**消息 |

这是整个教程第一次出现「数据结构文件」，也是未来 `src/model/` 目录的雏形——类型先行，逻辑后置。

## 五、核心抽象

核心就一句话：**模型不认字符串，只认带角色的消息序列。**

三种角色，各司其职：

| 角色 | 含义 | 谁来写 |
| --- | --- | --- |
| `system` | 设定模型的行为边界与人格（「你是简洁的中文助手」） | 开发者 |
| `user` | 用户说的话、提出的请求 | 用户 |
| `assistant` | 模型自己的回复（会被**回写**进历史，形成上下文） | 模型 |

消息序列的顺序就是时间线：`system` 在最前，之后是 `user / assistant` 交替。

对应到 TypeScript，我们用**判别联合（Discriminated Union）**来表达——`role` 是判别字段：

```ts
type Message =
  | SystemMessage
  | UserMessage
  | AssistantMessage;
```

为什么用判别联合而不是一个大接口？因为它带来两个免费的好处：

1. **穷举检查**：`switch (message.role)` 时漏掉某个角色，编译器直接报错；
2. **类型收窄**：一旦 `message.role === "user"`，编译器就知道剩下 `content`，不需要任何类型断言。

## 六、实现代码

**`src/messages.ts`** —— 全部就这些：

```ts
export type Role = "system" | "user" | "assistant";

export interface SystemMessage {
  role: "system";
  content: string;
}

export interface UserMessage {
  role: "user";
  content: string;
}

export interface AssistantMessage {
  role: "assistant";
  content: string;
}

export type Message = SystemMessage | UserMessage | AssistantMessage;

export function systemMessage(content: string): SystemMessage {
  return { role: "system", content };
}

export function userMessage(content: string): UserMessage {
  return { role: "user", content };
}

export function assistantMessage(content: string): AssistantMessage {
  return { role: "assistant", content };
}
```

三个构造器不是炫技——它们让「创建消息」这件事不会把 `role` 写错，也算初版的类型安全防护。

**`src/index.ts`** 核心的改造对比可参见 [Commit e8407b5
](https://github.com/liuyueyi/hello-harness/commit/e8407b5542572d2b5f90e59c6c6c8ffc848e3f89) ， 对比截图如下

关键变化，是把请求拆成一个 `chat()` 函数，并维护一条可累积的 `history`：

![image.png](https://imgbed.ppai.top/file/1786597265255_image.png)

```ts
async function chat(messages: Message[]): Promise<AssistantMessage> {
  const completion = await client.chat.completions.create({
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });
  const content = completion.choices[0]?.message.content ?? "";
  return assistantMessage(content);          // 返回的不再是字符串，而是一条 assistant 消息
}

async function main() {
  const firstQuestion = process.argv[2] ?? "用一句话介绍你自己";

  const history: Message[] = [
    systemMessage("你是一个简洁、直接的中文助手。"),
  ];

  const questions = [firstQuestion, "把上一句概括成不超过 5 个字"];

  for (const question of questions) {
    history.push(userMessage(question));     // 1. 追加本轮提问
    const reply = await chat(history);       // 2. 带着全部历史去问
    history.push(reply);                     // 3. 把模型回答回写进历史
  }
}
```

核心就三步：**追加提问 → 携历史请求 → 回写回答**。模型「记住」上下文，靠的就是这第三条——assistant 消息被放回了下一次请求的 `messages` 里。

## 七、运行 Demo

```bash
pnpm dev                          # 内置两轮对话
pnpm dev -- "帮我起个干货知识类的公众号名字"    # 换第一轮的问题
```


如我本机执行结果如下：

![image.png](https://imgbed.ppai.top/file/1786597558652_image.png)

你可以自己验证「上下文记忆」：把第二轮的提问从「把上一句概括成不超过 5 个字」换成「**我上一句说了什么？**」——如果模型答得出，说明 assistant 消息确实被送进了历史。

网络受限时照旧配置代理：

```bash
$env:HTTPS_PROXY = "http://127.0.0.1:端口"   # PowerShell
```

看完 `--- 完整对话历史 ---` 那一段，你就彻底看懂了模型视角下的「对话」。

## 八、新架构解决了什么？

- **输入从「字符串」升级为「结构」**：三种角色语义明确，代码自解释；
- **类型安全**：角色拼写错误、漏掉分支，编译期直接拦下；
- **上下文累积**：assistant 回写让多轮对话成为可能，模型不再「金鱼记忆」；
- **边界初现**：`messages.ts` 是第一个「数据形状」文件，为后续 Context / Provider 抽象划出了生长点；
- **埋下伏笔**：这个 `history` 数组，就是未来「Context」（第 11 章）的最原始形态。

## 九、它又引入了什么问题？

结构有了，问题也跟着升级：

- **`content` 还只能是纯文本**：真实世界里消息要装工具调用结果、错误、甚至图片，一个 `string` 装不下；
- **没有「管理者」**：`history` 目前就是一段裸数组，谁 push、谁回写、变长了怎么办、要不要裁剪/压缩，全靠 `main()` 里的手动代码。这不是可以长期生长的形状；
- **还是没有流式**：模型憋一口气全吐出来，用户体验和 token 到账速度都感人；
- **更尖锐的**：`chat()` 已经长出了「通用调用」的味道，但它仍然**长在 `index.ts` 里、绑着 OpenAI 的形状**——如果哪天想换成别的 Provider 风格，得拆。

最大的矛盾：**消息有了类型，但「怎么送进去」和「怎么回来」还是一片散装代码**——尤其是「回来」这条路，现在只有憋一口气这一种走法。

## 十、下一章

**03 · Streaming**——《Hello Harness 03：让 token 流起来》。模型吐字是一个字一个字来的，而我们现在是等它全吐完才收到。我们要把它变成：

```ts
AsyncIterable<ModelEvent>
```

让第一个 token 在几百毫秒内就到手，边生成边看到字。这是「可观察性」的第二次露面，也是进入真实 Agent 体验前最重要的一课。

好了，本章就到这里。看懂了「角色 + 序列 = 对话」，你就掌握了和模型沟通的基本语法。欢迎点赞、关注公众号「一灰灰Blog」，咱们下一章接着上菜 😊

---

微信公众号: 一灰灰Blog
