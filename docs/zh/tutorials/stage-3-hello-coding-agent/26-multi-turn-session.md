---
title: "26 · Multi-turn Session"
description: "把多轮对话正式化为 Session：一个带 id 的 AgentContext，跨轮持有对话历史与工具上下文，为下一章的落盘续跑做准备。"
gitTag: "v26-session"
stage: 3
---

# 26 · Multi-turn Session

> <span class="stage-badge">Stage Hello Coding Agent</span> · <span class="tag-badge">v26-session</span>

![fdcnVijtr.jpeg](https://imgbed.ppai.top/file/1787798287445_fdcnVijtr.jpeg)

第二十五章，我们把 Coding Agent 套上了产品壳——`hello "帮我修复这个项目"` 一条命令，`--dir` 打开任意项目，`--chat` 进多轮对话。修 bug 的转录里，它先 read、再 edit、最后 bash 跑 `npm test` 全过才交差。

但兄弟们，回头看看 `--chat` 的实现，那其实是 [ch19](./19-read-tool) 时代的**裸奔多轮**：一个局部 `history: Message[]` 数组，每轮手动拼 `[...history, userMessage(prompt)]` 再塞进 `runtime.run()`。它**没有身份**、**没有专属的上下文对象**、甚至**连 system prompt 都没带**。这一章，我们把「多轮对话」正式化为一个一等公民——**Session（会话）**。

<!-- more -->

## 一、上一版存在什么问题？

回看 ch22 引入、ch25 继续沿用的 `--chat`：

1. **多轮靠一个局部数组硬拼**：`history` 只是 `chat()` 函数里的一个 `Message[]`，每轮 `[...history, userMessage(prompt)]` 重新组装——**上下文不是被「持有」的，而是被「传来传去」的**；
2. **每一轮都从零造一个上下文**：`runtime.run()` 内部每次 `new AgentContext(request.messages)`——**「这一轮的 AgentContext」和「上一轮的 AgentContext」没有继承关系，只是消息列表长得像**；
3. **对话没有身份**：Session 是谁？没有 `id`，没有能指向「这场对话」的句柄——**你无法说「继续昨天的对话」，因为压根没有一个东西叫「昨天的对话」**；
4. **连 system prompt 都没带**：`chat()` 直接 `runtime.run({ messages: history })`，**ch24 立的方法论（先观察、再修改、再验证）在 `--chat` 里根本没生效**；
5. **上下文和对话生命周期绑死在 CLI 函数里**：`history` 随函数结束而消亡，**拿不出来、存不下、续不上**——下一章想落盘 `.sessions/`，连个可序列化的对象都没有。

> 一句话：**上一版的多轮是「行为上的多轮」，不是「结构上的多轮」——对话没有身份、上下文没有归属、历史存不下。它是个循环，不是个产品。**

## 二、本篇解决什么问题？

1. **引入 Session 抽象**：`Session { id, context }`——**一场对话 = 一个唯一 id + 一个被持有的 AgentContext**；
2. **上下文跨轮继承**：`runtime.runContext(context)` 让 Runtime 在**同一个 AgentContext 上连续运行**，每轮往同一个上下文追加消息，**而不是从零重建**；
3. **补上 system prompt**：`chat()` 创建 Session 时就用 `systemMessage(SYSTEM_PROMPT)` 播种，**ch24 的方法论第一次进入多轮对话**；
4. **对话有了身份**：启动时打印 `Session : <id>`，**你能指着这串 id 说「就是这场对话」**——这正是下一章 `.sessions/` 落盘、再下一章 `--resume` 续跑的钩子；
5. **为持久化铺路**：`Session.snapshot()` 一次性导出 `{ id, context }`，`restore()` 原样恢复——**「能导出」是「能存盘」的前提**。

核心心智模型：

> **Runtime 管「怎么跑一轮」，Session 管「这场对话是什么」。多轮不是把消息数组拼长，而是让同一个 AgentContext 在一场对话里持续生长——上下文是 Session 的财产，不是每次 run 的临时工。**

解决完上面五件事，把线串一下：**上一版「多轮靠局部数组、上下文每次重建、对话没身份、没 system prompt」这些遗留问题 → 这一章用「Session + runContext」解决 → 接下来看一个带 id 的 Session 怎么在两轮对话里连续修 bug、加功能。**

### 解决之后，我们收获了什么？

- **多轮有了结构**：`Session` 是对话的一等公民——`id` 给身份，`context` 给归属，**一场对话就是一个对象**；
- **上下文真的被继承了**：第二轮开跑时，上一轮修好的文件内容、跑过的测试、得出的结论**全在同一个 AgentContext 里**；
- **方法论生效了**：`--chat` 终于带着 [ch24](./24-system-prompt) 的 system prompt 上阵——**多轮对话里的 Coding Agent 也讲「先观察、再修改、再验证」**；
- **对话可以被指认**：`Session : <uuid>` 打印出来，**「这场对话」有了可指向的句柄**；
- **能导出就能落盘**：`snapshot()` / `restore()` 就位，**为 ch27 `.sessions/` 持久化和 ch28 `--resume` 铺好了路**。

> 一句话收个尾：遗留的「多轮靠数组硬拼、上下文每次重建、对话没身份」问题被这一章的 Session 解决掉，换来的则是「一场带 id、上下文持续生长的对话」——下一章就把它存进磁盘。

## 三、先看最终效果

还是 `examples/stage-3/25-cli/` 这个带 bug 的小项目（`factorial` 里 `n - 2` 写错了）。这一章我们用 `hello --chat` 开一场**两轮对话**：

- **第一轮**：修复 `factorial` 的 bug；
- **第二轮**：接着加一个 `divide` 函数和测试——**注意，第二轮没让模型重新读一遍项目历史，它直接接上第一轮的上下文干活**。

启动后第一行就是这场对话的身份：

```text
Hello Harness v1.0 · 流式多轮对话（输入 exit 退出，Ctrl+C 取消本轮）
Session : 5335818f-843a-4b1b-a0fd-55bc75093dc6
```

第一轮的真实转录（精简掉中间的思考流）：

```text


你 > 帮我修复这个项目里的 bug：src/calc.mjs 的 factorial 函数结果不对，请先观察、再修改、最后运行 npm test 验证
[run:start ] Run ID : f19a3b01-3d6d-4adb-bd99-ececf967347a
[run:start ] Input  : 帮我修复这个项目里的 bug：src/calc.mjs 的 factorial 函数结果不对，请先观察、再修改、最后运行 npm test 验证
[model:start] 思考中 …

[model:end ] 调用工具：read, bash · 1182 in / 146 out · 2360ms
Step 1 · model  → 调用工具：read, bash
[tool:start] read({"path":"src/calc.mjs"})
[tool:end  ] → "..." · 3ms
Step 2 · tool   → read({"path":"src/calc.mjs"}) = "export function add(a, b) {\n  return a + b;\n}\n\nexport function factorial(n) {\n  if (n <= 1) return 1;\n  return n * factorial(n - 2);\n}"
Step 3 · tool   → bash({"command":"find . -type f -name \"*.mjs\" -o -name \"*.js\" -o -name \"package.json\" | head -20"}) = {...}
[model:start] 思考中 …

## 省略过程推理

找到了！`factorial` 函数递归时错误地减了 2，应该减 1。现在修复：


[model:end ] 调用工具：edit · 1857 in / 195 out · 4177ms
Step 7 · model  → 调用工具：edit
[tool:start] edit({"path":"src/calc.mjs","oldString":"return n * factorial(n - 2);","newString":"return n * factorial(n - 1);"})
[tool:end  ] → "已替换 1 处：return n * factorial(n - 2); → return n * factorial(n - 1);（src/calc.mjs）" · 4ms

Step 9 · model  → 调用工具：bash
[tool:start] bash({"command":"npm test"})

Step 11 · model  → 完成回答
Step 12 · finish → finished
[run:end   ] completed (finished) · 15433ms
Answer  : 全部 3 个测试通过 ✅

**Bug 原因**：`factorial` 函数递归调用时写的是 `factorial(n - 2)`，导致跳过了中间的数（例如 `factorial(5)` 算成了 `5 * 3 * 1 = 15`）。改为 `factorial(n - 1)` 后恢复正常。
Steps   : 5 轮 · 13 条消息 · 12 步 · 15433ms
Tokens  : 8829 in / 702 out
Status  : completed (finished)
```

第二轮——**同一个 Session，接着修**：

```text
你 > 很好，现在再帮我加一个 divide 函数，并补充一条测试
[run:start ] Run ID : 5335818f-843a-4b1b-a0fd-55bc75093dc6
Step 2 · tool  → read({"path":"src/calc.mjs"}) = "... return n * factorial(n - 1); ..."  // 第一轮的修复还在
Step 4 · model → 调用工具：edit（追加 divide 函数）
Step 5 · tool  → [tool] 在 src/calc.mjs 中未找到 oldString  // CRLF 换行没匹配上，没关系，方法论教它重试
Step 12 · tool → write({"path":"src/calc.mjs","content":"... export function divide(a, b) { ... }"}) = "已写入"
Step 14 · tool → edit({"path":"test/calc.test.mjs", ...}) = "已替换 1 处"（导入 divide）
Step 16 · tool → edit({"path":"test/calc.test.mjs", ...}) = "已替换 1 处"（新增测试）
Step 18 · tool → bash({"command":"npm test"}) → pass 5 / fail 0
Status  : completed (finished)
```

注意第二轮的两个细节，这正是 Session 的功劳：

- **它记得第一轮把 `n - 2` 改成了 `n - 1`**——没让用户重讲一遍项目背景；
- 前面的测试用例，在这一轮中也没忘记。

## 四、架构变化

这一章加了一层薄薄的「会话层」，放在 Runtime 之上：

```text
        CLI（chat / runAgentDemo）
                  │
        ┌─────────┴──────────┐
        ▼                    ▼
     Session             AgentRuntime
   (id + context)        (run / runContext)
        │                    │
        └─────── 同一个 AgentContext ──────┘
                  │
               Model / Tools
```

**关键变化**：`AgentRuntime` 新增 `runContext(context)`——**在外部传入的 AgentContext 上运行一整轮**；旧的 `run(request)` 变成它的薄包装（从 `request.messages` 造一个临时上下文）。**上下文不再由 Runtime 内部每次新建，而是可以由 Session 持有、跨轮复用。**

目录结构：

```text
src/
  agent/
    runtime.ts      # + runContext(context)：在指定上下文上跑一轮
  session/
    session.ts      # + Session：id + AgentContext + turn() + snapshot()/restore()
  cli/
    chat.ts         # 改用 Session，补 system prompt，打印 Session id
    index.ts        # chat() 传入 SYSTEM_PROMPT
```

## 五、核心抽象

这一章只新增一个核心概念——**Session**：

```ts
interface Session {
  id: string;            // 一场对话的唯一身份
  context: AgentContext; // 这场对话持有的、持续生长的上下文
}
```

三个设计要点：

1. **id 是身份的锚点**：`randomUUID()` 生成，**对话可被指认、可被引用**——ch27 拿它当文件名，ch28 拿它当 resume 参数；
2. **context 是财产的归属**：上下文**从「run 的入参」变成「Session 的成员」**——多轮不靠数组拼接，靠**同一个 AgentContext 连续追加消息**；
3. **turn() 是对话的节拍**：`session.turn(runtime, prompt)` = 往 context 加一条 user 消息 → 在 context 上跑一轮 → 返回本轮 `AgentRun`。**一轮对话一个节拍，节拍之间上下文保持生长。**

同时给 `AgentContext` 补齐一对「快照」能力（其实 ch19 就有）：

- `snapshot()` → `{ messages }`：把上下文一次性导出来；
- `restore(snapshot)` → 原样恢复。

> **为什么现在就要 snapshot？** 因为「能导出」是「能存盘」的前提——Session 把 `{ id, context }` 抱在怀里，下一步 ch27 只需要把它 `JSON.stringify` 进 `.sessions/session-id.json` 就完成了持久化。**这一章做的所有设计，都是在给下一章铺路。**

## 六、实现代码

### `src/session/session.ts`：对话的一等公民

```ts
import { randomUUID } from "node:crypto";
import type { AgentRuntime } from "../agent/runtime";
import type { AgentRun } from "../agent/run";
import { AgentContext } from "../context/context";
import type { ContextSnapshot } from "../context/context";
import type { Message } from "../model/messages";
import { userMessage } from "../model/messages";

export interface SessionSnapshot {
  id: string;
  context: ContextSnapshot;
}

export class Session {
  readonly id: string;
  readonly context: AgentContext;

  constructor(id: string = randomUUID(), messages: Message[] = []) {
    this.id = id;
    this.context = new AgentContext(messages);
  }

  async turn(runtime: AgentRuntime, prompt: string): Promise<AgentRun> {
    this.context.add(userMessage(prompt));
    return runtime.runContext(this.context);
  }

  snapshot(): SessionSnapshot {
    return { id: this.id, context: this.context.snapshot() };
  }

  restore(snapshot: SessionSnapshot): void {
    this.context.restore(snapshot.context);
  }
}
```

**重点**：`turn()` 三行——**加 user 消息、在同一个 context 上跑一轮、返回 run**。上下文在这里是被「持有」的，不是被「传参拼凑」的。

### `src/agent/runtime.ts`：`runContext` 抽出上下文参数

把原来 `run(request)` 的主循环抽出来，改成接收外部 context(下面这张对比图看起来会更清晰，主要目的就是拿出runContext，供上面的Session内使用)：

![image.png](https://imgbed.ppai.top/file/1786857317145_image.png)

```ts
async run(request: ModelRequest): Promise<AgentRun> {
  return this.runContext(new AgentContext(request.messages));  // 向后兼容：无 Session 时照旧
}

async runContext(context: AgentContext): Promise<AgentRun> {
  // …原主循环，只是不再 `new AgentContext(request.messages)`，
  //   直接使用传入的 context：context.add(...)、context.messages 都作用在这同一个对象上
}
```

**重点**：`run()` 变成 `runContext()` 的薄包装——**所有老的调用方（`runAgentDemo`、旧的 `chat` 用法）一行不改**，而 Session 拥有了「在专属上下文上持续运行」的能力。

### `src/cli/chat.ts`：从局部数组到 Session

接下来就是重点的改造就是应用层，将之前的`history[]`使用我们这一章实现的Session进行替换掉

![image.png](https://imgbed.ppai.top/file/1786857801009_image.png)

下面是关键的代码变更点：

```ts
const session = new Session(undefined, [systemMessage(systemPrompt)]);  // 播种 system prompt
console.log(`Session : ${session.id}`);

for (;;) {
  const prompt = await ask();
  if (prompt === null || prompt.trim() === "" || prompt === "exit" || prompt === "quit") break;
  state.stepCount = 0;
  state.retryCount = 0;
  const run = await session.turn(runtime, prompt);  // 一轮 = 一个节拍
  printSummary(run, state);
}
```

**重点**：`history` 局部数组消失了，换成 `session.context`——**上下文住在 Session 里，跨轮自然生长**。另外这版顺手修了旧 `chat()` 的一个坑：旧的 `ask()` 用 `rl.question` + `once("close")`，**管道输入（如 `echo "问题" | hello --chat`）会把后面几行输入丢掉**；新版改成 **`rl.on("line")` 维护一个输入缓冲队列**，交互和管道都能多轮。

### `src/cli/index.ts`：把方法论交给会话

```ts
if (args.chat) {
  await chat(model, registry, SYSTEM_PROMPT, options);  // 把 ch24 的 SYSTEM_PROMPT 传进去播种
}
```

**重点**：`chat()` 新增 `systemPrompt` 参数——**ch24 的方法论第一次真正进入多轮对话**，`--chat` 里的 Coding Agent 从此也讲「先观察、再修改、再验证」。

## 七、运行 Demo

**跑法一：多轮会话（本章的演示，复现第三节转录）**——进入 `hello --chat`，在同一个 Session 里先修 bug、再加功能：

```bash
$ hello --dir examples/stage-3/25-cli --chat
Hello Harness v1.0 · 流式多轮对话（输入 exit 退出，Ctrl+C 取消本轮）
Session : <随机 id>

你 > 帮我修复这个项目里的 bug：src/calc.mjs 的 factorial 函数结果不对，请先观察、再修改、最后运行 npm test 验证
…（第一轮：read → edit → npm test，pass 3 / fail 0）

你 > 很好，现在再帮我加一个 divide 函数，并补充一条测试
…（第二轮：还记得第一轮改了什么，read → edit/write → npm test，pass 5 / fail 0）

你 > exit
```

完整的执行过程演示动画如下（推荐有兴趣有条件的小伙伴，实际跑一跑体验一下）：

![show.gif](https://imgbed.ppai.top/file/1786859319107_show.gif)

观察两轮的关键差异：

| 观察点 | 第一轮 | 第二轮 |
| --- | --- | --- |
| 上下文 | 从零开始读项目 | **直接接上第一轮**——记得 `n - 1` 是改过的 |
| Session id | 生成并打印 | **同一场对话，id 不变** |
| system prompt | 方法论生效 | 方法论持续生效 |
| 失败恢复 | — | edit 因 CRLF 匹配失败 → 重读 → 改 write 重试 → 成功 |

**跑法二：脚本式多轮（管道输入）**——不需要手敲，三行输入喂进去连续跑两轮：

```bash
$ printf '帮我修复这个项目里的 bug：src/calc.mjs 的 factorial 函数结果不对，请先观察、再修改、最后运行 npm test 验证\n很好，现在再帮我加一个 divide 函数，并补充一条测试\nexit\n' | hello --dir examples/stage-3/25-cli --chat
```

> 这一章也不做无模型 demo：**Session 的价值只有真实模型才显形**——两轮对话共享上下文、记住上一轮改动、失败还能续着修，全在一次真实转录里。

## 八、新架构解决了什么？

- **多轮从「行为」变成「结构」**：`Session { id, context }` 让对话成为一个对象——**身份有 id、财产有 context、节拍有 turn()**，不再靠局部数组硬拼；
- **上下文真的被继承了**：`runContext` 让每一轮都长在**同一个 AgentContext** 上——**第二轮能记住第一轮修了什么、测了什么、得出什么结论**；
- **方法论进了多轮**：`chat()` 播种 SYSTEM_PROMPT——**`--chat` 里的 Coding Agent 从此也讲「先观察、再修改、再验证」**；
- **对话可以被指认**：`Session : <id>` 打印在启动行——**「这场对话」有了可指向的句柄**；
- **管道多轮被修好**：输入缓冲队列替代 `once("close")`——**脚本也能连续喂多轮输入**；
- **持久化的地基打好了**：`snapshot()` / `restore()` 让 Session 可导出可恢复——**为 ch27 落盘铺好路**。

## 九、它又引入了什么问题？

1. **Session 只活在内存里**：关掉进程，`id` 和 `context` 一起消失——**「这场对话」还在，但没人记得它**；
2. **没有 Session 列表**：用户无法知道「我有哪些历史会话」——**没有索引，就没有「选一场续跑」的入口**；
3. **恢复是黑盒**：`restore(snapshot)` 只能在**同一个进程里**用对象恢复——**跨进程怎么恢复？需要序列化到磁盘再读回来**；
4. **上下文只增不减**：多轮对话消息越攒越长——**迟早撑爆上下文窗口，需要裁剪/压缩（这是 Stage 4 后段的事）**；
5. **Session 和 CLI 还耦合着**：Session 概念出现在 `chat.ts` 里，**还没有独立成可以被任意入口（CLI、测试、服务）复用的模块边界**。

## 十、下一章

Session 有身份、有内容，**但它还没留下足迹**——进程一退出，一切都归零。下一章我们做 **Session 持久化**：把 `{ id, context }` 写进 `.sessions/session-id.json`，让「这场对话」真正活过进程的一生。

> **Session 给了对话身份，下一章给它坟墓之外的存续——一场对话，值得被记住。**

写代码、写文档的兄弟们，我们下一章见。欢迎点赞、关注公众号「一灰灰Blog」 我们下章见

---

微信公众号: 一灰灰Blog